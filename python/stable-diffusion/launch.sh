#!/bin/bash

# Set default variables
PORT=5003
OPTIMIZE_MAC=true
PYTHON_ENV="sd-env"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-mac-optimize)
            OPTIMIZE_MAC=false
            shift
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --env)
            PYTHON_ENV="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--no-mac-optimize] [--port PORT] [--env PYTHON_ENV]"
            exit 1
            ;;
    esac
done

# Activate the Python virtual environment
source "$PYTHON_ENV/bin/activate" || {
    echo "Failed to activate Python environment '$PYTHON_ENV'"
    echo "Make sure it exists and is properly set up"
    exit 1
}

# Build the command with appropriate flags
CMD="python3.11 api.py"
if [ "$OPTIMIZE_MAC" = true ]; then
    CMD="$CMD --optimize-mac"
fi

# Run the API
echo "Starting Stable Diffusion API..."
echo "Running command: $CMD"
$CMD

echo "Stable Diffusion API is running at http://localhost:$PORT"
