"""
API Routes for E-Soccer Voice Engine
Endpoints: /health, /models/download, /stt, /tts
"""

import logging
import io
from typing import Optional
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..models.downloader import getModelDownloader
from ..stt.whisper_engine import getWhisperEngine
from ..tts.kokoro_engine import getKokoroEngine

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================

class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(default="ok", description="Service status")


class ModelsDownloadResponse(BaseModel):
    """Model download status response"""
    whisperReady: bool = Field(description="Whisper model download status")
    kokoroReady: bool = Field(description="Kokoro model download status")
    whisperMessage: Optional[str] = Field(default=None, description="Whisper status message")
    kokoroMessage: Optional[str] = Field(default=None, description="Kokoro status message")


class SttResponse(BaseModel):
    """Speech-to-Text response"""
    text: str = Field(description="Transcribed text")


class TtsRequest(BaseModel):
    """Text-to-Speech request"""
    text: str = Field(description="Text to synthesize", min_length=1, max_length=5000)


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/health", response_model=HealthResponse, tags=["System"])
async def healthCheck():
    """
    Health check endpoint.
    Returns status "ok" if the service is running.
    """
    return HealthResponse(status="ok")


@router.post("/models/download", response_model=ModelsDownloadResponse, tags=["Models"])
async def downloadModels():
    """
    Download required models (Whisper and Kokoro).
    
    - Downloads Whisper Large V3 Turbo for STT
    - Downloads Kokoro 82M Dora PT-BR for TTS
    - Idempotent: won't re-download if models already exist
    
    Returns download status for each model.
    """
    logger.info("📥 Starting model download process...")
    
    downloader = getModelDownloader()
    
    # Download Whisper model
    whisperResult = await downloader.downloadWhisperModel()
    logger.info(f"Whisper download result: {whisperResult}")
    
    # Download Kokoro model  
    kokoroResult = await downloader.downloadKokoroModel()
    logger.info(f"Kokoro download result: {kokoroResult}")
    
    return ModelsDownloadResponse(
        whisperReady=whisperResult["success"],
        kokoroReady=kokoroResult["success"],
        whisperMessage=whisperResult.get("message"),
        kokoroMessage=kokoroResult.get("message")
    )


@router.post("/stt", response_model=SttResponse, tags=["Voice"])
async def speechToText(
    file: UploadFile = File(..., description="Audio file (WAV, MP3, OGG)")
):
    """
    Convert speech to text using Whisper.
    
    Accepts audio file via multipart/form-data.
    Supported formats: WAV, MP3, OGG
    
    Returns transcribed text in Portuguese (Brazilian).
    """
    # Validate file type — accept any audio/* content type (browsers append codec info like "audio/webm;codecs=opus")
    filename = file.filename or "audio"
    fileExt = "." + filename.split(".")[-1].lower() if "." in filename else ""
    allowedExtensions = [".wav", ".mp3", ".ogg", ".webm"]
    
    # Check extension first (most reliable from FormData uploads)
    if fileExt not in allowedExtensions:
        # Also check content-type without codec parameters
        ct = (file.content_type or "").split(";")[0].strip()
        allowedTypes = ["audio/wav", "audio/wave", "audio/x-wav", "audio/mpeg", 
                        "audio/mp3", "audio/ogg", "application/ogg", "audio/webm"]
        if ct not in allowedTypes:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported audio format. Supported: WAV, MP3, OGG, WebM. Got: {file.content_type}"
            )
    
    try:
        # Read audio data
        audioData = await file.read()
        
        if len(audioData) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file")
        
        logger.info(f"🎤 Processing audio: {filename}, size: {len(audioData)} bytes")
        
        # Get Whisper engine and transcribe
        whisperEngine = getWhisperEngine()
        transcribedText = await whisperEngine.transcribe(audioData, fileExt)
        
        logger.info(f"✅ Transcription complete: '{transcribedText[:50]}...' " if len(transcribedText) > 50 else f"✅ Transcription complete: '{transcribedText}'")
        
        return SttResponse(text=transcribedText)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ STT error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.post("/tts", tags=["Voice"])
async def textToSpeech(request: TtsRequest):
    """
    Convert text to speech using Kokoro with Dora PT-BR voice.
    
    Accepts JSON with text to synthesize.
    Returns WAV audio bytes.
    """
    try:
        text = request.text.strip()
        
        if not text:
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        logger.info(f"🔊 Synthesizing: '{text[:50]}...' " if len(text) > 50 else f"🔊 Synthesizing: '{text}'")
        
        # Get Kokoro engine and synthesize
        kokoroEngine = getKokoroEngine()
        audioBytes = await kokoroEngine.synthesize(text)
        
        logger.info(f"✅ TTS complete: {len(audioBytes)} bytes")
        
        return Response(
            content=audioBytes,
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=speech.wav"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ TTS error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Speech synthesis failed: {str(e)}")
