"""
Whisper STT Engine for E-Soccer Voice
Uses faster-whisper for CPU-optimized speech-to-text
"""

import asyncio
import logging
import threading
import io
import tempfile
import os
from pathlib import Path
from typing import Optional

from ..models.downloader import getModelsBaseDir

logger = logging.getLogger(__name__)

# Singleton instance
_whisperEngineInstance: Optional["WhisperEngine"] = None


def getWhisperEngine() -> "WhisperEngine":
    """
    Get or create WhisperEngine singleton instance.
    Keeps model in memory for performance.
    """
    global _whisperEngineInstance
    if _whisperEngineInstance is None:
        _whisperEngineInstance = WhisperEngine()
    return _whisperEngineInstance


class WhisperEngine:
    """
    Speech-to-Text engine using faster-whisper.
    Optimized for CPU-only environments.
    """
    
    # Model configuration
    MODEL_NAME = "large-v3-turbo"  # Whisper Large V3 Turbo
    
    def __init__(self):
        """Initialize Whisper engine (lazy loading)"""
        self._model = None
        self._modelLoaded = False
        self._lock = threading.Lock()  # Thread-safety for model access
        # Use writable models directory from downloader
        self.MODEL_DIR = getModelsBaseDir() / "whisper"
        logger.info(f"WhisperEngine initialized (model dir: {self.MODEL_DIR})")
    
    def _ensureModelLoaded(self):
        """Load model if not already loaded"""
        if self._modelLoaded:
            return
        
        try:
            from faster_whisper import WhisperModel
            
            # Ensure model directory exists
            self.MODEL_DIR.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"🔄 Loading Whisper model: {self.MODEL_NAME}")
            logger.info(f"📁 Model directory: {self.MODEL_DIR}")
            
            # Load model with CPU optimization
            # compute_type: int8 for CPU efficiency
            self._model = WhisperModel(
                self.MODEL_NAME,
                device="cpu",
                compute_type="int8",
                download_root=str(self.MODEL_DIR),
                local_files_only=False  # Allow download if needed
            )
            
            self._modelLoaded = True
            logger.info("✅ Whisper model loaded successfully")
            
        except ImportError as e:
            logger.error(f"❌ faster-whisper not installed: {e}")
            raise RuntimeError("faster-whisper package not installed. Run: pip install faster-whisper")
        except Exception as e:
            logger.error(f"❌ Failed to load Whisper model: {e}")
            raise RuntimeError(f"Failed to load Whisper model: {e}")
    
    def isModelReady(self) -> bool:
        """Check if model is loaded and ready"""
        return self._modelLoaded
    
    def getModelPath(self) -> Path:
        """Get the model storage directory"""
        return self.MODEL_DIR
    
    def _transcribeSync(self, audioFilePath: str) -> str:
        """
        Synchronous transcription (CPU-bound).
        Called via asyncio.to_thread() to avoid blocking the event loop.
        Uses a lock to prevent concurrent model access (not thread-safe).
        """
        with self._lock:
            segments, info = self._model.transcribe(
                audioFilePath,
                language="pt",  # Portuguese
                beam_size=5,
                best_of=5,
                temperature=0.0,  # Deterministic output
                vad_filter=True,  # Voice Activity Detection
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=400
                )
            )
            
            # Combine all segments
            transcribedText = " ".join([segment.text.strip() for segment in segments])
            
            logger.info(f"📝 Detected language: {info.language} (prob: {info.language_probability:.2f})")
            
            return transcribedText.strip()

    async def transcribe(self, audioData: bytes, fileExtension: str = ".wav") -> str:
        """
        Transcribe audio data to text.
        Uses asyncio.to_thread() to avoid blocking the event loop.
        
        Args:
            audioData: Raw audio bytes
            fileExtension: Original file extension (.wav, .mp3, .ogg)
            
        Returns:
            Transcribed text string
        """
        self._ensureModelLoaded()
        
        # Write audio to temporary file (faster-whisper requires file path)
        with tempfile.NamedTemporaryFile(suffix=fileExtension, delete=False) as tmpFile:
            tmpFile.write(audioData)
            tmpFilePath = tmpFile.name
        
        try:
            # Run CPU-bound transcription in a separate thread with timeout
            transcribedText = await asyncio.wait_for(
                asyncio.to_thread(self._transcribeSync, tmpFilePath),
                timeout=60.0  # 60 second timeout
            )
            return transcribedText
            
        except asyncio.TimeoutError:
            logger.error("❌ Transcription timed out after 60 seconds")
            raise RuntimeError("Transcrição excedeu o tempo limite de 60 segundos")
        finally:
            # Clean up temp file
            try:
                os.unlink(tmpFilePath)
            except Exception:
                pass
    
    async def transcribeFile(self, filePath: str) -> str:
        """
        Transcribe audio file to text.
        Uses asyncio.to_thread() to avoid blocking the event loop.
        
        Args:
            filePath: Path to audio file
            
        Returns:
            Transcribed text string
        """
        self._ensureModelLoaded()
        
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(self._transcribeSync, filePath),
                timeout=60.0
            )
        except asyncio.TimeoutError:
            logger.error("❌ File transcription timed out after 60 seconds")
            raise RuntimeError("Transcrição do arquivo excedeu o tempo limite de 60 segundos")
