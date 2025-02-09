from faster_whisper import WhisperModel
import os

def download_whisper_model():
    # Configure model directory to use a persistent volume
    model_dir = "./models"
    os.makedirs(model_dir, exist_ok=True)
    
    print("📥 Downloading Whisper 'small' model...")
    try:
        # Initialize model which triggers the download
        WhisperModel("small", compute_type="int8", download_root=model_dir)
        print("✅ Model downloaded successfully!")
    except Exception as e:
        print(f"❌ Error downloading model: {str(e)}")

if __name__ == "__main__":
    download_whisper_model()
