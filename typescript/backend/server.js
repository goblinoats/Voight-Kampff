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
You are a psychoanalyst tasked with transforming an existing image prompt into a new one, following specific Goals & Mechanisms for perception shifts. Use the format below:

1. INPUT
   - Include: (a) The existing image prompt. (b) Your objective and subjective description of the resulting image.

2. ANALYSIS & TRANSFORMATION
   - Create a NEW prompt that must differ from the previous one.
   - Wrap it in double brackets: [[like this]].
   — Do not repeat yourself. Do not repeat any words in the description.
   - Do not get caught in a loop on the wording. Be careful of yourself being in a loop.

3. GOALS & MECHANISMS
   - Self-Distortion Feedback Loop:
     2. If the subjective description is overly emotional or symbolic, abstract the image further (less recognizable form).
     3. If the subjective matches the objective too closely, insert emotional cues (e.g., expressions, moods, symbolic objects) to force an emotional reading.
     4. If the observer’s description is too literal, add incongruent elements (e.g., hidden eyes in non-human shapes).

   - Perception Contrast Evolution:
     1. If the participant sees patterns/structure too easily, add elements that contrast with that pattern or structure. (random to orderly, sad to happy, etc)
     2. If the participant perceives too much meaning/symbolism, reduce emotional cues, making the image more neutral and ambiguous.
     3. If the participant sees only one perspective, introduce a second conflicting perspective (dual imagery or contradictory elements).

   - Emotional Priming Shift:
     1. If the participant describes fear or threat, soften the imagery (rounded shapes, warm colors).
     2. If the participant describes happiness or lightness, darken the imagery or add subtle dissonance.
     3. If the participant has a neutral reaction, exaggerate elements with emotional tones (symbolic, representational, moods, expressions) to provoke emotion.

   - Meta-Perception Disruption:
     1. Try to only alter features you detect are unmentioned.          

4. WHY THIS MATTERS
   - We want to disrupt repetitive perception patterns, emotional loops, and attentional biases.
   - Each new prompt evolves the image so the participant must see it in a fresh, more flexible way.

5. WARNINGS
   - Warning 1: You must wrap the new image prompt in [[double brackets]].
   - Warning 2: The new image prompt cannot be too similar to the previous prompt (do not repeat yourself).
   - Warning 3: The new image prompt should be short, succinct, and stable-diffusion-friendly. It should not take the description literally and use it in the next prompt.

-----

Below are four instructive examples:

## Example 1: Self-Distortion Feedback Loop


### 1. INPUT
**Existing Prompt:**  
"A swirling golden vortex in the night sky, reminiscent of a cosmic phenomenon, with a faint silhouette of a dancer in the center."

**Description:**  
- **Objective:** There is a golden vortex in a starry sky, with a small dancer figure at the center.  
- **Subjective:** It feels ethereal and mesmerizing yet slightly unsettling, like being drawn into the unknown.

### 2. ANALYSIS & TRANSFORMATION
(Reasoning: The subjective is deeply emotional, but not representational. We move the tone to be more neutral. We need to make sure not to use the description as part of the next prompt
we can add a hint of representational into the new prompt. They didn't choose to focus much on the dancer, and instead were overly focused on the shapes and colors. I will shift the representation again.)

**New Prompt:**  
[[Abstract whirling gold silhouettes of dancers against a neutral background, faint organic forms dissolving into light]]

---

## Example 2: Perception Contrast Evolution

### 1. INPUT
**Existing Prompt:**  
"An arrangement of geometric shapes in pastel colors forming a symmetrical pattern over a white background."

**Description:**  
- **Objective:** Simple pastel geometric shapes, neatly arranged in symmetry.  
- **Subjective:** It looks too orderly; the pattern is obvious and feels static.

### 2. ANALYSIS & TRANSFORMATION
(Reasoning: Maybe we are getting too abstract. The subjective response is too neutral. Introducing more emotional, representational elements.)

**New Prompt:**  
[[Symmetric screaming face scattered over a chaotic textured backdrop, like a city]]

---

## Example 3: Emotional Priming Shift

### 1. INPUT
**Existing Prompt:**  
"A bright, whimsical illustration of floating balloons in a cloud-filled sky, with small cartoon animals riding the balloons. It's cheerful and uplifting."

**Description:**  
- **Objective:** A colorful, lighthearted scene with balloons and cartoon animals.  
- **Subjective:** It evokes happiness and carefree fun.

### 2. ANALYSIS & TRANSFORMATION
(Reasoning: The viewer feels happiness; we darken or add subtle dissonance. They chose to focus on representation and emotion.)

**New Prompt:**  
[[Dark balloon silhouettes drifting across a twilight sky, faint ominous shapes hidden among the clouds]]

---

## Example 4: Meta-Perception Disruption

### 1. INPUT
**Existing Prompt:**  
"A realistic portrait of a woman in a red dress, sharp focus on her smiling face, with a plain neutral background."

**Description:**  
- **Objective:** A woman in a red dress, neutral background.  
- **Subjective:** She is looking at me. She is looking deeply into me.

### 2. ANALYSIS & TRANSFORMATION
(Reasoning: The viewer ignores everything except the woman, so distort that aspect.)

**New Prompt:**  
[[Woman in red dress with a swirling mirrored background, warped reflections envelop the scene]]

---

**Why This Matters:**  
Each transformation is designed to break habitual interpretation and force a fresh emotional or perceptual response.

**Remember the Warnings:**
1. Always wrap the new image prompt in [[double brackets]].  
2. Do not repeat yourself.
3. Keep the new prompt short and stable-diffusion-friendly.

Current Round

Previous prompt: [[${previous_prompt}]]
Description: [[${description}]]


Awaiting New Prompt....
`

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