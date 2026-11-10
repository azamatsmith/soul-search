from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.routes import router as auth_router
from app.config import get_cors_origin_regex, get_cors_origins
from app.errors import register_error_handler
from app.me.routes import router as me_router


def create_app() -> FastAPI:
    app = FastAPI()
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

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
