#!/usr/bin/env bash
set -euo pipefail

############################################################
# README
############################################################

# This script is the main file to build, run, and deploy the latest version of 
# the Speakeasy project locally, on staging, and on production.
#
# The script is designed to run Speakeasy in two environments.
# 
# 1. "development" environment (= `localhost`)
# 
#   a. "standard" mode (build and run every time)
#
#      ```
#      $ NODE_ENV=development bash -x ./build_and_deploy_services.sh
#      ```
#
#   b. "hotreload" mode (build once, run once, automatically reloads on file changes)
#
#      ```
#      $ NODE_ENV=development DEVELOPMENT_MODE=hotreload bash -x ./build_and_deploy_services.sh
#      ```
#
# 2. "staging" environment 
#
#    ```
#    $ NODE_ENV=staging bash -x ./build_and_deploy_services.sh
#    ```
# 
# The only arguments you SHOULD pass to the script are:
# 
# 1. the `NODE_ENV` environment variable to specify the environment you want to run
# 2. the `DEVELOPMENT_MODE` environment variable to specify the mode you want to run (optional, defaults to "standard")
#
# If no argument is provided, the script will default to "development" and "standard" mode.

############################################################
# Global variables
############################################################

# Reads environment variable if available, otherwise uses default "development"
NODE_ENV=${NODE_ENV:-"development"}
echo "NODE_ENV: $NODE_ENV"

# Reads DEVELOPMENT_MODE variable if available, otherwise uses default "standard"
DEVELOPMENT_MODE=${DEVELOPMENT_MODE:-"hotreload"}
echo "DEVELOPMENT_MODE: $DEVELOPMENT_MODE"

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
echo "Script directory: $SCRIPT_DIR"

PROJECT_ROOT="$(realpath "$SCRIPT_DIR/../..")"
echo "Project root: $PROJECT_ROOT"

LOG_DIR=''
if [[ "$NODE_ENV" == "staging" || "$NODE_ENV" == "production" ]]; then
    LOG_DIR='/var/log/voight_kampff'
    echo "Log directory: $LOG_DIR"
fi

############################################################
# Development environment
############################################################

function run_hotreload_mode() {
    docker-compose down || true # Stop all Docker containers
    # Omitting cleanup of Docker resources to speed up the process
    # See run_standard_mode for a more thorough cleanup of Docker resources

    # Check if mprocs is installed
    if ! command -v mprocs &> /dev/null
    then
        echo "mprocs could not be found"
        echo "Please install mprocs: https://github.com/pvolok/mprocs"
        exit 1
    fi

    
    rm -rf "$PROJECT_ROOT/tmp" && # Clean up any left over tmp files first
    mkdir -p "$PROJECT_ROOT/tmp" && # Recreate the tmp directory
    echo "Cleaned up and recreated tmp directory ✅" &&

    # Create a temporary mprocs configuration file with .yaml extension
    MPROCS_CONFIG=$(mktemp).yaml
    cat << EOF > "$MPROCS_CONFIG"
    procs:
      libraries:
      base-image:
        cwd: $PROJECT_ROOT
        shell: |
          echo "Building base Docker image..." &&
          docker build -t vk-base:latest -f typescript/Dockerfile.base . &&
          echo "Finished building base Docker image ✅" &&
          touch "$PROJECT_ROOT/tmp/.base-image-complete"
      services:
        cwd: $PROJECT_ROOT/tools/docker
        shell: |
          echo "Waiting for all dependencies to finish..." &&
          while [ ! -f "$PROJECT_ROOT/tmp/.base-image-complete" ]; do sleep 1; done &&
          NODE_ENV=${NODE_ENV} DEVELOPMENT_MODE=${DEVELOPMENT_MODE} docker-compose build --progress plain && # --progress plain gives us a more verbose build output
          echo "Finished building Docker container ✅" &&
          NODE_ENV=${NODE_ENV} DEVELOPMENT_MODE=${DEVELOPMENT_MODE} docker-compose -f docker-compose.yml -f docker-compose.hotreload.yml up
# The closing EOF marker must be at the start of the line (no leading whitespace) for the heredoc 
# to work properly. If we indent the closing EOF, the shell will treat it as part of the 
# literal text rather than the heredoc terminator.
# TODO(Arthur): Consider moving mprocs.config to the project root.
EOF

    # Start all processes using mprocs
    mprocs --config "$MPROCS_CONFIG"

    # Clean up the temporary config file
    rm "$MPROCS_CONFIG"

    # Clean up the tmp directory
    rm -rf "$PROJECT_ROOT/tmp"
}

############################################################
# Helper functions
############################################################

# Function to check if a service is running on a specific port
function check_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1

    echo "Checking $service_name on port $port..."
    while ! nc -z localhost $port; do
        if [ $attempt -ge $max_attempts ]; then
            echo "Error: $service_name is not running on port $port after $max_attempts attempts."
            return 1
        fi
        echo "Attempt $attempt: $service_name is not yet available on port $port. Retrying in 2 seconds..."
        sleep 2
        ((attempt++))
    done
    echo "$service_name is running on port $port ✅"
}

############################################################
# Main entry point
############################################################

if [ "$DEVELOPMENT_MODE" = "hotreload" ]; then
    echo "Running in hotreload mode ✅"
    echo "Running with $NODE_ENV environment variables ✅"
    run_hotreload_mode
elif [ "$DEVELOPMENT_MODE" = "standard" ]; then
    echo "Running in standard mode ✅"
    echo "Running with $NODE_ENV environment variables ✅"
    run_standard_mode
else
    echo "ERROR: Running build_and_deploy_speakeasy.sh in unknown mode: DEVELOPMENT_MODE=$DEVELOPMENT_MODE"
    exit 1
fi
