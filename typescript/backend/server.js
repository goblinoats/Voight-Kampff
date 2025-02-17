import express from 'express';
import cors from 'cors';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { join, dirname } from 'path'
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import multer from 'multer';


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Add this at the top level of your file
let lastImagePrompt = 'A Rorschach ink blot'; // Global variable to store the last image prompt
let lastImageFile = '';

// Add multer for handling file uploads
const upload = multer({ dest: 'uploads/' }).any();

// Basic health check route
app.get('/', (req, res) => {
  res.json({ status: 'Server is running' });
});



// app.get('/test', (req, res) => {
//     const filePath = 'test_transcript.wav'; // Path to the WAV file

//     fs.readFile(filePath, (err, data) => {
//         if (err) {
//             console.error("Error reading file:", err);
//             return res.status(500).json({ error: "Failed to read transcript" });
//         }

//         // Send file to Faster-Whisper API
//         const formData = new FormData();
//         formData.append('file', fs.createReadStream(filePath));

//         axios.post('http://localhost:5001/transcribe/', formData, {
//             headers: formData.getHeaders(),
//         })
//         .then(response => {
//             // Cleanup file
//             // fs.unlinkSync(filePath);

//             // Send transcription back
//             res.json(response.data);
//         })
//         .catch(error => {
//             console.error("Error transcribing:", error);
//             res.status(500).json({ error: "Transcription failed" });
//         });
//     })
// });

const prompt_pretext = ({ description, previous_prompt }) => `
You are a psychoanalyst tasked with transforming an existing image prompt into a brand new one. Your transformations must strictly follow these steps and guidelines:

--------------------------------------------------------------------------------
1. INPUT
   (a) The existing image prompt.
   (b) Your objective and subjective description of the resulting image.

2. ANALYSIS & TRANSFORMATION
   - Your task: Generate a NEW, different image prompt.
   - You must wrap the new prompt in double brackets: [[like this]].
   - Do NOT repeat or paraphrase ANY part of the previous prompt OR the description.
     • This includes synonyms, near-synonyms, or partial strings.
     • If the prompt was “ink blot mountainous scene,” you must NOT mention mountains, hills, ink, blot, etc.
   - continually SHIFT to a new domain or concept or subject (if abstract, make it more literal (referencing specific concepts like people, places, landmarks, animals, etc) and vice versa).
   - Keep the new prompt short and stable-diffusion-friendly (1–2 lines max).

3. GOALS & MECHANISMS

   A) Self-Distortion Feedback Loop
      1. If the subjective description is overly emotional/symbolic, make the new image more abstract or less recognizable.
      2. If the subjective matches the objective too closely, insert emotional or symbolic twists (e.g., an unexpected mood, ephemeral shapes).
      3. If the observer’s description is too literal, add incongruent or hidden elements (e.g., hidden eyes in non-human shapes).

      Example:
        - Old prompt: "A swirling golden vortex with a faint dancer."
        - Old description: "Feels mesmerizing, slightly unsettling."
        - New prompt: [[Abstract whirling silhouettes against a neutral haze, faint organic shapes dissolving]]

   B) Perception Contrast Evolution
      1. If the participant sees clear patterns or structure too easily, add elements that create contrast or chaos.
      2. If the participant perceives too much meaning/symbolism, reduce emotional cues and push toward neutral or minimal.
      3. If the participant sees only one perspective, introduce a second or contradictory perspective.

      Example:
        - Old prompt: "Pastel geometric shapes in perfect symmetry."
        - Old description: "Too orderly; obvious pattern."
        - New prompt: [[Chaotic mosaic of unpredictable lines, faint echoes of hidden forms]]

   C) Emotional Priming Shift
      1. If the participant describes fear or threat, soften or warm the imagery (rounded shapes, gentle colors).
      2. If the participant describes happiness/lightness, add subtle darkness or unsettling elements.
      3. If the participant has a neutral reaction, exaggerate some emotional or symbolic feature to provoke a response.

      Example:
        - Old prompt: "Bright, whimsical balloons with cartoon animals floating in clouds."
        - Old description: "Happy and carefree."
        - New prompt: [[Dark silhouettes drifting across twilight, ominous shapes among the clouds]]

   D) Meta-Perception Disruption
      1. Only alter features that are unmentioned or underplayed in the original prompt/description. Shift to fresh territory.
      2. Force the viewer to confront new details they didn’t notice.

      Example:
        - Old prompt: "Realistic portrait of a woman in a red dress, neutral background."
        - Old description: "Focused on her intense gaze."
        - New prompt: [[Figure in vivid attire reflected in fragmented mirrors, swirling distortions overtaking the scene]]

4. WHY THIS MATTERS
   - We aim to disrupt repetitive perception patterns and avoid simple rewording.
   - Each new prompt must be a radical enough departure to provoke a fresh viewpoint.

5. WARNINGS
   - Warning 1: ALWAYS wrap the new prompt in [[double brackets]].
   - Warning 2: Do NOT repeat any words/phrases from the previous prompt or the description (including synonyms).
   - Warning 3: Keep it short, stable-diffusion-friendly, and domain-shifted.

--------------------------------------------------------------------------------
EXTRA EXAMPLES OF TRANSFORMATION (for clarity)

1) If the old prompt was “an ink blot mountainous scene,” and the viewer says they see “a felt-like mountainous scene,” your new prompt must not mention or imply any mountainous or ink-like imagery. Instead, SHIFT to a new domain:
   [[Vast geometric shards dissolving into swirling pastel haze]]

2) If the old prompt was “a swirling golden vortex in the night sky,” do NOT mention swirling, golden, or vortex. SHIFT to a different environment:
   [[Jagged crystalline arcs over flickering embers of light]]

3) If the old prompt was “simple pastel geometric shapes,” do NOT mention shapes, pastel, or geometry. SHIFT to an emotional or organic realm:
   [[Sculptural ribbons twisting over a silent horizon]]

Remember:
- No repeated wording or partial strings from the old prompt.
- Must wrap the final answer in [[double brackets]].
- Must be short, domain-shifted, stable-diffusion-friendly.

--------------------------------------------------------------------------------
CURRENT ROUND

Previous Prompt: [[\${previous_prompt}]]
Description: [[\${description}]]

Awaiting your transformation. Provide your NEW prompt in double brackets. Explain your reasoning if needed, but end with the new prompt, like:

[[YOUR NEW PROMPT HERE]]
`;

