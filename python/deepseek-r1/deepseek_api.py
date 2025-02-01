import os
import torch
import logging
import threading
import time
from fastapi import FastAPI
from starlette.responses import StreamingResponse
from pydantic import BaseModel

# Import AutoGPTQ’s model class and configuration
from auto_gptq import AutoGPTQForCausalLM, BaseQuantizeConfig
from transformers import AutoTokenizer, TextIteratorStreamer

# --- Optimize CPU usage ---
os.environ["OMP_NUM_THREADS"] = "6"
os.environ["MKL_NUM_THREADS"] = "6"
os.environ["NUMEXPR_NUM_THREADS"] = "6"
torch.set_num_threads(6)
torch.set_num_interop_threads(6)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

print("Loading tokenizer and quantized model...")

# Load the tokenizer as usual.
tokenizer = AutoTokenizer.from_pretrained("./DeepSeek-R1-Distill-Llama-8B")

# Set up the quantization configuration.
# Here we use 4 bits as an example; you might experiment with 8 bits if that’s closer to Ollama’s quantization.
quantize_config = BaseQuantizeConfig(
    bits=4,             # Use 4-bit quantization (adjust if you want 8-bit)
    group_size=128,     # Typical group size for GPTQ quantization
    desc_act=False      # Whether to quantize activations; usually False for inference
)

# Load the model using AutoGPTQ.
# Note: The `model_dir` parameter should point to the directory where the model files are stored.
model = AutoGPTQForCausalLM.from_pretrained(
    "./DeepSeek-R1-Distill-Llama-8B",
    model_dir="./DeepSeek-R1-Distill-Llama-8B",
    use_safetensors=True,         # Use safetensors if your model files are in that format
    quantize_config=quantize_config,
    device="cpu"                  # Force model to run on CPU
)
print("Quantized model loaded successfully.")

class Prompt(BaseModel):
    prompt: str

@app.post("/generate")
async def generate_text(prompt: Prompt):
    try:
        logger.info("Received prompt: %s", prompt.prompt)
        # Prepare inputs on CPU
        inputs = tokenizer(prompt.prompt, return_tensors="pt").to("cpu")
        logger.info("Inputs prepared, starting generation...")
        
        start_time = time.time()
        outputs = model.generate(**inputs, max_length=100)
        end_time = time.time()
        logger.info("Generation complete in %.2f seconds.", end_time - start_time)
        
        generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        return {"generated_text": generated_text}
    except Exception as e:
        logger.exception("Error during text generation:")
        return {"error": str(e)}

@app.post("/generate_stream")
async def generate_text_stream(prompt: Prompt):
    inputs = tokenizer(prompt.prompt, return_tensors="pt").to("cpu")
    streamer = TextIteratorStreamer(tokenizer, skip_prompt=True)
    generation_kwargs = dict(
        inputs=inputs,
        streamer=streamer,
        max_new_tokens=100,
    )
    thread = threading.Thread(target=model.generate, kwargs=generation_kwargs)
    thread.start()
    return StreamingResponse(streamer, media_type="text/plain")