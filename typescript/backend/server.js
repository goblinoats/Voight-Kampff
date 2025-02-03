import express from 'express';
import cors from 'cors';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { join, dirname } from 'path'
import { fileURLToPath } from 'url';
import { Readable } from 'stream';


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

const prompt_pretext = `
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
First image prompt [[A sunset on jupiter]]
Objective description: Grainy patterns, texture. Bands of blue, orange, and purple. The center band is distorted, warbly. There is a black area in the bottom right corner.
Subjective description: Looks like the iOS wallpaper. Makes me think of the future, space and technology. The graininess added to it gives it that 90s feel like Sony branding. A kind of slick cool futureness.


WARNING: MAKE SURE THE IMAGE PROMPT IS WRAPPED IN DOUBLE BRACKETS. YOU WILL LOSE THE GAME IF IT IS NOT WRAPPED IN DOUBLE BRACKETS LIKE [[image prompt]]
WARNING: THE IMAGE PROMPT SHOULD BE SHORT AND SUCCINCT WITH LIMITED USE OF ADJECTIVES AND LONG DESCRIPTORS.
`

app.get('/test', (req, res) => {
  const stream = generateDeepseekText(prompt_pretext);
    
  // Pipe the stream to standard output
  stream.on('data', (data) => {
    process.stdout.write(data); // Output to standard output
  });

  stream.on('end', () => {
    // res.send("Check your console for the response!");
  });

  stream.on('error', (err) => {
    console.error("Stream error:", err);
    // res.status(500).send("Error processing the request.");
  });

  res.send("Check your console for the response!");
});

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://0.0.0.0:11434";
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
const apiUrl = 'http://localhost:5003/generate';
const prompt = 'A sunset on Jupiter';

app.get('/diffusion', (req, res) => {
  // Send a POST request with the prompt
  axios.post(apiUrl, { prompt }, { responseType: 'arraybuffer' })
    .then((response) => {
      // Define the output file path
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const outputPath = join(__dirname, 'output.png');

      // Write the binary data to the file
      fs.writeFileSync(outputPath, response.data);
      console.log(`Image saved to ${outputPath}`);
      res.send('success');
    })
    .catch((error) => {
      console.error('Error generating image:', error.response ? JSON.stringify(error.response.data) : error.message);
      const errorMessage = error.response ? error.response.data.toString() : error.message; // Convert Buffer to string
      res.status(500).send(errorMessage); // Send the error message as response
    });
})


const PORT = 3002;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
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