from fastapi import FastAPI, UploadFile, File
from faster_whisper import WhisperModel
import numpy as np
import tempfile
import os

# Configure model directory to use a relative path to ./models
model_dir = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(model_dir, exist_ok=True)

# Initialize the Whisper model (can use "base", "medium", "large-v2" etc.)
model = WhisperModel("small", compute_type="int8", download_root=model_dir)

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    print("🎤 Whisper transcription server is starting up...")

@app.post("/transcribe/")
async def transcribe_audio(file: UploadFile = File(...)):
    # Accept common audio formats
    allowed_extensions = [".wav", ".mp3", ".m4a", ".ogg", ".webm"]
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if not any(file.filename.lower().endswith(ext) for ext in allowed_extensions):
        return {"error": f"Unsupported file format. Supported formats: {', '.join(allowed_extensions)}"}

    try:
        # Save the uploaded file
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_audio:
            temp_audio.write(await file.read())
            temp_audio_path = temp_audio.name

        # Transcribe using Faster-Whisper
        segments, _ = model.transcribe(temp_audio_path)

        # Convert to text output
        transcription = " ".join([segment.text for segment in segments])

    except Exception as e:
        return {"error": str(e)}

    finally:
        # Clean up
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

    return {"transcription": transcription}