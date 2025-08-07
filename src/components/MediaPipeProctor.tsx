'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { AlertTriangle, Eye, EyeOff, Camera, CameraOff } from 'lucide-react';

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
  type: 'face_not_detected' | 'multiple_faces' | 'looking_away' | 'head_movement' | 'pose_change';
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
  data: any;
}

interface MediaPipeProctorProps {
  sessionId: string;
  onEventDetected: (event: ProctorEvent) => void;
  enabled?: boolean;
  sensitivity?: 'low' | 'medium' | 'high';
}

export default function MediaPipeProctor({
  sessionId,
  onEventDetected,
  enabled = true,
  sensitivity = 'medium'
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
  const consecutiveNoFaceFrames = useRef<number>(0);
  const originalConsoleError = useRef<typeof console.error | null>(null);
  const monitoringStartTimeMs = useRef<number>(0);

  // Suppress noisy Mediapipe INFO logs that are routed through console.error in dev
  useEffect(() => {
    originalConsoleError.current = console.error;
    const ignorePatterns = [/^INFO:/, /XNNPACK delegate/i];
    const filteredConsoleError = (...args: unknown[]) => {
      try {
        const firstArg = args[0] as unknown;
        const message = typeof firstArg === 'string'
          ? firstArg
          : (firstArg instanceof Error ? firstArg.message : String(firstArg ?? ''));
        if (ignorePatterns.some((p) => p.test(message))) {
          // Ignore Mediapipe INFO lines that Next.js treats as errors in dev
          return;
        }
      } catch (_) {
        // fall through to original
      }
      if (originalConsoleError.current) {
        // eslint-disable-next-line prefer-spread
        originalConsoleError.current.apply(console, args as any);
      }
    };

    // Patch console.error while this component is mounted
    // Note: This is scoped to the page lifecycle and restored on unmount
    // so it will not affect other parts of the app when not proctoring.
    console.error = filteredConsoleError as any;
    return () => {
      if (originalConsoleError.current) {
        console.error = originalConsoleError.current;
      }
    };
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
        audio: false
      });

      console.log('✅ Camera access granted, stream active:', stream.active);
      console.log('📹 Video tracks:', stream.getVideoTracks().length);

      // Store the stream and set monitoring to true (this will render the video element)
      setPendingStream(stream);
      setIsMonitoring(true);
      monitoringStartTimeMs.current = performance.now();
      
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

    // Determine debounced threshold for no-face detection based on sensitivity
    const getNoFaceFramesThreshold = (level: string): number => {
      // At ~30 FPS, 8/14/20 frames correspond to roughly 270/470/670 ms
      switch (level) {
        case 'high':
          return 8;
        case 'low':
          return 20;
        default:
          return 14; // medium
      }
    };

    // No face detected with debounce to avoid false positives between frames
    // Grace period right after starting monitoring to avoid cold-start false negatives
    const warmUpMs = 1200; // ~1.2s
    const isWarmingUp = monitoringStartTimeMs.current > 0 &&
      (timestamp - monitoringStartTimeMs.current) < warmUpMs;

    if (faces.length === 0 && !isWarmingUp) {
      consecutiveNoFaceFrames.current += 1;
      if (consecutiveNoFaceFrames.current >= getNoFaceFramesThreshold(sensitivity)) {
        triggerEvent({
          type: 'face_not_detected',
          timestamp,
          severity: 'high',
          data: { faceCount: 0 }
        });
        // Reset so we only trigger again after another sustained period
        consecutiveNoFaceFrames.current = 0;
      }
      return;
    } else {
      // Reset counter once we have any face
      consecutiveNoFaceFrames.current = 0;
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
      
      // Check if looking away (simplified heuristic)
      const noseDeviation = Math.abs(noseTip.x - eyeCenter.x);
      if (noseDeviation > getSensitivityThreshold('gaze', sensitivity)) {
        triggerEvent({
          type: 'looking_away',
          timestamp,
          severity: 'medium',
          data: { headAngle, noseDeviation, landmarks: { leftEye, rightEye, noseTip } }
        });
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
        ctx.strokeStyle = faces.length > 1 ? '#ff0000' : '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          bbox.originX,
          bbox.originY,
          bbox.width,
          bbox.height
        );
        
        // Label
        ctx.fillStyle = faces.length > 1 ? '#ff0000' : '#00ff00';
        ctx.font = '16px Arial';
        ctx.fillText(
          `Face ${index + 1}`,
          bbox.originX,
          bbox.originY - 5
        );
      }
    });
    
    // Show monitoring status
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, 10, 200, 80);
    ctx.fillStyle = '#000000';
    ctx.font = '14px Arial';
    ctx.fillText(`Monitoring: ${isMonitoring ? 'Active' : 'Inactive'}`, 15, 30);
    ctx.fillText(`Faces: ${faces.length}`, 15, 50);
    ctx.fillText(`Session: ${sessionId.slice(0, 8)}...`, 15, 70);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            MediaPipe Proctoring System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Loading State */}
            {isLoading && (
              <Alert>
                <AlertDescription>
                  Loading MediaPipe models... This may take a moment.
                </AlertDescription>
              </Alert>
            )}

            {/* Error State */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Controls */}
            <div className="flex gap-2">
              {!isMonitoring ? (
                <Button 
                  onClick={startMonitoring} 
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Start Monitoring
                </Button>
              ) : (
                <Button 
                  onClick={stopMonitoring}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <CameraOff className="h-4 w-4" />
                  Stop Monitoring
                </Button>
              )}
            </div>

            {/* MediaPipe Status */}
            {isInitialized && (
              <div className="text-sm text-gray-600 space-y-1">
                <p>MediaPipe Status:</p>
                <div className="flex gap-4 text-xs">
                  <span className={faceDetector ? 'text-green-600' : 'text-red-600'}>
                    Face Detection: {faceDetector ? '✓' : '✗'}
                  </span>
                  <span className={faceLandmarker ? 'text-green-600' : 'text-red-600'}>
                    Face Landmarks: {faceLandmarker ? '✓' : '✗'}
                  </span>
                  <span className={poseLandmarker ? 'text-green-600' : 'text-red-600'}>
                    Pose Detection: {poseLandmarker ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            )}

            {/* Video and Canvas */}
            {isMonitoring && (
              <div className="relative w-full max-w-2xl mx-auto bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-auto rounded-lg border-2 border-green-500"
                  playsInline
                  autoPlay
                  muted
                  controls={false}
                  style={{ 
                    minHeight: '300px',
                    objectFit: 'cover'
                  }}
                  onClick={async () => {
                    // Manual play fallback if autoplay is blocked
                    if (videoRef.current && videoRef.current.paused) {
                      try {
                        await videoRef.current.play();
                        console.log('📱 Manual play successful');
                      } catch (err) {
                        console.error('❌ Manual play failed:', err);
                      }
                    }
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                />
                
                {/* Video Status Overlay */}
                <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                  {streamRef.current ? 
                    `🟢 Live - ${streamRef.current.getTracks().length} track(s)` : 
                    '🔴 No Stream'
                  }
                </div>

                {/* Manual Play Button (shown if video is paused) */}
                {videoRef.current?.paused && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button 
                      onClick={async () => {
                        if (videoRef.current) {
                          try {
                            await videoRef.current.play();
                            console.log('▶ Manual play button clicked - success');
                          } catch (err) {
                            console.error('❌ Manual play button failed:', err);
                          }
                        }
                      }}
                      className="bg-white bg-opacity-90 text-black hover:bg-opacity-100"
                    >
                      ▶ Click to Play Video
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Recent Events */}
            {currentEvents.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Recent Events:</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {currentEvents.map((event, index) => (
                    <div 
                      key={index}
                      className={`p-2 rounded text-sm ${
                        event.severity === 'high' ? 'bg-red-100 text-red-800' :
                        event.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {event.type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-xs">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status */}
            <div className="text-sm text-gray-600 space-y-1">
              <p>Session ID: {sessionId}</p>
              <p>Sensitivity: {sensitivity}</p>
              <p>Status: {isMonitoring ? 'Monitoring Active' : 'Monitoring Inactive'}</p>
              {streamRef.current && (
                <div className="bg-green-50 p-2 rounded">
                  <p className="text-green-800 font-medium">📹 Camera Status:</p>
                  <p className="text-green-700 text-xs">
                    • Stream: {streamRef.current.active ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-green-700 text-xs">
                    • Tracks: {streamRef.current.getTracks().length}
                  </p>
                  {streamRef.current.getTracks().map((track, index) => (
                    <p key={index} className="text-green-700 text-xs">
                      • {track.kind}: {track.enabled ? 'Enabled' : 'Disabled'} ({track.readyState})
                    </p>
                  ))}
                </div>
              )}
              {videoRef.current && (
                <div className="bg-blue-50 p-2 rounded">
                  <p className="text-blue-800 font-medium">🎥 Video Element:</p>
                  <p className="text-blue-700 text-xs">
                    • Ready State: {videoRef.current.readyState} / 4
                  </p>
                  <p className="text-blue-700 text-xs">
                    • Paused: {videoRef.current.paused ? 'Yes' : 'No'}
                  </p>
                  <p className="text-blue-700 text-xs">
                    • Dimensions: {videoRef.current.videoWidth}x{videoRef.current.videoHeight}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
