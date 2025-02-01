import { useState } from 'react';

interface AudioRecordingHook {
  recording: boolean;
  processing: boolean;
  audioData: string | null;
  transcription: string | null;
  toggleRecording: () => Promise<void>;
}

export const useAudioRecording = (): AudioRecordingHook => {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);

  const sendAudioToWhisper = async (audioData: string) => {
    try {
      // Convert base64 audio data to blob
      const base64Data = audioData.split(',')[1];
      const blobData = await fetch(audioData).then(res => res.blob());
      
      // Create form data
      const formData = new FormData();
      formData.append('audio', blobData, 'recording.wav');

      // Send to server endpoint
      const response = await fetch('http://localhost:3002/transcribe', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.transcription;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          setAudioData(base64data);
          setProcessing(true);
          const result = await sendAudioToWhisper(base64data);
          setTranscription(result);
          setProcessing(false);
          console.log('Transcription:', result);
        };

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(mediaRecorder);
      mediaRecorder.start();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const toggleRecording = async () => {
    if (!recording) {
      await startRecording();
      setRecording(true);
    } else {
      mediaRecorder?.stop();
      setRecording(false);
    }
  };

  return {
    recording,
    processing,
    audioData,
    transcription,
    toggleRecording
  };
}; 