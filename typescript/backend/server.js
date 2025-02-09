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

const prompt_pretext = ({objective, subjective, previous_prompt }) => `
Ok, we're going to play a game. You play a very important role in the game. Here is how it's played.

1. I'm going to give you a prompt that was used to construct an image.
2. I'm also going to give you 
a) My objective description of the resulting image.
b) My subjective emotional experience of the image.

3. You will think and consider the goals of the game.
4. Then based on that thinking, generate a new prompt for constructing a new image. Describe the image prompt like so that it can be easily identified: [[image prompt text]]

Here are the goals of the game:

Self-Distortion Feedback Loop Mechanism: you must alter the image based on the difference between the "observer" and "self" descriptions.
- If the self-description is highly emotional, symbolic, or self-referential, the prompt abstracts the image further (removing recognizable patterns, making it more ambiguous).
- If the self-description is too similar to the objective description, the prompt adds subjective cues (e.g., subtle human features, exaggerated expressions, emotional lighting) to force emotional interpretation.
- If the observer description is too rigidly literal, the prompt injects incongruent elements (e.g., an eye hidden in a non-human shape) to force a more flexible perception.


Goal: Disrupt the participant's default projection patterns by shifting how much "self" they inject into ambiguous stimuli.
  

Perception Contrast Evolution Mechanism: you evolve the image toward the opposite of the participant's perceptual bias.
- If the participant sees order/patterns too easily, the prompt increases randomness, asymmetry, and noise to disrupt pattern recognition (fighting Gestalt Closure Bias).
- If the participant perceives too much meaning/symbolism, the prompt strips meaning away, reducing emotional cues and making the image harder to interpret emotionally.
- If the participant sees only one perspective, the prompt introduces a second conflicting perspective—forcing them to integrate multiple viewpoints.

Example:
- If someone always "sees faces," the prompt attempts to add fractals or geometric randomness.
- If someone sees "chaos and meaninglessness," the prompt subtly adds structure or human-like elements.
  
Goal: Prevent perceptual entrenchment—forcing the brain to see things in new ways rather than reinforcing existing interpretation habits.
  

Emotional Priming Shift Mechanism: you detect emotionally biased descriptions and counteracts them.
- If the participant sees fear/threat → the prompt softens the image (introducing rounded shapes, warm colors).
- If the participant sees happiness/lightness → the prompt darkens the image or introduces subtle dissonance (shadows, unsettling symmetry).
- If the participant has a neutral emotional response → the prompt exaggerates contrasts to provoke an emotional reaction.

Example:
- If a participant describes the image as "dark and oppressive," the AI morphs the structure into something inviting or playful—forcing reappraisal.
- If they describe it as "calm and balanced," the AI introduces minor distortions to subtly dissolve that balance.

Goal: Break emotional reinforcement cycles, preventing habitual emotional priming from dominating perception.
  

Meta-Perception Disruption Mechanism: you alters only the features that were NOT mentioned by the participant.
- If the participant focuses on the center, prompt distorts the edges.
- If the participant fixates on one shape, prompt morphs the surrounding context.
- If the participant ignores colors, prompt shifts the color scheme drastically.

Example:
- If someone describes "a face in the middle," but ignores the background, the AI evolves the background to become more dominant and confusing—forcing a shift in attention.

Goal: Force the participant to expand their focus and engage in a new way of seeing.


How This Breaks Self-Reinforcing Cognitive Loops
- Forces cognitive flexibility—participants can't keep seeing the same thing because you actively disrupts their bias.
- Reduces perceptual rigidity—the you evolution introduces uncertainty where certainty existed before.
- Prevents emotional priming loops—by counteracting automatic emotional associations.
- Disrupts automatic attention patterns—forcing new focus points with meta-perception shifts.
- Tracks perception changes over time—seeing how biases shift with each iteration. 


Let's begin!

Round 1
--
First image prompt [[${previous_prompt}]]
Objective description: ${objective}
Subjective description: ${subjective}


WARNING_1: MAKE SURE THE IMAGE PROMPT IS WRAPPED IN DOUBLE BRACKETS. YOU WILL LOSE THE GAME IF IT IS NOT WRAPPED IN DOUBLE BRACKETS LIKE [[image prompt]]
WARNING_2: THE NEW IMAGE PROMPT SHOULD NOT BE THE SAME AS THE LAST IMAGE PROMPT. YOU DO NOT WANT TO GET STUCK IN A LOOP THEMATICALLY.
WARNING_3: THE IMAGE PROMPT SHOULD BE SHORT AND SUCCINCT. IT IS BEING FED INTO A SMALL STABLE DIFFUSION MODEL. YOU MUST FORMAT THE IMAGE PROMPT APPROPRIATELY.
`

app.get('/generate-img-prompt', (req, res) => {
  const { objective, subjective } = req.query;
  
  if (!objective || !subjective) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const stream = generateDeepseekText(prompt_pretext({ objective, subjective, previous_prompt: lastImagePrompt }));
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
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "deepseek-r1:8b";


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