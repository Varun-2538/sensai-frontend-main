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
  
  // Monitoring state
  const [faceBaseline, setFaceBaseline] = useState<any>(null);
  const [poseBaseline, setPoseBaseline] = useState<any>(null);
  const lastFrameTime = useRef<number>(0);
  const eventCooldowns = useRef<Map<string, number>>(new Map());

  // Load MediaPipe scripts
  useEffect(() => {
    const loadMediaPipeScripts = async () => {
      setIsLoading(true);
      try {
        // Load MediaPipe vision bundle
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js';
        script.crossOrigin = 'anonymous';
        
        script.onload = () => {
          console.log('MediaPipe scripts loaded');
          initializeMediaPipe();
        };
        
        script.onerror = () => {
          setError('Failed to load MediaPipe scripts');
          setIsLoading(false);
        };
        
        document.head.appendChild(script);
      } catch (err) {
        setError('Error loading MediaPipe');
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

  // Initialize MediaPipe models
  const initializeMediaPipe = async () => {
    try {
      if (!window.FilesetResolver) {
        throw new Error('MediaPipe not loaded');
      }

      const vision = await window.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Initialize Face Landmarker for detailed facial analysis
      const faceLandmarkerInstance = await window.FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        numFaces: 5
      });

      // Initialize Face Detector for basic face detection
      const faceDetectorInstance = await window.FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO'
      });

      // Initialize Pose Landmarker for body pose detection
      const poseLandmarkerInstance = await window.PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 2
      });

      setFaceLandmarker(faceLandmarkerInstance);
      setFaceDetector(faceDetectorInstance);
      setPoseLandmarker(poseLandmarkerInstance);
      setIsInitialized(true);
      setIsLoading(false);
      
      console.log('MediaPipe models initialized successfully');
    } catch (err) {
      console.error('MediaPipe initialization error:', err);
      setError(`Failed to initialize MediaPipe: ${err}`);
      setIsLoading(false);
    }
  };

  // Start camera and monitoring
  const startMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play();
            setIsMonitoring(true);
            startAnalysis();
          }
        };
      }
    } catch (err) {
      setError('Failed to access camera. Please ensure camera permissions are granted.');
      console.error('Camera access error:', err);
    }
  };

  // Stop monitoring
  const stopMonitoring = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsMonitoring(false);
  };

  // Main analysis loop
  const startAnalysis = () => {
    const analyze = () => {
      if (!isMonitoring || !videoRef.current || !faceLandmarker || !faceDetector || !poseLandmarker) {
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
        // Face Detection
        const faceResults = faceDetector.detectForVideo(videoRef.current, currentTime);
        analyzeFaces(faceResults, currentTime);

        // Face Landmarks (if faces detected)
        if (faceResults.detections?.length > 0) {
          const landmarkResults = faceLandmarker.detectForVideo(videoRef.current, currentTime);
          analyzeFaceLandmarks(landmarkResults, currentTime);
        }

        // Pose Detection
        const poseResults = poseLandmarker.detectForVideo(videoRef.current, currentTime);
        analyzePose(poseResults, currentTime);

        // Visualize on canvas
        visualizeResults(faceResults, currentTime);

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
      triggerEvent({
        type: 'face_not_detected',
        timestamp,
        severity: 'high',
        data: { faceCount: 0 }
      });
      return;
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
                  disabled={!isInitialized || isLoading}
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

            {/* Video and Canvas */}
            {isMonitoring && (
              <div className="relative w-full max-w-2xl mx-auto">
                <video
                  ref={videoRef}
                  className="w-full h-auto rounded-lg border"
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                />
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
            <div className="text-sm text-gray-600">
              <p>Session ID: {sessionId}</p>
              <p>Sensitivity: {sensitivity}</p>
              <p>Status: {isMonitoring ? 'Monitoring Active' : 'Monitoring Inactive'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