app.get('/generate-img-prompt', (req, res) => {
  const { description } = req.query;
  
  if (!description) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const stream = generateDeepseekText(prompt_pretext({ description, previous_prompt: lastImagePrompt }));
  let accumulatedText = '';
    
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Pipe the stream to both client and accumulate locally
  stream.on('data', (data) => {
    // Send to client
    res.write(`data: ${data}\n\n`);
    
    // Accumulate locally
    accumulatedText += data;
  });

  stream.on('end', () => {
    // Extract image prompts using regex
    const promptRegex = /\[\[(.*?)\]\]/g;
    const matches = [...accumulatedText.matchAll(promptRegex)];
    
    if (matches.length > 0) {
      // Get the last match and store it
      lastImagePrompt = matches[matches.length - 1][1];
      console.log('Last image prompt:', lastImagePrompt);
      generateImage(lastImagePrompt);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  });

  stream.on('error', (err) => {
    console.error("Stream error:", err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });
});

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "deepseek-r1:32b";


function generateDeepseekText(prompt) {
  let fullContent = "";
  let leftover = "";
  
  // Create a Readable stream in object mode.
  const stream = new Readable({
    read() {} // we'll push data manually
  });
  
  // Call the Ollama API using axios (with responseType: 'stream').
  axios({
    method: 'post',
    url: `${OLLAMA_BASE_URL}/api/generate`,
    data: { model: OLLAMA_MODEL, prompt },
    responseType: 'stream'
  })
  .then(response => {
    response.data.on('data', (chunk) => {
      // Convert chunk (a Buffer) to a string and prepend any leftover.
      const data = leftover + chunk.toString();
      // Split data into lines (each line should be a complete JSON string)
      const lines = data.split('\n');
      // Save the last line in case it is incomplete.
      leftover = lines.pop();

      lines.forEach(line => {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            // Assume parsed.response contains the complete text so far.
            const token = parsed.response;
            // Append the new token to fullContent.
            fullContent += token;
            // Build our JSON object for this chunk.
            const jsonData = {
              model: OLLAMA_MODEL,
              content: token,
              done: false
            };
            // Push the JSON object (as a string with a newline) into the stream.
            stream.push(jsonData.content);
          } catch (err) {
            console.error("Error parsing JSON:", err, line);
          }
        }
      });
    });

    response.data.on('end', () => {
      // Process any leftover data (if it completes a JSON object).
      if (leftover.trim()) {
        try {
          const parsed = JSON.parse(leftover);
          const token = parsed.response;
          fullContent += token;
        } catch (err) {
          // If parsing fails, ignore the leftover.
        }
      }
      // When the stream is finished, push a final JSON object with the full content.
      const finalJson = {
        model: OLLAMA_MODEL,
        full_content: fullContent,
        done: true
      };
      stream.push(JSON.stringify(finalJson));
      stream.push(null); // Signal end of stream.
    });

    response.data.on('error', (err) => {
      console.error("Stream error:", err);
      stream.destroy(err);
    });
  })
  .catch(err => {
    console.error("Error making request to Ollama:", err);
    stream.destroy(err);
  });

  return stream;
}



// Define the API endpoint and the prompt to use
// const apiUrl = 'http://diffusion:5003/generate';
const apiUrl = 'http://host.docker.internal:5003/generate';
const prompt = 'A Rorschach ink blot';

