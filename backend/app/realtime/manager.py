"""In-memory WebSocket hub for consultation real-time events."""

import json
from dataclasses import dataclass, field
from uuid import UUID

from fastapi import WebSocket


@dataclass
class SessionRoom:
    session_id: UUID
    connections: dict[str, WebSocket] = field(default_factory=dict)  # user_id -> ws


class RealtimeManager:
    def __init__(self) -> None:
        self._rooms: dict[str, SessionRoom] = {}

    def _key(self, session_id: UUID) -> str:
        return str(session_id)

    async def connect(self, session_id: UUID, user_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        key = self._key(session_id)
        if key not in self._rooms:
            self._rooms[key] = SessionRoom(session_id=session_id)
        self._rooms[key].connections[str(user_id)] = websocket

    def disconnect(self, session_id: UUID, user_id: UUID) -> None:
        key = self._key(session_id)
        room = self._rooms.get(key)
        if not room:
            return
        room.connections.pop(str(user_id), None)
        if not room.connections:
            del self._rooms[key]

    async def broadcast(
        self,
        session_id: UUID,
        payload: dict,
        exclude_user_id: UUID | None = None,
    ) -> None:
        key = self._key(session_id)
        room = self._rooms.get(key)
        if not room:
            return
        data = json.dumps(payload)
        dead: list[str] = []
        for uid, ws in room.connections.items():
            if exclude_user_id and uid == str(exclude_user_id):
                continue
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(uid)
        for uid in dead:
            room.connections.pop(uid, None)

    async def send_to_user(self, session_id: UUID, user_id: UUID, payload: dict) -> None:
        key = self._key(session_id)
        room = self._rooms.get(key)
        if not room:
            return
        ws = room.connections.get(str(user_id))
        if ws:
            await ws.send_text(json.dumps(payload))


realtime_manager = RealtimeManager()
