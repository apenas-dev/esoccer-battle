"""
FastAPI Application for E-Soccer Voice Engine
Provides STT (Speech-to-Text) and TTS (Text-to-Speech) endpoints
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for FastAPI app.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("🚀 Starting E-Soccer Voice Engine...")
    logger.info("📍 Server running at http://127.0.0.1:8001")
    logger.info("📖 API docs available at http://127.0.0.1:8001/docs")
    yield
    # Shutdown
    logger.info("👋 Shutting down E-Soccer Voice Engine...")


# Create FastAPI application
app = FastAPI(
    title="E-Soccer Voice Engine",
    description="Voice processing backend for E-Soccer Battle - STT with Whisper, TTS with Kokoro",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for desktop app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)


def runServer():
    """Run the server using uvicorn"""
    import uvicorn
    uvicorn.run(
        "esoccer_voice.api.main:app",
        host="127.0.0.1",
        port=8001,
        reload=False,
        log_level="info"
    )


if __name__ == "__main__":
    runServer()
