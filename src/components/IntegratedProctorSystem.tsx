'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Camera, 
  CameraOff, 
  Shield, 
  Activity,
  Users,
  CheckCircle,
  XCircle
} from 'lucide-react';
import MediaPipeProctor from './MediaPipeProctor';
import { 
  integrityAPI, 
  EventThrottler, 
  EventBatcher,
  type ProctorEvent,
  type IntegritySession 
} from '@/lib/integrity-api';

interface IntegratedProctorSystemProps {
  userId: number;
  cohortId?: number;
  taskId?: number;
  onSessionEnd?: (sessionUuid: string, analysis: any) => void;
  sensitivity?: 'low' | 'medium' | 'high';
  autoStart?: boolean;
}

export default function IntegratedProctorSystem({
  userId,
  cohortId,
  taskId,
  onSessionEnd,
  sensitivity = 'medium',
  autoStart = false
}: IntegratedProctorSystemProps) {
  // State
  const [session, setSession] = useState<IntegritySession | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    eventsCount: 0,
    flagsCount: 0,
    integrityScore: 100
  });

  // Refs
  const eventThrottler = useRef(new EventThrottler());
  const eventBatcher = useRef<EventBatcher | null>(null);
  const isInitialized = useRef(false);

  // Native browser monitoring
  const [nativeEvents, setNativeEvents] = useState<{
    tabSwitches: number;
    windowBlurs: number;
    copyPastes: number;
  }>({
    tabSwitches: 0,
    windowBlurs: 0,
    copyPastes: 0
  });

  // Initialize session
  const initializeSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Create new session
      const newSession = await integrityAPI.createSession({
        user_id: userId,
        cohort_id: cohortId,
        task_id: taskId,
        monitoring_config: {
          sensitivity,
          mediapipe_enabled: true,
          native_monitoring: true,
          auto_flag_threshold: 0.8
        }
      });

      setSession(newSession);
      setIsSessionActive(true);

      // Initialize event batcher for this session
      eventBatcher.current = new EventBatcher(5, 3000);

      console.log('Integrity session created:', newSession.session_uuid);
    } catch (err) {
      setError(`Failed to initialize session: ${err}`);
      console.error('Session initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, cohortId, taskId, sensitivity]);

  // End session
  const endSession = useCallback(async () => {
    if (!session) return;

    try {
      setIsLoading(true);

      // Flush any remaining events
      if (eventBatcher.current) {
        await eventBatcher.current.flush();
        eventBatcher.current.destroy();
        eventBatcher.current = null;
      }

      // Update session status
      await integrityAPI.updateSessionStatus(
        session.session_uuid,
        'completed',
        new Date().toISOString()
      );

      // Get final analysis
      const analysis = await integrityAPI.getSessionAnalysis(session.session_uuid);
      
      setIsSessionActive(false);
      setSession(null);

      // Callback with results
      if (onSessionEnd) {
        onSessionEnd(session.session_uuid, analysis);
      }

      console.log('Session ended. Final analysis:', analysis);
    } catch (err) {
      setError(`Failed to end session: ${err}`);
      console.error('Session end error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session, onSessionEnd]);

  // Handle MediaPipe events
  const handleMediaPipeEvent = useCallback((event: ProctorEvent) => {
    if (!session || !eventBatcher.current) return;

    // Check if we should send this event (throttling)
    if (!eventThrottler.current.shouldSendEvent(event.type)) {
      return;
    }

    // Determine if event should be flagged
    const shouldFlag = event.severity === 'high' || 
                      (event.severity === 'medium' && Math.random() > 0.7) ||
                      (event.type === 'multiple_faces');

    // Add to batch
    eventBatcher.current.addEvent({
      session_uuid: session.session_uuid,
      user_id: userId,
      event_type: event.type,
      data: event.data,
      severity: event.severity,
      flagged: shouldFlag
    });

    // Update local stats
    setStats(prev => ({
      ...prev,
      eventsCount: prev.eventsCount + 1,
      flagsCount: prev.flagsCount + (shouldFlag ? 1 : 0),
      integrityScore: Math.max(0, prev.integrityScore - (event.severity === 'high' ? 5 : event.severity === 'medium' ? 2 : 1))
    }));
  }, [session, userId]);

  // Native browser event handlers
  const handleTabSwitch = useCallback(() => {
    if (!session || !eventBatcher.current) return;

    if (eventThrottler.current.shouldSendEvent('tab_switch')) {
      eventBatcher.current.addEvent({
        session_uuid: session.session_uuid,
        user_id: userId,
        event_type: 'tab_switch',
        data: { timestamp: Date.now(), type: 'tab_change' },
        severity: 'high',
        flagged: true
      });

      setNativeEvents(prev => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }));
      setStats(prev => ({ 
        ...prev, 
        eventsCount: prev.eventsCount + 1,
        flagsCount: prev.flagsCount + 1,
        integrityScore: Math.max(0, prev.integrityScore - 10)
      }));
    }
  }, [session, userId]);

  const handleWindowBlur = useCallback(() => {
    if (!session || !eventBatcher.current) return;

    if (eventThrottler.current.shouldSendEvent('window_blur')) {
      eventBatcher.current.addEvent({
        session_uuid: session.session_uuid,
        user_id: userId,
        event_type: 'window_blur',
        data: { timestamp: Date.now(), type: 'focus_lost' },
        severity: 'medium',
        flagged: false
      });

      setNativeEvents(prev => ({ ...prev, windowBlurs: prev.windowBlurs + 1 }));
      setStats(prev => ({ 
        ...prev, 
        eventsCount: prev.eventsCount + 1,
        integrityScore: Math.max(0, prev.integrityScore - 3)
      }));
    }
  }, [session, userId]);

  const handleCopyPaste = useCallback((event: ClipboardEvent) => {
    if (!session || !eventBatcher.current) return;

    if (eventThrottler.current.shouldSendEvent('copy_paste')) {
      eventBatcher.current.addEvent({
        session_uuid: session.session_uuid,
        user_id: userId,
        event_type: 'copy_paste',
        data: { 
          timestamp: Date.now(), 
          type: event.type,
          dataLength: event.clipboardData?.getData('text').length || 0
        },
        severity: 'medium',
        flagged: true
      });

      setNativeEvents(prev => ({ ...prev, copyPastes: prev.copyPastes + 1 }));
      setStats(prev => ({ 
        ...prev, 
        eventsCount: prev.eventsCount + 1,
        flagsCount: prev.flagsCount + 1,
        integrityScore: Math.max(0, prev.integrityScore - 5)
      }));
    }
  }, [session, userId]);

  // Setup native event listeners
  useEffect(() => {
    if (!isSessionActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleTabSwitch();
      }
    };

    const handleBlur = () => {
      handleWindowBlur();
    };

    const handlePaste = (e: ClipboardEvent) => {
      handleCopyPaste(e);
    };

    const handleCopy = (e: ClipboardEvent) => {
      handleCopyPaste(e);
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('copy', handleCopy);

    // Prevent right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isSessionActive, handleTabSwitch, handleWindowBlur, handleCopyPaste]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && !isInitialized.current) {
      isInitialized.current = true;
      initializeSession();
    }
  }, [autoStart, initializeSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventBatcher.current) {
        eventBatcher.current.destroy();
      }
    };
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (score >= 60) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Integrated Proctoring System
            {isSessionActive && (
              <Badge variant="default" className="ml-auto">
                Active
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Session Controls */}
            <div className="flex gap-2">
              {!isSessionActive ? (
                <Button 
                  onClick={initializeSession}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Start Proctoring
                </Button>
              ) : (
                <Button 
                  onClick={endSession}
                  variant="destructive"
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <CameraOff className="h-4 w-4" />
                  End Session
                </Button>
              )}
            </div>

            {/* Session Info */}
            {session && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-sm text-gray-600">Session ID</div>
                  <div className="font-mono text-xs">
                    {session.session_uuid.slice(0, 8)}...
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">Events</div>
                  <div className="flex items-center justify-center gap-1">
                    <Activity className="h-4 w-4" />
                    <span className="font-semibold">{stats.eventsCount}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">Flags</div>
                  <div className="flex items-center justify-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold">{stats.flagsCount}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">Integrity Score</div>
                  <div className={`flex items-center justify-center gap-1 font-semibold ${getScoreColor(stats.integrityScore)}`}>
                    {getScoreIcon(stats.integrityScore)}
                    <span>{stats.integrityScore}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Native Monitoring Stats */}
            {isSessionActive && (
              <div className="grid grid-cols-3 gap-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-center">
                  <div className="text-xs text-blue-600">Tab Switches</div>
                  <div className="font-semibold text-blue-800">{nativeEvents.tabSwitches}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-blue-600">Window Blurs</div>
                  <div className="font-semibold text-blue-800">{nativeEvents.windowBlurs}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-blue-600">Copy/Paste</div>
                  <div className="font-semibold text-blue-800">{nativeEvents.copyPastes}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MediaPipe Proctoring Component */}
      {isSessionActive && session && (
        <MediaPipeProctor
          sessionId={session.session_uuid}
          onEventDetected={handleMediaPipeEvent}
          enabled={true}
          sensitivity={sensitivity}
        />
      )}

      {/* Instructions Card */}
      {!isSessionActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 space-y-2">
              <p>• Ensure your camera and microphone are working properly</p>
              <p>• Position yourself clearly in the camera frame</p>
              <p>• Avoid switching tabs or opening other applications</p>
              <p>• Keep your face visible and maintain focus on the assessment</p>
              <p>• Do not attempt to copy or paste content</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
