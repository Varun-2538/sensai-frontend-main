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
import ConfirmationDialog from './ConfirmationDialog';
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
  const [notice, setNotice] = useState<{ show: boolean; title: string; message: string }>(
    { show: false, title: '', message: '' }
  );
  const showBlockingNotice = useCallback((type: 'tab' | 'blur' | 'copy_paste') => {
    if (type === 'copy_paste') {
      setNotice({ show: true, title: 'Copy/Paste is not allowed', message: 'Please avoid copying or pasting during the assessment.' });
    } else if (type === 'tab') {
      setNotice({ show: true, title: 'Tab switching is not allowed', message: 'Please keep the assessment tab in focus at all times.' });
    } else if (type === 'blur') {
      setNotice({ show: true, title: 'Please keep your browser in focus', message: 'Switching away from the browser can impact integrity monitoring.' });
    }
  }, []);


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
    if (!session) return;

    // Always show the blocking notice immediately
    showBlockingNotice('tab');

    // Send batched event if allowed
    if (eventBatcher.current && eventThrottler.current.shouldSendEvent('tab_switch')) {
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
  }, [session, userId, showBlockingNotice]);

  const handleWindowBlur = useCallback(() => {
    if (!session) return;

    showBlockingNotice('blur');

    if (eventBatcher.current && eventThrottler.current.shouldSendEvent('window_blur')) {
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
  }, [session, userId, showBlockingNotice]);

  const handleCopyPaste = useCallback((event: ClipboardEvent) => {
    if (!session) return;

    // Block the default action and show the notice immediately
    try { event.preventDefault(); } catch {}
    try { event.stopPropagation(); } catch {}
    showBlockingNotice('copy_paste');

    if (eventBatcher.current && eventThrottler.current.shouldSendEvent('copy_paste')) {
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
  }, [session, userId, showBlockingNotice]);

  // Block copy/paste/cut hotkeys (Ctrl/Cmd + C/V/X, Shift+Insert)
  const handleCopyPasteHotkey = useCallback((e: KeyboardEvent) => {
    if (!session) return;
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const ctrlOrMeta = isMac ? e.metaKey : e.ctrlKey;
    const key = e.key?.toLowerCase();
    const isCombo = (ctrlOrMeta && (key === 'c' || key === 'v' || key === 'x')) || (e.shiftKey && key === 'insert');
    if (!isCombo) return;

    e.preventDefault();
    e.stopPropagation();
    showBlockingNotice('copy_paste');

    if (eventBatcher.current && eventThrottler.current.shouldSendEvent('copy_paste')) {
      eventBatcher.current.addEvent({
        session_uuid: session.session_uuid,
        user_id: userId,
        event_type: 'copy_paste',
        data: { timestamp: Date.now(), type: 'hotkey', key, ctrlOrMeta },
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
  }, [session, userId, showBlockingNotice]);

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

    const handlePaste = (e: ClipboardEvent) => { handleCopyPaste(e); };
    const handleCopy = (e: ClipboardEvent) => { handleCopyPaste(e); };
    const handleCut = (e: ClipboardEvent) => { handleCopyPaste(e); };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('keydown', handleCopyPasteHotkey, true);

    // Prevent right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('keydown', handleCopyPasteHotkey, true);
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
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-2 rounded-lg">
              <Shield className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-light text-white">Integrated Proctoring System</h3>
              <p className="text-xs text-gray-400">Real-time monitoring active</p>
            </div>
          </div>
          {isSessionActive && (
            <div className="bg-green-600/20 px-3 py-1 rounded-full border border-green-600/30">
              <span className="text-green-400 text-sm font-medium">Active</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Error Display */}
          {error && (
            <div className="bg-red-900/30 border border-red-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span className="text-red-300 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Session Controls */}
          <div className="flex gap-3">
            {!isSessionActive ? (
              <button 
                onClick={initializeSession}
                disabled={isLoading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <Camera className="h-4 w-4" />
                Start Monitoring
              </button>
            ) : (
              <button 
                onClick={endSession}
                disabled={isLoading}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <CameraOff className="h-4 w-4" />
                End Session
              </button>
            )}
          </div>

          {/* Session Info */}
          {session && (
            <div className="grid grid-cols-2 gap-3 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Session ID</div>
                <div className="font-mono text-xs text-white">
                  {session.session_uuid.slice(0, 8)}...
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Events</div>
                <div className="flex items-center justify-center gap-1">
                  <Activity className="h-3 w-3 text-blue-400" />
                  <span className="font-medium text-white text-sm">{stats.eventsCount}</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Flags</div>
                <div className="flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-yellow-400" />
                  <span className="font-medium text-white text-sm">{stats.flagsCount}</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Integrity Score</div>
                <div className={`flex items-center justify-center gap-1 font-medium text-sm ${
                  stats.integrityScore >= 80 ? 'text-green-400' :
                  stats.integrityScore >= 60 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {getScoreIcon(stats.integrityScore)}
                  <span>{stats.integrityScore}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Native Monitoring Stats */}
          {isSessionActive && (
            <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-800/30 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-400 mb-3">Browser Activity</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xs text-blue-300 mb-1">Tab Switches</div>
                  <div className="font-medium text-white">{nativeEvents.tabSwitches}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-blue-300 mb-1">Window Blurs</div>
                  <div className="font-medium text-white">{nativeEvents.windowBlurs}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-blue-300 mb-1">Copy/Paste</div>
                  <div className="font-medium text-white">{nativeEvents.copyPastes}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MediaPipe Proctoring Component */}
      {isSessionActive && session && (
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden">
          <MediaPipeProctor
            sessionId={session.session_uuid}
            onEventDetected={handleMediaPipeEvent}
            enabled={true}
            sensitivity={sensitivity}
            autoStart={true}
            enableBackgroundAudioDetection={true}
          />
        </div>
      )}

      {/* Blocking notification for native flags */}
      <ConfirmationDialog
        open={notice.show}
        type="custom"
        title={notice.title}
        message={notice.message}
        confirmButtonText="Okay, I understand"
        cancelButtonText="Close"
        onConfirm={() => setNotice({ show: false, title: '', message: '' })}
        onCancel={() => setNotice({ show: false, title: '', message: '' })}
        onClickOutside={() => { /* block closing via backdrop */ }}
      />

      {/* Instructions Card */}
      {!isSessionActive && (
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
          <h4 className="text-lg font-light text-white mb-4">Monitoring Guidelines</h4>
          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex items-start gap-3">
              <div className="bg-green-600/20 p-1 rounded-lg mt-0.5">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              </div>
              <span>Ensure camera and microphone are working properly</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-green-600/20 p-1 rounded-lg mt-0.5">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              </div>
              <span>Position yourself clearly in the camera frame</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-red-600/20 p-1 rounded-lg mt-0.5">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
              </div>
              <span>Avoid switching tabs or opening other applications</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-red-600/20 p-1 rounded-lg mt-0.5">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
              </div>
              <span>Do not attempt to copy or paste content</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
