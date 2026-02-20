"""
Model Downloader for E-Soccer Voice Engine
Handles downloading Whisper and Kokoro models

IMPORTANT: Uses writable user directory for models to support AppImage/read-only environments.
Uses ESOCCER_MODELS_DIR env var if set, otherwise falls back to ~/.local/share/esoccer-battle/models/
"""

import logging
import os
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Singleton instance
_modelDownloaderInstance: Optional["ModelDownloader"] = None


def getModelsBaseDir() -> Path:
    """
    Get the base directory for storing models.
    
    Priority:
    1. ESOCCER_MODELS_DIR environment variable (set by Electron main process)
    2. ~/.local/share/esoccer-battle/models/ (user writable fallback)
    
    This ensures models are stored in a writable location, even when running
    from AppImage or other read-only environments.
    """
    # Check for environment variable (passed from Electron)
    envModelsDir = os.environ.get('ESOCCER_MODELS_DIR')
    if envModelsDir:
        modelsDir = Path(envModelsDir)
        logger.info(f"Using ESOCCER_MODELS_DIR: {modelsDir}")
        return modelsDir
    
    # Fallback to user's local share directory
    homeDir = Path.home()
    modelsDir = homeDir / ".local" / "share" / "esoccer-battle" / "models"
    logger.info(f"Using fallback models dir: {modelsDir}")
    return modelsDir


def getModelDownloader() -> "ModelDownloader":
    """
    Get or create ModelDownloader singleton instance.
    """
    global _modelDownloaderInstance
    if _modelDownloaderInstance is None:
        _modelDownloaderInstance = ModelDownloader()
    return _modelDownloaderInstance


