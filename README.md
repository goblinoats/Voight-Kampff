<img src="./vk.png" width="300" alt=""/>

[Learn more about using this tool](./ABOUT.md)

# Installation & Setup Instructions

## 1. Install Required Components

### Ollama Setup
1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Install the DeepSeek model:
```bash
ollama pull deepseek-r1:32b
```

### Stable Diffusion Setup
1. Create and activate a Python virtual environment:
```bash
python3.11 -m venv sd-env
source sd-env/bin/activate
```

2. Install dependencies:
```bash
cd python/stable-diffusion
pip install -r requirements.txt
```

3. Launch Stable Diffusion:
  - For Mac users:
```bash
./launch.sh --optimize-mac
```
- For other platforms:
```bash
./launch.sh
```

> **Note**: Alternatively, you can use the Docker container version of Stable Diffusion by uncommenting it in the docker-compose file, but be aware this method is significantly slower.

## 2. Deploy Services

Run the development environment with hot reload enabled:
```bash
NODE_ENV=development DEVELOPMENT_MODE=hotreload bash -x ./scripts/bash/build_and_deploy_services.sh
```

This command will:
- Build the base Docker image
- Set up all required services
- Enable hot reloading for development

The service will be running on [http://localhost:80](http://localhost:80)

# Contributing

I welcome contributions, especially in the area of prompt engineering. The effectiveness of this tool heavily depends on a well-crafted prompts to guide the model.

## Prompt Engineering

If you'd like to help improve the system prompts:

1. Test different prompt variations with the DeepSeek model
2. Document your findings and improvements
3. Submit a PR with your suggested changes

