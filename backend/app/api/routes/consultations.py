import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.enums import ConsultationSessionStatus, UserRole
from app.core.security import decode_token
from app.db.session import AsyncSessionLocal, get_db
from app.models import (
    Appointment,
    ConsultationMessage,
    ConsultationNote,
    ConsultationSession,
    Patient,
    Prescription,
    User,
)
from app.realtime.manager import realtime_manager
from app.schemas import APIResponse
from app.services.consultation_service import get_or_activate_session, process_session_lifecycle

router = APIRouter(prefix="/consultations", tags=["Consultations"])


async def _get_appointment_for_user(
    db: AsyncSession, user: User, appointment_id: UUID
) -> Appointment:
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient).selectinload(Patient.user))
        .where(Appointment.id == appointment_id, Appointment.deleted_at.is_(None))
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if user.role == UserRole.DOCTOR:
        if not user.doctor or appt.doctor_id != user.doctor.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role == UserRole.PATIENT:
        if not user.patient or appt.patient_id != user.patient.id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    return appt


@router.get("/appointments/{appointment_id}/session", response_model=APIResponse[dict])
async def join_consultation_session(
    appointment_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    appointment = await _get_appointment_for_user(db, user, appointment_id)
    session = await get_or_activate_session(db, appointment, user)
    return APIResponse(
        data={
            "session_id": str(session.id),
            "appointment_id": str(appointment.id),
            "status": session.status.value,
            "scheduled_start": session.scheduled_start.isoformat(),
            "scheduled_end": session.scheduled_end.isoformat(),
            "ws_url": f"/api/v1/consultations/ws/{session.id}",
        }
    )


@router.get("/sessions/{session_id}/messages", response_model=APIResponse[list[dict]])
async def list_session_messages(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _authorize_session(db, user, session_id)
    result = await db.execute(
        select(ConsultationMessage)
        .where(ConsultationMessage.session_id == session.id)
        .order_by(ConsultationMessage.created_at)
        .limit(200)
    )
    return APIResponse(
        data=[
            {
                "id": str(m.id),
                "sender_user_id": str(m.sender_user_id),
                "sender_role": m.sender_role,
                "content": m.content,
                "message_type": m.message_type,
                "created_at": m.created_at.isoformat(),
            }
            for m in result.scalars().all()
        ]
    )


async def _authorize_session(db: AsyncSession, user: User, session_id: UUID) -> ConsultationSession:
    result = await db.execute(select(ConsultationSession).where(ConsultationSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if user.role == UserRole.DOCTOR and user.doctor and session.doctor_id == user.doctor.id:
        return session
    if user.role == UserRole.PATIENT and user.patient and session.patient_id == user.patient.id:
        return session
    raise HTTPException(status_code=403, detail="Access denied")


async def _authenticate_ws(token: str) -> User:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User)
            .options(selectinload(User.patient), selectinload(User.doctor))
            .where(User.id == UUID(user_id))
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user


@router.websocket("/ws/{session_id}")
async def consultation_websocket(
    websocket: WebSocket,
    session_id: UUID,
    token: str = Query(...),
):
    try:
        user = await _authenticate_ws(token)
    except HTTPException:
        await websocket.close(code=4001)
        return

    async with AsyncSessionLocal() as db:
        try:
            session = await _authorize_session(db, user, session_id)
        except HTTPException:
            await websocket.close(code=4003)
            return
        if session.status == ConsultationSessionStatus.COMPLETED:
            await websocket.close(code=4004)
            return

    await realtime_manager.connect(session_id, user.id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event = msg.get("event", "chat")
            if event == "chat":
                content = (msg.get("content") or "").strip()
                if not content:
                    continue
                async with AsyncSessionLocal() as db:
                    db_msg = ConsultationMessage(
                        session_id=session_id,
                        sender_user_id=user.id,
                        sender_role=user.role.value,
                        content=content,
                        message_type="text",
                    )
                    db.add(db_msg)
                    await db.commit()
                    await db.refresh(db_msg)
                    payload = {
                        "event": "chat",
                        "id": str(db_msg.id),
                        "sender_user_id": str(user.id),
                        "sender_role": user.role.value,
                        "content": content,
                        "created_at": db_msg.created_at.isoformat(),
                    }
                await realtime_manager.broadcast(session_id, payload)
            elif event in ("typing", "webrtc-offer", "webrtc-answer", "webrtc-ice", "mute", "unmute"):
                msg["sender_user_id"] = str(user.id)
                msg["sender_role"] = user.role.value
                await realtime_manager.broadcast(session_id, msg, exclude_user_id=user.id)
            elif event == "session-ended":
                await realtime_manager.broadcast(session_id, {"event": "session-ended"})
    except WebSocketDisconnect:
        pass
    finally:
        realtime_manager.disconnect(session_id, user.id)


@router.get("/appointments/{appointment_id}/summary", response_model=APIResponse[dict])
async def get_consultation_summary(
    appointment_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    appointment = await _get_appointment_for_user(db, user, appointment_id)
    note_result = await db.execute(
        select(ConsultationNote).where(ConsultationNote.appointment_id == appointment_id)
    )
    note = note_result.scalar_one_or_none()
    rx_result = await db.execute(
        select(Prescription).where(
            Prescription.appointment_id == appointment_id, Prescription.deleted_at.is_(None)
        )
    )
    prescription = rx_result.scalar_one_or_none()
    session_result = await db.execute(
        select(ConsultationSession).where(ConsultationSession.appointment_id == appointment_id)
    )
    session = session_result.scalar_one_or_none()

    return APIResponse(
        data={
            "appointment_id": str(appointment.id),
            "status": appointment.status.value,
            "scheduled_at": appointment.scheduled_at.isoformat(),
            "consultation_summary": {
                "symptoms": note.symptoms if note else None,
                "diagnosis": note.diagnosis if note else None,
                "treatment_plan": note.treatment_plan if note else None,
                "follow_up_notes": note.follow_up_notes if note else None,
                "ai_summary": (note.draft_json or {}).get("ai_summary") if note and note.draft_json else None,
            },
            "prescription": {
                "diagnosis": prescription.diagnosis,
                "medications": prescription.medications,
                "instructions": prescription.instructions,
                "recommendations": prescription.recommendations,
                "pdf_url": prescription.pdf_url,
            }
            if prescription
            else None,
            "session": {
                "id": str(session.id),
                "status": session.status.value,
                "actual_start": session.actual_start.isoformat() if session and session.actual_start else None,
                "actual_end": session.actual_end.isoformat() if session and session.actual_end else None,
            }
            if session
            else None,
        }
    )
