/**
 * Capacitor-compatible voice recording hook
 * Supports both web (Web Speech API) and native (Capacitor Voice Recorder)
 */

import { useState, useRef, useEffect } from 'react';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { isNative, base64ToBlob } from '../lib/platform';

interface UseCapacitorVoiceOptions {
  onTranscript: (text: string) => void;
  maxDuration?: number; // seconds
  autoSubmit?: boolean;
}

export function useCapacitorVoice({
  onTranscript,
  maxDuration = 30,
  autoSubmit = false
}: UseCapacitorVoiceOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [timeLeft, setTimeLeft] = useState(maxDuration);
  const [hasPermission, setHasPermission] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Web Speech API reference (for web platform)
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);

  /**
   * Initialize Web Speech API (web only)
   */
  const initWebSpeech = () => {
    if (isNative()) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('[Voice] Recognition started (onstart event)');
    };

    recognition.onresult = (event: any) => {
      console.log('[Voice] Got result:', event.results.length);
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptSegment + ' ';
        } else {
          interimTranscript += transcriptSegment;
        }
      }

      setTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error('[Voice] Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access and try again.');
        isRecordingRef.current = false;
        setIsRecording(false);
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.error('[Voice] Stopping due to error:', event.error);
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      console.log('[Voice] Recognition ended (onend event), isRecording:', isRecordingRef.current);
      // Check if we should continue recording using ref (avoids stale closure)
      setTimeout(() => {
        if (isRecordingRef.current && recognitionRef.current) {
          try {
            console.log('[Voice] Restarting speech recognition...');
            recognitionRef.current.start();
          } catch (err: any) {
            console.error('[Voice] Failed to restart recognition:', err);
            // If restart fails and we're supposed to be recording, stop gracefully
            if (err.message && !err.message.includes('already started')) {
              isRecordingRef.current = false;
              setIsRecording(false);
              alert('Recording stopped unexpectedly. Please try again.');
            }
          }
        } else {
          console.log('[Voice] Not restarting (isRecording:', isRecordingRef.current, ')');
        }
      }, 100);
    };

    recognitionRef.current = recognition;
    setHasPermission(true);
  };

  /**
   * Check and request permission for native recording
   */
  const checkNativePermission = async (): Promise<boolean> => {
    try {
      const result = await VoiceRecorder.hasAudioRecordingPermission();
      if (!result.value) {
        const permResult = await VoiceRecorder.requestAudioRecordingPermission();
        setHasPermission(permResult.value);
        return permResult.value;
      }
      setHasPermission(true);
      return true;
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  };

  /**
   * Start recording
   */
  const startRecording = async () => {
    if (isNative()) {
      // Native platform: use Capacitor Voice Recorder
      const permitted = await checkNativePermission();
      if (!permitted) {
        alert('Microphone permission is required for voice recording');
        return;
      }

      try {
        await VoiceRecorder.startRecording();
        setIsRecording(true);
        isRecordingRef.current = true;
        startTimer();
      } catch (error) {
        console.error('Failed to start native recording:', error);
        alert('Failed to start recording. Please try again.');
      }
    } else {
      // Web platform: use Web Speech API
      console.log('[Voice] Starting web speech recognition...');

      if (!recognitionRef.current) {
        console.error('[Voice] Recognition not initialized! This should not happen.');
        alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
        return;
      }

      try {
        setTranscript('');
        console.log('[Voice] Calling recognition.start()...');
        recognitionRef.current.start();
        // Only set recording state AFTER start() succeeds
        setIsRecording(true);
        isRecordingRef.current = true;
        startTimer();
        console.log('[Voice] Recognition.start() called successfully, waiting for onstart event...');
      } catch (error: any) {
        console.error('[Voice] Failed to start web speech:', error);
        // Check if it's an "already started" error
        if (error.message && error.message.includes('already started')) {
          console.log('[Voice] Recognition already started, continuing...');
          setIsRecording(true);
          isRecordingRef.current = true;
          startTimer();
        } else {
          alert(`Failed to start recording: ${error.message}`);
          setIsRecording(false);
          isRecordingRef.current = false;
        }
      }
    }
  };

  /**
   * Stop recording and process
   */
  const stopRecording = async () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    stopTimer();

    if (isNative()) {
      // Native: get audio data and transcribe via API
      try {
        setIsProcessing(true);
        const result = await VoiceRecorder.stopRecording();

        if (!result.value || !result.value.recordDataBase64) {
          throw new Error('No audio data recorded');
        }

        // Convert to blob
        const audioBlob = base64ToBlob(result.value.recordDataBase64, 'audio/aac');

        // Send to transcription API
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.aac');

        console.log('Sending audio to transcription API...');

        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          // Check if response is HTML (API not deployed)
          const contentType = response.headers.get('content-type')
          if (contentType?.includes('text/html')) {
            throw new Error('Transcription API not available. Please check deployment.');
          }
          throw new Error(`Transcription failed: ${response.statusText}`);
        }

        const { text } = await response.json();

        if (!text || text.trim().length === 0) {
          throw new Error('No transcription returned from API');
        }

        setTranscript(text);
        onTranscript(text);

        if (autoSubmit) {
          setTranscript('');
        }
      } catch (error) {
        console.error('Failed to process recording:', error);
        alert('Failed to process recording. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Web: use existing Web Speech API result
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('[Voice] Error stopping recognition:', error);
        }
      }

      if (transcript.trim()) {
        onTranscript(transcript.trim());
        if (autoSubmit) {
          setTranscript('');
        }
      }
    }
  };

  /**
   * Start countdown timer
   */
  const startTimer = () => {
    setTimeLeft(maxDuration);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  /**
   * Stop countdown timer
   */
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeLeft(maxDuration);
  };

  /**
   * Toggle recording on/off
   */
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  /**
   * Initialize Web Speech API on mount for web platform
   */
  useEffect(() => {
    if (!isNative()) {
      console.log('[Voice] Initializing Web Speech API on mount...');
      initWebSpeech();
    }
  }, []); // Run once on mount

  return {
    isRecording,
    transcript,
    timeLeft,
    hasPermission,
    isProcessing,
    startRecording,
    stopRecording,
    toggleRecording
  };
}
