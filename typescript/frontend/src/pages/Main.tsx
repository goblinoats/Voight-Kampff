import {FC, useState, useEffect} from 'react';
import styles from './Main.module.css'
import { useAudioRecording } from '../hooks/useAudioRecording';

interface AudioRecordingHook {
  recording: boolean;
  transcription: string;
  processing: boolean;
  toggleRecording: () => void;
}

const Main: FC = () => {
  const [isOutputExpanded, setIsOutputExpanded] = useState(false);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [outputContent, setOutputContent] = useState<string>('');
  const [thinkingContent, setThinkingContent] = useState<string>('');
  const [currentImage, setCurrentImage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [textInput, setTextInput] = useState<string>('');
  
  const recording = useAudioRecording();

  // Add useEffect for periodic image fetching
  useEffect(() => {
    // Initial fetch
    fetchLatestImage();

    // Set up interval
    const intervalId = setInterval(fetchLatestImage, 5000);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Add effect to update text input when transcription changes
  useEffect(() => {
    if (recording.transcription) {
      setTextInput(recording.transcription);
    }
  }, [recording.transcription]);

  const fetchLatestImage = async () => {
    try {
      console.log('Fetching latest image...');
      const response = await fetch('http://localhost:3002/get-last-image');
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch image:', response.status, response.statusText);
        console.error('Error response body:', errorText);
        return;
      }
      
      const contentType = response.headers.get('content-type');
      console.log('Content type:', contentType);
      
      if (!contentType || !contentType.includes('image')) {
        const errorText = await response.text();
        console.error('Invalid content type received:', contentType);
        console.error('Response body:', errorText);
        return;
      }

      // Create a blob URL from the image data
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      
      // Clean up previous blob URL if it exists
      if (currentImage) {
        URL.revokeObjectURL(currentImage);
      }
      
      setCurrentImage(imageUrl);
    } catch (error) {
      console.error('Error fetching image:', error);
    }
  };

  const handleSubmit = async () => {
    // Use textInput as the source of truth
    if (!textInput) {
      console.error('Must provide text input');
      return;
    }

    try {
      setIsSubmitting(true);
      setIsThinking(true);
      // Don't clear text input here anymore
      // Clear previous output
      setOutputContent('');
      setThinkingContent('');
      
      const response = await fetch(`http://localhost:3002/generate-img-prompt?description=${encodeURIComponent(textInput)}`);
      
      if (!response.ok) throw new Error('Network response was not ok');
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to get stream reader');

      // Ensure output section is expanded
      setIsOutputExpanded(true);
      
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setIsThinking(false);
          break;
        }

        const text = new TextDecoder().decode(value);
        const events = text.split('\n\n');
        
        for (const event of events) {
          if (event.startsWith('data: ')) {
            const data = event.slice(6); // Remove 'data: ' prefix
            if (data === '[DONE]') break;
            
            // Skip if the data starts with a JSON object
            if (data.trim().startsWith('{"model":"deepseek-r1:32b","full_content"')) continue;
            
            accumulatedText += data;
            
            // Check for think tags and split content
            const thinkMatch = accumulatedText.match(/<think>(.*?)<\/think>(.*)/s);
            if (thinkMatch) {
              setThinkingContent(thinkMatch[1].trim());
              setOutputContent(thinkMatch[2].trim());
            } else if (accumulatedText.includes('<think>')) {
              // Still accumulating thinking content
              const thinking = accumulatedText.replace('<think>', '');
              setThinkingContent(thinking.trim());
            } else {
              // No think tags found yet, treat as thinking content
              setThinkingContent(accumulatedText.trim());
            }
          }
        }
      }
    } catch (error) {
      setIsThinking(false);
      console.error('Error generating prompt:', error);
      setOutputContent('Error generating prompt. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        {/* Image display area */}
        <div className={styles.imageContainer}>
          {currentImage ? (
            <img 
              src={currentImage} 
              alt="Generated image" 
              className={styles.generatedImage}
            />
          ) : (
            <div className={styles.imagePlaceholder}>
              Image Display Area
            </div>
          )}
        </div>

        {/* Wrap output and recording sections in controlsContainer */}
        <div className={styles.controlsContainer}>
          {/* Collapsible output sections */}
          <div className={styles.outputSection}>
            {thinkingContent && (
              <div className={styles.thinkingSection}>
                <button 
                  className={`${styles.collapseButton} ${isThinking ? styles.thinking : ''}`}
                  onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                >
                  {isThinkingExpanded ? 'Hide Thinking Process' : 'Show Thinking Process'}
                </button>
                {isThinkingExpanded && (
                  <div className={styles.thinkingContent}>
                    {thinkingContent || 'No thinking process yet'}
                  </div>
                )}
              </div>
            )}
            
            <button 
              className={styles.collapseButton}
              onClick={() => setIsOutputExpanded(!isOutputExpanded)}
            >
              {isOutputExpanded ? 'Hide Output' : 'Show Output'}
            </button>
            {isOutputExpanded && (
              <div className={styles.outputContent}>
                {outputContent || 'No output yet'}
              </div>
            )}
          </div>

          {/* Voice recording section */}
          <div className={styles.recordingSection}>
            <div className={styles.recordingField}>
              <button 
                className={`${styles.recordButton} ${recording.recording ? styles.recording : ''}`}
                onClick={recording.toggleRecording}
              >
                {recording.recording 
                  ? 'Stop Recording' 
                  : recording.processing 
                    ? 'Processing...'
                    : 'Record your description and subjective experience.'}
              </button>
              
              {/* Text input section */}
              <div className={styles.textInputContainer}>
                <textarea
                  className={styles.textInput}
                  placeholder="Your description will appear here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  disabled={recording.recording || recording.processing}
                />
              </div>
            </div>
          </div>

          {/* Submit button */}
          {(textInput) && (
            <button 
              className={styles.submitButton}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
};

export default Main;
