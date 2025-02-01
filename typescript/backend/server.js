import express from 'express';
import cors from 'cors';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { join, dirname } from 'path'
import { fileURLToPath } from 'url';

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

//Ok, it just expects I'm running the model locally, I'm not fucking with docker
function generateDeepseekText(prompt, onSuccess, onError) {
  axios.post('http://127.0.0.1:11434/api/generate', { 
    model: "deepseek-r1:8b", 
    prompt 
  })
    .then(response => {
      onSuccess(response.data);
    })
    .catch(error => {
      onError(error);
    });
}

app.get('/test', (req, res) => {
  // Example usage:
  generateDeepseekText("Explain quantum mechanics in simple terms", 
    (data) => {
      res.json(data);
    }, 
    (error) => {
      res.status(500).json({ error });
  });
});


// Define the API endpoint and the prompt to use
const apiUrl = 'http://localhost:5003/generate';
const prompt = 'A sunset on the planet Jupiter';

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
      res.status(500).send('error');
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