import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.routes import router as auth_router
from app.config import check_settings, get_cors_origin_regex, get_cors_origins
from app.errors import UnhandledErrorMiddleware, register_error_handler
from app.me.routes import router as me_router
from app.sightings.routes import router as sightings_router
from app.verification.runner import run_verification, sweep_forever
from app.weeks.routes import router as weeks_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    check_settings()
    sweeper = asyncio.create_task(sweep_forever(run_verification))
    yield
    sweeper.cancel()


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)
    # Added before CORS so it sits inside it: FastAPI's own 500s skip CORS headers.
    app.add_middleware(UnhandledErrorMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=get_cors_origin_regex(),
        allow_origins=get_cors_origins(),
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Authorization", "Content-Type"],
    )
    register_error_handler(app)
    app.include_router(auth_router)
    app.include_router(me_router)
    app.include_router(sightings_router)
    app.include_router(weeks_router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
