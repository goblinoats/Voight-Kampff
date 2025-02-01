#!/bin/bash

# Prompt the user for input
echo "Enter your image prompt:"
read prompt

# URL encode the prompt
encoded_prompt=$(printf '%s' "$prompt" | jq -sRr @uri)

# Make the API call and save the response
echo "Generating image..."
curl -X POST \
  http://localhost:5003/generate \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"$prompt\"}" \
  --output "generated_image_$(date +%Y%m%d_%H%M%S).png"

echo "Image saved!"