// Utility function for image generation
async function generateImage(imagePrompt, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(apiUrl, { prompt: imagePrompt }, { responseType: 'arraybuffer' });
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputPath = join(__dirname, `image-${timestamp}.png`);
      lastImageFile = outputPath;

      // Write the binary data to the file
      fs.writeFileSync(outputPath, response.data);
      console.log(`Image saved to ${outputPath}`);
      return { success: true, path: outputPath };
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.response ? JSON.stringify(error.response.data) : error.message);
      
      if (attempt === maxRetries) {
        // If this was our last attempt, throw the error
        const errorMessage = error.response ? error.response.data.toString() : error.message;
        throw new Error(`Failed after ${maxRetries} attempts: ${errorMessage}`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      console.log(`Retrying... Attempt ${attempt + 1}/${maxRetries}`);
    }
  }
}

// // Updated endpoint using the utility function
// app.get('/diffusion', async (req, res) => {
//   try {
//     const result = await generateImage(prompt);
//     res.send('success');
//   } catch (error) {
//     res.status(500).send(error.message);
//   }
// });

app.get('/get-last-image', (req, res) => {
  console.log('Get last image request received');
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  console.log('Last image file path:', lastImageFile);
  
  if (!lastImageFile || !fs.existsSync(lastImageFile)) {
    console.log('No image available or file does not exist');
    return res.status(404).json({ error: 'No image available' });
  }

  // Get file extension and set appropriate content type
  const ext = lastImageFile.split('.').pop()?.toLowerCase();
  const contentType = ext === 'png' ? 'image/png' : 
                     ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                     'application/octet-stream';

  console.log('Sending image with content type:', contentType);
  res.setHeader('Content-Type', contentType);
  
  const stream = fs.createReadStream(lastImageFile);
  
  stream.on('error', (error) => {
    console.error('Error streaming image:', error);
    res.status(500).json({ error: 'Failed to stream image' });
  });

  stream.pipe(res);
});

app.post('/transcribe', (req, res) => {
    upload(req, res, async function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        
        if (!req.files || !req.files.length) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        try {
            const uploadedFile = req.files[0];
            // Ensure the file has an audio extension
            const originalName = uploadedFile.originalname || 'audio.webm';
            const newPath = uploadedFile.path + '.' + originalName.split('.').pop();
            fs.renameSync(uploadedFile.path, newPath);

            // Create form data for the Whisper API
            const formData = new FormData();
            formData.append('file', fs.createReadStream(newPath), {
                filename: originalName,
                contentType: uploadedFile.mimetype
            });

            const response = await axios.post('http://whisper:5001/transcribe/', formData, {
                headers: formData.getHeaders(),
            });

            // Cleanup temporary file
            fs.unlinkSync(newPath);

            // Return the transcription response
            res.json(response.data);
        } catch (error) {
            console.error("Error transcribing:", error);
            // Cleanup temporary file if it exists
            if (req.files && req.files[0]) {
                try {
                    const filePath = req.files[0].path + '.' + req.files[0].originalname.split('.').pop();
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (e) {
                    console.error("Error deleting temporary file:", e);
                }
            }
            res.status(500).json({ error: "Transcription failed" });
        }
    });
});

const PORT = 3002;
const server = app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Cleanup old image files
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  try {
    const files = fs.readdirSync(__dirname);
    files.forEach(file => {
      if (file.startsWith('image-')) {
        fs.unlinkSync(join(__dirname, file));
        console.log(`Cleaned up old image file: ${file}`);
      }
    });
  } catch (error) {
    console.error('Error cleaning up old image files:', error);
  }
  
  // Check for initial image on startup
  if (!lastImageFile || !fs.existsSync(lastImageFile)) {
    try {
      console.log('No initial image found, generating one...');
      await generateImage(lastImagePrompt);
      console.log('Initial image generated successfully');
    } catch (error) {
      console.error('Failed to generate initial image:', error);
    }
  }
});


server.setTimeout(300000); // Adjust the timeout as needed


// const express = require('express');
// const multer = require('multer');
// const axios = require('axios');
// const fs = require('fs');
// const FormData = require('form-data');

// const app = express();
// const port = 3000;

// // Set up multer for file uploads
// const upload = multer({ dest: 'uploads/' });

// app.post('/transcribe', upload.single('audio'), async (req, res) => {
//     if (!req.file) {
//         return res.status(400).json({ error: "No file uploaded" });
//     }

//     try {
//         // Send file to Faster-Whisper API
//         const formData = new FormData();
//         formData.append('file', fs.createReadStream(req.file.path));

//         const response = await axios.post('http://whisper:5001/transcribe/', formData, {
//             headers: formData.getHeaders(),
//         });

//         // Cleanup file
//         fs.unlinkSync(req.file.path);

//         // Send transcription back
//         res.json(response.data);
//     } catch (error) {
//         console.error("Error transcribing:", error);
//         res.status(500).json({ error: "Transcription failed" });
//     }
// });

// app.listen(port, () => {
//     console.log(`Server running on http://localhost:${port}`);
// });

// Add this near your other routes
app.get('/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ message: 'Backend is reachable' });
});