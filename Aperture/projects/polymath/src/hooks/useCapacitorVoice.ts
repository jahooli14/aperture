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
    console.log('[Voice Init] initWebSpeech called, isNative:', isNative());
    if (isNative()) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    console.log('[Voice Init] SpeechRecognition available:', !!SpeechRecognition);

    if (!SpeechRecognition) {
      console.warn('[Voice Init] Web Speech API NOT SUPPORTED in this browser');
      alert('Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    console.log('[Voice Init] Creating new SpeechRecognition instance...');

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    console.log('[Voice Init] SpeechRecognition configured, setting up event handlers...');

    recognition.onstart = () => {
      console.log('[Voice EVENT] Recognition started (onstart event)');
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
      console.error('[Voice ERROR]', event.error, '- Will handle in onend');
      // Don't stop on 'no-speech' or 'aborted' - let onend handle restart
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access and try again.');
        isRecordingRef.current = false;
        setIsRecording(false);
      } else if (event.error === 'network') {
        console.error('[Voice] Network error, stopping');
        isRecordingRef.current = false;
        setIsRecording(false);
      }
      // For 'no-speech', 'audio-capture', 'aborted' - let onend restart
    };

    recognition.onend = () => {
      console.log('[Voice ONEND] Recognition ended, isRecording:', isRecordingRef.current);
      // Restart immediately if still recording (handles silence detection)
      if (isRecordingRef.current && recognitionRef.current) {
        try {
          console.log('[Voice ONEND] Restarting immediately...');
          recognitionRef.current.start();
          console.log('[Voice ONEND] ✓ Restart successful');
        } catch (err: any) {
          console.error('[Voice ONEND] ✗ Restart failed:', err.message);
          // If already started, that's fine - continue
          if (!err.message || !err.message.includes('already started')) {
            isRecordingRef.current = false;
            setIsRecording(false);
            alert('Recording stopped unexpectedly. Please try again.');
          }
        }
      } else {
        console.log('[Voice ONEND] Not restarting (isRecording=' + isRecordingRef.current + ')');
      }
    };

    recognitionRef.current = recognition;
    setHasPermission(true);
    console.log('[Voice Init] ✓ Web Speech API initialized successfully');
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
    console.log('[Voice Hook] useCapacitorVoice mounted - timestamp:', Date.now());
    if (!isNative()) {
      console.log('[Voice] Platform is WEB, initializing Web Speech API...');
      initWebSpeech();
    } else {
      console.log('[Voice] Platform is NATIVE, skipping Web Speech API init');
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