class ModelDownloader:
    """
    Handles downloading and managing AI models for voice processing.
    """
    
    # Model configurations
    WHISPER_MODEL = "large-v3-turbo"
    KOKORO_MODEL_ID = "hexgrad/Kokoro-82M"
    
    def __init__(self):
        """Initialize model downloader with writable directories"""
        # Get base directory (writable, user-specific)
        self.MODELS_DIR = getModelsBaseDir()
        self.WHISPER_DIR = self.MODELS_DIR / "whisper"
        self.KOKORO_DIR = self.MODELS_DIR / "kokoro"
        
        # Ensure directories exist
        try:
            self.MODELS_DIR.mkdir(parents=True, exist_ok=True)
            self.WHISPER_DIR.mkdir(parents=True, exist_ok=True)
            self.KOKORO_DIR.mkdir(parents=True, exist_ok=True)
            logger.info(f"ModelDownloader initialized. Models dir: {self.MODELS_DIR}")
        except OSError as e:
            logger.error(f"Failed to create models directory: {e}")
            raise RuntimeError(f"Cannot create models directory at {self.MODELS_DIR}: {e}")
    
    def isWhisperModelDownloaded(self) -> bool:
        """
        Check if Whisper model is already downloaded.
        faster-whisper stores models in a specific structure.
        """
        # Check for any model files in the whisper directory
        if not self.WHISPER_DIR.exists():
            return False
        
        # Check for model files (faster-whisper downloads to cache by default)
        modelFiles = list(self.WHISPER_DIR.glob("**/*.bin")) + \
                     list(self.WHISPER_DIR.glob("**/model.bin")) + \
                     list(self.WHISPER_DIR.glob("**/*.ct2"))
        
        return len(modelFiles) > 0
    
    def isKokoroModelDownloaded(self) -> bool:
        """
        Check if Kokoro model is already downloaded.
        """
        if not self.KOKORO_DIR.exists():
            return False
        
        # Check for model files
        modelFiles = list(self.KOKORO_DIR.glob("**/*.pth")) + \
                     list(self.KOKORO_DIR.glob("**/*.pt")) + \
                     list(self.KOKORO_DIR.glob("**/*.bin")) + \
                     list(self.KOKORO_DIR.glob("**/*.onnx"))
        
        return len(modelFiles) > 0
    
    async def downloadWhisperModel(self) -> Dict:
        """
        Download Whisper Large V3 Turbo model.
        Uses faster-whisper which downloads from Hugging Face.
        
        Returns:
            Dict with success status and message
        """
        logger.info(f"📥 Checking Whisper model: {self.WHISPER_MODEL}")
        
        try:
            from faster_whisper import WhisperModel
            
            # Check if already downloaded (by trying to load)
            logger.info("🔄 Loading/downloading Whisper model...")
            
            # This will download if not present, or load from cache
            model = WhisperModel(
                self.WHISPER_MODEL,
                device="cpu",
                compute_type="int8",
                download_root=str(self.WHISPER_DIR),
                local_files_only=False
            )
            
            # Clean up model to free memory (will be reloaded by engine)
            del model
            
            logger.info("✅ Whisper model ready")
            return {
                "success": True,
                "message": f"Whisper {self.WHISPER_MODEL} is ready",
                "path": str(self.WHISPER_DIR)
            }
            
        except ImportError as e:
            logger.error(f"❌ faster-whisper not installed: {e}")
            return {
                "success": False,
                "message": "faster-whisper package not installed",
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"❌ Whisper download failed: {e}")
            return {
                "success": False,
                "message": f"Failed to download Whisper model: {str(e)}",
                "error": str(e)
            }
    
    async def downloadKokoroModel(self) -> Dict:
        """
        Download Kokoro 82M model with Dora PT-BR voice.
        
        Returns:
            Dict with success status and message
        """
        logger.info(f"📥 Checking Kokoro model: {self.KOKORO_MODEL_ID}")
        
        try:
            # Try to initialize Kokoro which will download models if needed
            try:
                from kokoro import KPipeline
                
                logger.info("🔄 Loading/downloading Kokoro model...")
                
                # Initialize pipeline - this downloads the model
                pipeline = KPipeline(lang_code="p")  # Portuguese
                
                # Try to generate a small test to ensure model works
                # This also ensures voice files are downloaded
                testText = "Olá"
                for _, _, audio in pipeline(testText, voice="pf_dora", speed=1.0):
                    pass  # Just verify it runs
                
                del pipeline
                
                logger.info("✅ Kokoro model ready")
                return {
                    "success": True,
                    "message": f"Kokoro 82M with Dora PT-BR voice is ready",
                    "path": str(self.KOKORO_DIR)
                }
                
            except ImportError:
                logger.warning("kokoro package not found, trying huggingface_hub...")
                
                # Alternative: Download from Hugging Face directly
                from huggingface_hub import hf_hub_download, snapshot_download
                
                logger.info("🔄 Downloading Kokoro from Hugging Face...")
                
                # Download the model snapshot
                snapshot_download(
                    repo_id=self.KOKORO_MODEL_ID,
                    local_dir=str(self.KOKORO_DIR),
                    local_dir_use_symlinks=False
                )
                
                logger.info("✅ Kokoro model files downloaded")
                return {
                    "success": True,
                    "message": f"Kokoro 82M model files downloaded (kokoro package needed for inference)",
                    "path": str(self.KOKORO_DIR)
                }
            
        except ImportError as e:
            logger.error(f"❌ Required packages not installed: {e}")
            return {
                "success": False,
                "message": "kokoro or huggingface_hub package not installed",
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"❌ Kokoro download failed: {e}")
            return {
                "success": False,
                "message": f"Failed to download Kokoro model: {str(e)}",
                "error": str(e)
            }
    
    async def downloadAllModels(self) -> Dict:
        """
        Download all required models.
        
        Returns:
            Dict with status of each model
        """
        whisperResult = await self.downloadWhisperModel()
        kokoroResult = await self.downloadKokoroModel()
        
        return {
            "whisper": whisperResult,
            "kokoro": kokoroResult,
            "allReady": whisperResult["success"] and kokoroResult["success"]
        }
    
    def getModelsStatus(self) -> Dict:
        """
        Get current status of all models.
        
        Returns:
            Dict with download status of each model
        """
        return {
            "whisperDownloaded": self.isWhisperModelDownloaded(),
            "kokoroDownloaded": self.isKokoroModelDownloaded(),
            "whisperDir": str(self.WHISPER_DIR),
            "kokoroDir": str(self.KOKORO_DIR)
        }
