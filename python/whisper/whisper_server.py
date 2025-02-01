from fastapi import FastAPI, UploadFile, File
from faster_whisper import WhisperModel
import numpy as np
import tempfile
import os

# Initialize the Whisper model (can use "base", "medium", "large-v2" etc.)
model = WhisperModel("small", compute_type="int8")

app = FastAPI()

@app.post("/transcribe/")
async def transcribe_audio(file: UploadFile = File(...)):
    # Validate file type
    if not file.filename.endswith(".wav"):
        return {"error": "Only .wav files are supported."}

    try:
        # Save the uploaded file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
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