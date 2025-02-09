import io
import argparse
from flask import Flask, request, send_file, jsonify
from diffusers import StableDiffusionPipeline
import torch

def load_pipeline(optimize_for_mac: bool):
    if optimize_for_mac:
        # Use Metal Performance Shaders (MPS) for Apple Silicon
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        torch_dtype = torch.float16  # Lower precision for better performance
        num_inference_steps = 25   # Fewer steps for faster generation
        height, width = 384, 384    # Lower resolution
        print("Loading optimized model for Apple Silicon...")
    else:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        torch_dtype = torch.float32  # Default precision
        num_inference_steps = 25
        height, width = 384, 384
        print("Loading default model...")

    # Load the Stable Diffusion pipeline
    pipe = StableDiffusionPipeline.from_pretrained(
        "stable-diffusion-v1-4",
        torch_dtype=torch_dtype,
        local_files_only=True
    )
    pipe = pipe.to(device)
    pipe.safety_checker = lambda images, clip_input: (images, None)  # Disable safety checker
    print("Model loaded.")
    return pipe, num_inference_steps, height, width

app = Flask(__name__)

# Global variables for the pipeline and generation parameters
pipe = None
num_inference_steps = 25
height = 384
width = 384

@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json()
    if not data or "prompt" not in data:
        return jsonify({"error": "No prompt provided"}), 400

    prompt = data["prompt"]
    try:
        # Generate the image with the specified parameters
        image = pipe(
            prompt, 
            height=height, 
            width=width, 
            num_inference_steps=num_inference_steps
        ).images[0]

        # Save the image to a bytes buffer
        img_io = io.BytesIO()
        image.save(img_io, "PNG")
        img_io.seek(0)
        return send_file(img_io, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def main():
    parser = argparse.ArgumentParser(description="Stable Diffusion API")
    parser.add_argument(
        '--optimize-mac', 
        action='store_true', 
        help='Optimize model and parameters for Apple Silicon (M2/M3)'
    )
    args = parser.parse_args()

    global pipe, num_inference_steps, height, width
    pipe, num_inference_steps, height, width = load_pipeline(args.optimize_mac)

    # Run the Flask app
    app.run(host="0.0.0.0", port=5003)

if __name__ == "__main__":
    main()