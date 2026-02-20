"""
Kokoro TTS Engine for E-Soccer Voice
Uses Kokoro 82M with Dora PT-BR voice for text-to-speech
"""

import asyncio
import logging
import threading
import io
import struct
import tempfile
import os
from pathlib import Path
from typing import Optional

import numpy as np

from ..models.downloader import getModelsBaseDir

logger = logging.getLogger(__name__)

# Singleton instance
_kokoroEngineInstance: Optional["KokoroEngine"] = None


def getKokoroEngine() -> "KokoroEngine":
    """
    Get or create KokoroEngine singleton instance.
    Keeps model in memory for performance.
    """
    global _kokoroEngineInstance
    if _kokoroEngineInstance is None:
        _kokoroEngineInstance = KokoroEngine()
    return _kokoroEngineInstance


class KokoroEngine:
    """
    Text-to-Speech engine using Kokoro.
    Uses Dora voice for Brazilian Portuguese.
    """
    
    # Model configuration
    MODEL_ID = "hexgrad/Kokoro-82M"
    VOICE_NAME = "pf_dora"  # Portuguese Female Dora voice
    SAMPLE_RATE = 24000  # Kokoro default sample rate
    
    def __init__(self):
        """Initialize Kokoro engine (lazy loading)"""
        self._pipeline = None
        self._modelLoaded = False
        self._lock = threading.Lock()  # Thread-safety for pipeline access
        # Use writable models directory from downloader
        self.MODEL_DIR = getModelsBaseDir() / "kokoro"
        logger.info(f"KokoroEngine initialized (model dir: {self.MODEL_DIR})")
    
    def _ensureModelLoaded(self):
        """Load model if not already loaded"""
        if self._modelLoaded:
            return
        
        try:
            # Ensure model directory exists
            self.MODEL_DIR.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"🔄 Loading Kokoro model: {self.MODEL_ID}")
            logger.info(f"🗣️ Voice: {self.VOICE_NAME}")
            logger.info(f"📁 Model directory: {self.MODEL_DIR}")
            
            # Try to import and use kokoro
            try:
                from kokoro import KPipeline
                
                # Initialize Kokoro pipeline with PT-BR language
                self._pipeline = KPipeline(lang_code="p")  # 'p' for Portuguese
                self._modelLoaded = True
                logger.info("✅ Kokoro model loaded successfully")
                
            except ImportError:
                # Fallback: try alternative import
                logger.warning("kokoro package not found, trying alternative...")
                self._setupFallbackTts()
            
        except Exception as e:
            logger.error(f"❌ Failed to load Kokoro model: {e}")
            # Set up fallback TTS
            self._setupFallbackTts()
    
    def _setupFallbackTts(self):
        """Setup fallback TTS using pyttsx3 or simple beep"""
        logger.warning("⚠️ Using fallback TTS engine")
        self._pipeline = None
        self._modelLoaded = True
        self._useFallback = True
    
    def isModelReady(self) -> bool:
        """Check if model is loaded and ready"""
        return self._modelLoaded
    
    def getModelPath(self) -> Path:
        """Get the model storage directory"""
        return self.MODEL_DIR
    
    def _audioToWav(self, audioArray: np.ndarray, sampleRate: int = 24000) -> bytes:
        """
        Convert numpy audio array to WAV bytes.
        
        Args:
            audioArray: Audio samples as numpy array
            sampleRate: Sample rate in Hz
            
        Returns:
            WAV file bytes
        """
        # Normalize to int16
        if audioArray.dtype == np.float32 or audioArray.dtype == np.float64:
            audioArray = np.clip(audioArray, -1.0, 1.0)
            audioArray = (audioArray * 32767).astype(np.int16)
        
        # Create WAV file in memory
        buffer = io.BytesIO()
        
        # WAV header
        numChannels = 1
        bitsPerSample = 16
        byteRate = sampleRate * numChannels * bitsPerSample // 8
        blockAlign = numChannels * bitsPerSample // 8
        dataSize = len(audioArray) * 2  # 2 bytes per sample
        
        # Write RIFF header
        buffer.write(b'RIFF')
        buffer.write(struct.pack('<I', 36 + dataSize))
        buffer.write(b'WAVE')
        
        # Write fmt chunk
        buffer.write(b'fmt ')
        buffer.write(struct.pack('<I', 16))  # Chunk size
        buffer.write(struct.pack('<H', 1))   # PCM format
        buffer.write(struct.pack('<H', numChannels))
        buffer.write(struct.pack('<I', sampleRate))
        buffer.write(struct.pack('<I', byteRate))
        buffer.write(struct.pack('<H', blockAlign))
        buffer.write(struct.pack('<H', bitsPerSample))
        
        # Write data chunk
        buffer.write(b'data')
        buffer.write(struct.pack('<I', dataSize))
        buffer.write(audioArray.tobytes())
        
        return buffer.getvalue()
    
    def _generateFallbackAudio(self, text: str) -> bytes:
        """
        Generate simple tone audio as fallback when Kokoro is unavailable.
        This is a placeholder - in production, use an alternative TTS.
        """
        logger.warning(f"⚠️ Generating fallback audio for: {text[:30]}...")
        
        # Generate a simple notification sound
        duration = min(len(text) * 0.05, 3.0)  # Scale with text length, max 3 seconds
        t = np.linspace(0, duration, int(self.SAMPLE_RATE * duration), False)
        
        # Create a pleasant notification tone
        frequency = 440  # A4 note
        audio = 0.5 * np.sin(2 * np.pi * frequency * t)
        
        # Apply fade in/out
        fadeLength = int(self.SAMPLE_RATE * 0.05)
        audio[:fadeLength] *= np.linspace(0, 1, fadeLength)
        audio[-fadeLength:] *= np.linspace(1, 0, fadeLength)
        
        return self._audioToWav(audio.astype(np.float32), self.SAMPLE_RATE)
    
    def _synthesizeSync(self, text: str) -> bytes:
        """
        Synchronous synthesis (CPU-bound).
        Called via asyncio.to_thread() to avoid blocking the event loop.
        Uses a lock to prevent concurrent pipeline access (not thread-safe).
        """
        with self._lock:
            # Use Kokoro pipeline to generate audio
            # The pipeline returns a generator of (graphemes, phonemes, audio) tuples
            audioChunks = []
            
            for graphemes, phonemes, audio in self._pipeline(
                text, 
                voice=self.VOICE_NAME,
                speed=1.0
            ):
                if audio is not None:
                    audioChunks.append(audio)
            
            if not audioChunks:
                logger.warning("No audio generated, using fallback")
                return self._generateFallbackAudio(text)
            
            # Concatenate all audio chunks
            fullAudio = np.concatenate(audioChunks)
            
            # Convert to WAV
            return self._audioToWav(fullAudio, self.SAMPLE_RATE)

    async def synthesize(self, text: str) -> bytes:
        """
        Synthesize text to speech.
        Uses asyncio.to_thread() to avoid blocking the event loop.
        
        Args:
            text: Text to synthesize
            
        Returns:
            WAV audio bytes
        """
        self._ensureModelLoaded()
        
        # Check if using fallback
        if getattr(self, '_useFallback', False) or self._pipeline is None:
            return self._generateFallbackAudio(text)
        
        try:
            # Run CPU-bound synthesis in a separate thread with timeout
            return await asyncio.wait_for(
                asyncio.to_thread(self._synthesizeSync, text),
                timeout=30.0  # 30 second timeout
            )
        except asyncio.TimeoutError:
            logger.error("❌ Synthesis timed out after 30 seconds")
            return self._generateFallbackAudio(text)
        except Exception as e:
            logger.error(f"❌ Kokoro synthesis failed: {e}")
            # Fall back to simple audio
            return self._generateFallbackAudio(text)
    
    async def synthesizeToFile(self, text: str, outputPath: str) -> str:
        """
        Synthesize text to speech and save to file.
        
        Args:
            text: Text to synthesize
            outputPath: Output file path
            
        Returns:
            Output file path
        """
        audioBytes = await self.synthesize(text)
        
        with open(outputPath, 'wb') as f:
            f.write(audioBytes)
        
        return outputPath
