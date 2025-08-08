'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

import { AlertTriangle, Eye, EyeOff, Camera, CameraOff, Mic, Users, Move3D, PersonStanding } from 'lucide-react';
import Toast from './Toast';

// MediaPipe imports
declare global {
  interface Window {
    FaceLandmarker: any;
    FaceDetector: any;
    PoseLandmarker: any;
    FilesetResolver: any;
  }
}

interface ProctorEvent {
  type: 'face_not_detected' | 'multiple_faces' | 'looking_away' | 'head_movement' | 'pose_change' | 'suspicious_activity';
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
  data: any;
}

interface MediaPipeProctorProps {
  sessionId: string;
  onEventDetected: (event: ProctorEvent) => void;
  enabled?: boolean;
  sensitivity?: 'low' | 'medium' | 'high';
  autoStart?: boolean;
  enableBackgroundAudioDetection?: boolean;
}

export default function MediaPipeProctor({
  sessionId,
  onEventDetected,
  enabled = true,
  sensitivity = 'medium',
  autoStart = false,
  enableBackgroundAudioDetection = false
}: MediaPipeProctorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // MediaPipe instances
  const [faceLandmarker, setFaceLandmarker] = useState<any>(null);
  const [faceDetector, setFaceDetector] = useState<any>(null);
  const [poseLandmarker, setPoseLandmarker] = useState<any>(null);
  
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentEvents, setCurrentEvents] = useState<ProctorEvent[]>([]);
  const [videoState, setVideoState] = useState({ playing: false, dimensions: { width: 0, height: 0 } });
  const [pendingStream, setPendingStream] = useState<MediaStream | null>(null);
  
  // Monitoring state
  const [faceBaseline, setFaceBaseline] = useState<any>(null);
  const [poseBaseline, setPoseBaseline] = useState<any>(null);
  const lastFrameTime = useRef<number>(0);
  const eventCooldowns = useRef<Map<string, number>>(new Map());
  const driftFramesRef = useRef<number>(0);
  const facingOkRef = useRef<boolean>(true);
  const noFaceFramesRef = useRef<number>(0);
  const monitoringStartTimeRef = useRef<number>(0);
  // Audio/VAD state
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Float32Array | null>(null);
  const audioIntervalRef = useRef<number | null>(null);
  const audioBaselineRef = useRef<number>(0);
  const audioBaselineSamplesRef = useRef<number>(0);
  const lastMouthGapRef = useRef<number>(0);
  const [audioState, setAudioState] = useState<'idle' | 'running' | 'suspended' | 'error'>('idle');
  // Toast state
  const [toast, setToast] = useState<{ show: boolean; title: string; desc: string; emoji: string }>({ show: false, title: '', desc: '', emoji: '' });
  const toastTimerRef = useRef<number | null>(null);

  const ensureAudioRunning = useCallback(async () => {
    try {
      if (audioContextRef.current && audioContextRef.current.state !== 'running') {
        await audioContextRef.current.resume();
        setAudioState(audioContextRef.current.state as any);
      }
    } catch (e) {
      console.warn('Audio resume failed:', e);
      setAudioState('error');
    }
  }, []);

  // Load MediaPipe scripts
  useEffect(() => {
    const loadMediaPipeScripts = async () => {
      setIsLoading(true);
      try {
        // Check if MediaPipe is already loaded
        if (window.FilesetResolver) {
          console.log('MediaPipe already loaded');
          initializeMediaPipe();
          return;
        }

        // Import MediaPipe from the npm package
        const mediapipeModule = await import('@mediapipe/tasks-vision');
        
        // Expose the imported objects on window for compatibility
        window.FilesetResolver = mediapipeModule.FilesetResolver;
        window.FaceLandmarker = mediapipeModule.FaceLandmarker;
        window.FaceDetector = mediapipeModule.FaceDetector;
        window.PoseLandmarker = mediapipeModule.PoseLandmarker;
        
        console.log('MediaPipe modules imported successfully');
        initializeMediaPipe();
      } catch (err) {
        console.error('Error loading MediaPipe:', err);
        setError(`Error loading MediaPipe: ${err}`);
        setIsLoading(false);
      }
    };

    if (enabled && !isInitialized) {
      loadMediaPipeScripts();
    }

    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [enabled, isInitialized]);

  // Handle video setup when element becomes available
  useEffect(() => {
    if (pendingStream && videoRef.current && isMonitoring) {
      console.log('🎬 Video element is now available, setting up stream...');
      setupVideoStream(pendingStream);
      setPendingStream(null);
    }
  }, [pendingStream, isMonitoring]);

  // Auto-start monitoring when requested and initialized
  useEffect(() => {
    if (autoStart && isInitialized && !isMonitoring) {
      startMonitoring();
    }
  }, [autoStart, isInitialized]);

  // Setup video stream
  const setupVideoStream = async (stream: MediaStream) => {
    if (!videoRef.current) {
      console.error('❌ Video ref not available in setupVideoStream');
      return;
    }

    console.log('✅ Setting up video stream');
    
    // Set the stream
    videoRef.current.srcObject = stream;
    streamRef.current = stream;
    
    console.log('🎬 Video element srcObject set');

    // Set up video event handlers
    const setupVideoHandlers = () => {
      if (!videoRef.current) return;

      videoRef.current.onloadedmetadata = async () => {
        console.log('📊 Video metadata loaded');
        if (videoRef.current) {
          try {
            await videoRef.current.play();
            console.log('▶ Video playback started successfully');
            startAnalysis();
            setIsLoading(false);
          } catch (playError) {
            console.error('❌ Video play error:', playError);
            setError('Failed to start video playback. Click to allow autoplay.');
          }
        }
      };

      videoRef.current.oncanplay = () => {
        console.log('✅ Video can play');
      };

      videoRef.current.onplaying = () => {
        console.log('🎥 Video is playing');
        setVideoState(prev => ({ ...prev, playing: true }));
        setIsLoading(false);
      };

      videoRef.current.onloadeddata = () => {
        console.log('📋 Video data loaded');
        if (videoRef.current) {
          setVideoState(prev => ({ 
            ...prev, 
            dimensions: { 
              width: videoRef.current!.videoWidth, 
              height: videoRef.current!.videoHeight 
            }
          }));
        }
      };

      videoRef.current.onerror = (err) => {
        console.error('❌ Video error:', err);
        setError('Video playback error occurred.');
        setIsLoading(false);
      };

      videoRef.current.onpause = () => {
        console.log('⏸ Video paused');
        setVideoState(prev => ({ ...prev, playing: false }));
      };
    };

    setupVideoHandlers();

    // Try to play immediately (fallback)
    try {
      await videoRef.current.play();
      console.log('▶ Immediate play successful');
      startAnalysis();
      setIsLoading(false);
    } catch (immediatePlayError) {
      console.log('⚠ Immediate play blocked (normal), waiting for user interaction or metadata load');
      // This is normal - autoplay might be blocked
    }
  };

  // Initialize MediaPipe models
  const initializeMediaPipe = async () => {
    try {
      if (!window.FilesetResolver) {
        throw new Error('MediaPipe not loaded');
      }

      console.log('Initializing MediaPipe models...');
      
      const vision = await window.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      console.log('Vision tasks resolver initialized');

      // Initialize Face Landmarker for detailed facial analysis
      try {
        const faceLandmarkerInstance = await window.FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU', // Use CPU instead of GPU for better compatibility
          },
          outputFaceBlendshapes: false, // Disable to reduce complexity
          outputFacialTransformationMatrixes: false, // Disable to reduce complexity
          runningMode: 'VIDEO',
          numFaces: 3 // Reduce from 5 to 3 for better performance
        });
        setFaceLandmarker(faceLandmarkerInstance);
        console.log('Face Landmarker initialized');
      } catch (err) {
        console.warn('Face Landmarker failed to initialize:', err);
      }

      // Initialize Face Detector for basic face detection
      try {
        const faceDetectorInstance = await window.FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'CPU', // Use CPU for better compatibility
          },
          runningMode: 'VIDEO'
        });
        setFaceDetector(faceDetectorInstance);
        console.log('Face Detector initialized');
      } catch (err) {
        console.warn('Face Detector failed to initialize:', err);
      }

      // Initialize Pose Landmarker for body pose detection
      try {
        const poseLandmarkerInstance = await window.PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'CPU', // Use CPU for better compatibility
          },
          runningMode: 'VIDEO',
          numPoses: 1 // Reduce from 2 to 1 for better performance
        });
        setPoseLandmarker(poseLandmarkerInstance);
        console.log('Pose Landmarker initialized');
      } catch (err) {
        console.warn('Pose Landmarker failed to initialize:', err);
      }

      setIsInitialized(true);
      setIsLoading(false);
      
      console.log('MediaPipe models initialization completed');
    } catch (err) {
      console.error('MediaPipe initialization error:', err);
      setError(`Failed to initialize MediaPipe: ${err}`);
      setIsLoading(false);
    }
  };

  // Start camera and monitoring
  const startMonitoring = async () => {
    try {
      console.log('🚀 Starting camera monitoring...');
      setError(null);
      setIsLoading(true);

      // Request camera access first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: enableBackgroundAudioDetection
      });

      console.log('✅ Camera access granted, stream active:', stream.active);
      console.log('📹 Video tracks:', stream.getVideoTracks().length);

      // If background audio detection is enabled, set up WebAudio VAD
      if (enableBackgroundAudioDetection) {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 2048;
          analyser.smoothingTimeConstant = 0.8;
          source.connect(analyser);
          audioContextRef.current = audioContext;
          analyserRef.current = analyser;
          audioDataRef.current = new Float32Array(analyser.fftSize);

          // Try to start audio processing immediately; if suspended, attach a one-time user-gesture resume
          try {
            await audioContext.resume();
          } catch {}
          setAudioState(audioContext.state as any);
          if (audioContext.state !== 'running') {
            const resumeOnUserGesture = async () => {
              await ensureAudioRunning();
              document.removeEventListener('click', resumeOnUserGesture);
              document.removeEventListener('touchstart', resumeOnUserGesture);
              document.removeEventListener('keydown', resumeOnUserGesture);
            };
            document.addEventListener('click', resumeOnUserGesture, { once: true });
            document.addEventListener('touchstart', resumeOnUserGesture, { once: true });
            document.addEventListener('keydown', resumeOnUserGesture, { once: true });
          }

          // Periodic audio analysis (~10 Hz)
          const intervalMs = 100;
          audioIntervalRef.current = window.setInterval(() => {
            if (!analyserRef.current || !audioDataRef.current) return;
            analyserRef.current.getFloatTimeDomainData(audioDataRef.current);

            // Compute RMS
            let sumSquares = 0;
            const buf = audioDataRef.current;
            for (let i = 0; i < buf.length; i++) {
              const v = buf[i];
              sumSquares += v * v;
            }
            const rms = Math.sqrt(sumSquares / buf.length);

            // Build a baseline over initial ~1.5s (ensure audio is running)
            if (audioBaselineSamplesRef.current < 15) {
              audioBaselineRef.current = (audioBaselineRef.current * audioBaselineSamplesRef.current + rms) / (audioBaselineSamplesRef.current + 1);
              audioBaselineSamplesRef.current += 1;
              return;
            }

            // Thresholds
            const minAbsolute = 0.01; // ignore very low noise
            const factor = sensitivity === 'high' ? 2.0 : sensitivity === 'medium' ? 2.5 : 3.0;
            const threshold = Math.max(minAbsolute, audioBaselineRef.current * factor);

            // If audio is above threshold while mouth appears closed -> background noise
            const mouthGap = lastMouthGapRef.current; // updated from landmarks
            const mouthClosed = mouthGap < 0.012; // normalized gap heuristic

            if (rms > threshold && mouthClosed) {
              triggerEvent({
                type: 'suspicious_activity',
                timestamp: performance.now(),
                severity: rms > threshold * 1.5 ? 'medium' : 'low',
                data: { event_subtype: 'background_noise', rms, baseline: audioBaselineRef.current }
              });
            }
          }, intervalMs) as unknown as number;
        } catch (e) {
          console.warn('Audio analysis init failed:', e);
        }
      }

      // Store the stream and set monitoring to true (this will render the video element)
      setPendingStream(stream);
      // Reset counters and set monitoring start time
      noFaceFramesRef.current = 0;
      monitoringStartTimeRef.current = performance.now();
      setIsMonitoring(true);
      
      console.log('🎬 Set monitoring to true and stored pending stream');

    } catch (err) {
      console.error('❌ Camera access error:', err);
      setError(`Failed to access camera: ${err}`);
      setIsLoading(false);
      setIsMonitoring(false);
    }
  };

  // Stop monitoring
  const stopMonitoring = () => {
    console.log('🛑 Stopping camera monitoring...');
    
    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log(`🔌 Stopping ${track.kind} track`);
        track.stop();
      });
      streamRef.current = null;
    }

    // Stop pending stream if exists
    if (pendingStream) {
      pendingStream.getTracks().forEach(track => {
        console.log(`🔌 Stopping pending ${track.kind} track`);
        track.stop();
      });
      setPendingStream(null);
    }

    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }

    // Reset states
    setIsMonitoring(false);
    setVideoState({ playing: false, dimensions: { width: 0, height: 0 } });
    setError(null);
    setIsLoading(false);
    
    // Tear down audio analysis
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
      analyserRef.current = null;
      audioDataRef.current = null;
      audioBaselineRef.current = 0;
      audioBaselineSamplesRef.current = 0;
      lastMouthGapRef.current = 0;
    }
    
    console.log('✅ Camera monitoring stopped');
  };

  // Main analysis loop
  const startAnalysis = () => {
    const analyze = () => {
      if (!isMonitoring || !videoRef.current) {
        return;
      }

      const currentTime = performance.now();
      
      // Throttle analysis to 30 FPS
      if (currentTime - lastFrameTime.current < 33) {
        requestAnimationFrame(analyze);
        return;
      }
      
      lastFrameTime.current = currentTime;

      try {
        let faceResults = null;

        // Face Detection (if available)
        if (faceDetector) {
          try {
            faceResults = faceDetector.detectForVideo(videoRef.current, currentTime);
            analyzeFaces(faceResults, currentTime);
          } catch (err) {
            console.warn('Face detection error:', err);
          }
        }

        // Face Landmarks (if faces detected and landmarker available)
        if (faceResults?.detections?.length > 0 && faceLandmarker) {
          try {
            const landmarkResults = faceLandmarker.detectForVideo(videoRef.current, currentTime);
            analyzeFaceLandmarks(landmarkResults, currentTime);
          } catch (err) {
            console.warn('Face landmarks error:', err);
          }
        }

        // Pose Detection (if available)
        if (poseLandmarker) {
          try {
            const poseResults = poseLandmarker.detectForVideo(videoRef.current, currentTime);
            analyzePose(poseResults, currentTime);
          } catch (err) {
            console.warn('Pose detection error:', err);
          }
        }

        // Visualize on canvas
        if (faceResults) {
          visualizeResults(faceResults, currentTime);
        }

      } catch (err) {
        console.error('Analysis error:', err);
      }

      requestAnimationFrame(analyze);
    };

    requestAnimationFrame(analyze);
  };

  // Analyze face detection results
  const analyzeFaces = (results: any, timestamp: number) => {
    const faces = results.detections || [];
    
    // No face detected
    if (faces.length === 0) {
      // Grace period during warm-up to avoid false alarms right after start
      const warmupMs = 1500; // 1.5s grace
      if (timestamp - monitoringStartTimeRef.current < warmupMs) {
        return;
      }
      // Require consecutive frames without a face before flagging
      noFaceFramesRef.current += 1;
      const thresholdFrames = sensitivity === 'high' ? 8 : sensitivity === 'medium' ? 12 : 16; // ~0.25–0.5s
      if (noFaceFramesRef.current >= thresholdFrames) {
        triggerEvent({
          type: 'face_not_detected',
          timestamp,
          severity: 'high',
          data: { faceCount: 0 }
        });
        noFaceFramesRef.current = 0; // reset after triggering
      }
      return;
    } else {
      // Reset counter when we see a face
      noFaceFramesRef.current = 0;
    }

    // Multiple faces detected
    if (faces.length > 1) {
      triggerEvent({
        type: 'multiple_faces',
        timestamp,
        severity: 'high',
        data: { faceCount: faces.length, faces }
      });
    }
  };

  // Analyze face landmarks for gaze and head movement
  const analyzeFaceLandmarks = (results: any, timestamp: number) => {
    const landmarks = results.faceLandmarks?.[0];
    if (!landmarks) return;

    // Calculate gaze direction (simplified)
    const leftEye = landmarks[33]; // Left eye landmark
    const rightEye = landmarks[263]; // Right eye landmark
    const noseTip = landmarks[1]; // Nose tip
    
    if (leftEye && rightEye && noseTip) {
      // Calculate head rotation
      const eyeCenter = {
        x: (leftEye.x + rightEye.x) / 2,
        y: (leftEye.y + rightEye.y) / 2
      };
      
      const headAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
      
      // Heuristics using normalized coordinates (0..1)
      const noseDeviation = Math.abs(noseTip.x - eyeCenter.x);

      // Thresholds for slight drift vs away
      const gazeAwayThreshold = getSensitivityThreshold('gaze', sensitivity); // existing mapping
      const slightDriftThreshold = gazeAwayThreshold * 0.5; // more sensitive

      // Face position OK/Not OK based on both deviation and roll angle
      const isFacingOk = noseDeviation <= slightDriftThreshold && Math.abs(headAngle) <= getSensitivityThreshold('head_movement', sensitivity);

      // Emit transition to Not OK (looking away) as a medium severity
      if (!isFacingOk && facingOkRef.current && noseDeviation > gazeAwayThreshold) {
        facingOkRef.current = false;
        driftFramesRef.current = 0;
        triggerEvent({
          type: 'looking_away',
          timestamp,
          severity: 'medium',
          data: { reason: 'off_camera', headAngle, noseDeviation }
        });
      }

      // Slight drift detection: sustained minor deviation
      if (!isFacingOk && noseDeviation > slightDriftThreshold && noseDeviation <= gazeAwayThreshold) {
        driftFramesRef.current += 1;
        const framesNeeded = sensitivity === 'high' ? 8 : sensitivity === 'medium' ? 12 : 16; // ~0.25–0.5s
        if (driftFramesRef.current >= framesNeeded) {
          triggerEvent({
            type: 'looking_away',
            timestamp,
            severity: 'low',
            data: { reason: 'gaze_drift', headAngle, noseDeviation }
          });
          driftFramesRef.current = 0;
        }
      }

      // Return to OK state
      if (isFacingOk && !facingOkRef.current) {
        facingOkRef.current = true;
        driftFramesRef.current = 0;
      }

      // Track mouth openness for background-noise discrimination
      const upperLip = landmarks[13];
      const lowerLip = landmarks[14];
      if (upperLip && lowerLip) {
        const mouthGap = Math.abs(lowerLip.y - upperLip.y);
        lastMouthGapRef.current = mouthGap;
      }

      // Store baseline if not set
      if (!faceBaseline) {
        setFaceBaseline({ eyeCenter, headAngle, noseTip });
      } else {
        // Check for significant head movement
        const headMovement = Math.abs(headAngle - faceBaseline.headAngle);
        if (headMovement > getSensitivityThreshold('head_movement', sensitivity)) {
          triggerEvent({
            type: 'head_movement',
            timestamp,
            severity: 'low',
            data: { headMovement, baseline: faceBaseline, current: { headAngle } }
          });
        }
      }
    }
  };

  // Analyze pose for body movement
  const analyzePose = (results: any, timestamp: number) => {
    const poses = results.landmarks || [];
    if (poses.length === 0) return;

    const pose = poses[0];
    const shoulders = {
      left: pose[11], // Left shoulder
      right: pose[12] // Right shoulder
    };

    if (shoulders.left && shoulders.right) {
      const shoulderAngle = Math.atan2(
        shoulders.right.y - shoulders.left.y,
        shoulders.right.x - shoulders.left.x
      );

      if (!poseBaseline) {
        setPoseBaseline({ shoulderAngle, shoulders });
      } else {
        const poseChange = Math.abs(shoulderAngle - poseBaseline.shoulderAngle);
        if (poseChange > getSensitivityThreshold('pose', sensitivity)) {
          triggerEvent({
            type: 'pose_change',
            timestamp,
            severity: 'low',
            data: { poseChange, baseline: poseBaseline, current: { shoulderAngle } }
          });
        }
      }
    }
  };

  // Get sensitivity thresholds
  const getSensitivityThreshold = (type: string, level: string): number => {
    const thresholds = {
      low: { gaze: 0.3, head_movement: 0.5, pose: 0.4 },
      medium: { gaze: 0.2, head_movement: 0.3, pose: 0.25 },
      high: { gaze: 0.1, head_movement: 0.2, pose: 0.15 }
    };
    return thresholds[level as keyof typeof thresholds][type as keyof typeof thresholds.low] || 0.2;
  };

  // Trigger event with cooldown
  const triggerEvent = (event: ProctorEvent) => {
    const cooldownKey = `${event.type}_${event.severity}`;
    const now = Date.now();
    const lastTriggered = eventCooldowns.current.get(cooldownKey) || 0;
    
    // Apply cooldown (different for different severities)
    const cooldownMs = event.severity === 'high' ? 1000 : event.severity === 'medium' ? 3000 : 5000;
    
    if (now - lastTriggered > cooldownMs) {
      eventCooldowns.current.set(cooldownKey, now);
      onEventDetected(event);
      
      // Update current events for UI
      setCurrentEvents(prev => {
        const updated = [event, ...prev.slice(0, 4)]; // Keep last 5 events
        return updated;
      });

      // Show toast for specific flags
      const isBackgroundNoise = event.type === 'suspicious_activity' && event.data?.event_subtype === 'background_noise';
      const isMultipleFaces = event.type === 'multiple_faces';
      if (isBackgroundNoise || isMultipleFaces) {
        const title = isBackgroundNoise ? 'Background noise detected' : 'Multiple faces detected';
        const desc = isBackgroundNoise ? 'We heard voices/noise while your mouth appeared closed.' : 'Only one person should be in view during assessment.';
        const emoji = isBackgroundNoise ? '🔊' : '👥';
        setToast({ show: true, title, desc, emoji });
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => setToast(t => ({ ...t, show: false })), 4000) as unknown as number;
      }
    }
  };

  // Visualize results on canvas
  const visualizeResults = (faceResults: any, timestamp: number) => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw face bounding boxes
    const faces = faceResults.detections || [];
    faces.forEach((detection: any, index: number) => {
      const bbox = detection.boundingBox;
      if (bbox) {
        ctx.strokeStyle = faces.length > 1 ? '#ff0000' : (facingOkRef.current ? '#00ff88' : '#ff8800');
        ctx.lineWidth = 2;
        ctx.strokeRect(
          bbox.originX,
          bbox.originY,
          bbox.width,
          bbox.height
        );
        
        // Label
        ctx.fillStyle = faces.length > 1 ? '#ff0000' : (facingOkRef.current ? '#00ff88' : '#ff8800');
        ctx.font = '16px Arial';
        ctx.fillText(
          `Face ${index + 1}`,
          bbox.originX,
          bbox.originY - 5
        );
      }
    });
    
    // Show monitoring status
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, 10, 240, 90);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px Arial';
    ctx.fillText(`Monitoring: ${isMonitoring ? 'Active' : 'Inactive'}`, 16, 32);
    ctx.fillText(`Faces: ${faces.length}`, 16, 52);
    ctx.fillText(`Session: ${sessionId.slice(0, 8)}...`, 16, 72);
    ctx.fillStyle = facingOkRef.current ? '#00ff88' : '#ff8800';
    ctx.fillText(`Face Position: ${facingOkRef.current ? 'OK' : 'Not OK'}`, 16, 92);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 text-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-purple-600/20 p-2 rounded-lg">
          <Camera className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-light text-white">MediaPipe Proctoring System</h3>
          <p className="text-xs text-gray-400">AI-powered face and pose detection</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        {!isMonitoring ? (
          <button
            onClick={startMonitoring}
            disabled={isLoading}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Camera className="h-4 w-4" />
            Start Monitoring
          </button>
        ) : (
          <button
            onClick={stopMonitoring}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <CameraOff className="h-4 w-4" />
            Stop Monitoring
          </button>
        )}
      </div>

      <div className="text-sm">
        <span className="text-gray-400 mr-2">Status:</span>
        <span className={isMonitoring ? 'text-green-400' : 'text-red-400'}>
          {isMonitoring ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 text-sm text-red-400">{error}</div>
      )}

      {/* Live Preview */}
      {isMonitoring && (
        <div className="mt-4 relative w-full max-w-2xl bg-black rounded-lg overflow-hidden border border-gray-700">
          <video
            ref={videoRef}
            className="w-full h-auto"
            playsInline
            autoPlay
            muted
            controls={false}
            style={{ minHeight: '260px', objectFit: 'cover' }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Recent background noise badge */}
          {currentEvents[0]?.type === 'suspicious_activity' && currentEvents[0]?.data?.event_subtype === 'background_noise' && (
            <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-600/80 text-white text-xs px-3 py-1.5 rounded-md shadow">
              <Mic className="h-3.5 w-3.5" />
              <span>Background noise detected</span>
            </div>
          )}

          {/* Manual play fallback if browser blocks autoplay */}
          {videoRef.current?.paused && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <button
                onClick={async () => {
                  try { await videoRef.current?.play(); } catch {}
                }}
                className="bg-white text-black px-4 py-2 rounded-lg cursor-pointer"
              >
                ▶ Click to start video
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toast notifications */}
      <Toast
        show={toast.show}
        title={toast.title}
        description={toast.desc}
        emoji={toast.emoji}
        position="top-right"
        onClose={() => setToast(t => ({ ...t, show: false }))}
      />

      {/* Recent flags list */}
      {currentEvents.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-gray-400 mb-2">Recent flags</div>
          <ul className="space-y-2">
            {currentEvents.map((e, idx) => {
              const isNoise = e.type === 'suspicious_activity' && e.data?.event_subtype === 'background_noise';
              const label = isNoise
                ? 'Background noise'
                : e.type === 'face_not_detected'
                ? 'Face not detected'
                : e.type === 'multiple_faces'
                ? 'Multiple faces detected'
                : e.type === 'looking_away'
                ? (e.data?.reason === 'gaze_drift' ? 'Gaze drift' : 'Looking away')
                : e.type === 'head_movement'
                ? 'Head movement'
                : e.type === 'pose_change'
                ? 'Pose change'
                : 'Event';
              const severityColor = e.severity === 'high' ? 'text-red-400' : e.severity === 'medium' ? 'text-amber-400' : 'text-yellow-300';
              return (
                <li key={idx} className="flex items-center justify-between rounded-md border border-gray-700/70 bg-gray-900/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {isNoise ? (
                      <Mic className="h-4 w-4 text-red-400" />
                    ) : e.type === 'multiple_faces' ? (
                      <Users className="h-4 w-4 text-red-400" />
                    ) : e.type === 'pose_change' ? (
                      <PersonStanding className="h-4 w-4 text-amber-400" />
                    ) : e.type === 'head_movement' ? (
                      <Move3D className="h-4 w-4 text-amber-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    )}
                    <span className="text-sm text-gray-200">{label}</span>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wide ${severityColor}`}>{e.severity}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
