import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.routes import admin, ai_doctor, auth, consultations, doctors, files, patients, payments, verification
from app.db.session import AsyncSessionLocal
from app.services.consultation_service import process_session_lifecycle
from app.core.config import settings
from app.schemas import ErrorDetail, ErrorResponse

limiter = Limiter(key_func=get_remote_address)


async def _session_lifecycle_loop():
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await process_session_lifecycle(db)
                await db.commit()
        except Exception:
            pass
        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(_session_lifecycle_loop())
    yield
    task.cancel()


app = FastAPI(
    title="Virtual Hospital Management System",
    description="AI-Powered Healthcare Platform API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    errors = [
        ErrorDetail(field=".".join(str(loc) for loc in e["loc"]), message=e["msg"])
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ErrorResponse(message="Validation failed", errors=errors).model_dump(),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(message=str(exc.detail)).model_dump(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(_request: Request, exc: Exception):
    if settings.ENVIRONMENT == "development":
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(message=str(exc)).model_dump(),
        )
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(message="Internal server error").model_dump(),
    )


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "vhms-api"}


app.include_router(auth.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
app.include_router(doctors.router, prefix="/api/v1")
app.include_router(files.router, prefix="/api/v1")
app.include_router(consultations.router, prefix="/api/v1")
app.include_router(ai_doctor.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
