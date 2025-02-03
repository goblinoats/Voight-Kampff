import io
from flask import Flask, request, send_file, jsonify
from diffusers import StableDiffusionPipeline
import torch

torch.set_num_threads(8)  # Or the number of cores available on your machine
app = Flask(__name__)

# Load the model. For a GPU-enabled container, replace "cpu" with "cuda"
print("Loading model...")
pipe = StableDiffusionPipeline.from_pretrained(
    "stable-diffusion-v1-4", 
    torch_dtype=torch.float32,  # Use float32 on CPU
    local_files_only=True  # Force loading only local files
)
# For CPU, you might need to move it to CPU:
pipe = pipe.to("cuda" if torch.cuda.is_available() else "cpu")
pipe.safety_checker = lambda images, clip_input: (images, None)  # Return images and a placeholder
print("Model loaded.")

@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json()
    if not data or "prompt" not in data:
        return jsonify({"error": "No prompt provided"}), 400

    prompt = data["prompt"]
    try:
        # Generate image
        image = pipe(prompt, height=384, width=384, num_inference_steps=25).images[0]

        # Save image to a bytes buffer
        img_io = io.BytesIO()
        image.save(img_io, "PNG")
        img_io.seek(0)
        return send_file(img_io, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5003)