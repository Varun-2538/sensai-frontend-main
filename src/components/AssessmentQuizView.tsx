// Enhanced quiz view for assessment mode with timer and integrity monitoring

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Clock, Flag, Shield, AlertTriangle, X } from 'lucide-react';
import LearnerQuizView, { LearnerQuizViewProps } from './LearnerQuizView';
import IntegratedProctorSystem from './IntegratedProctorSystem';  // Correct import as default
import { useAuth } from '@/lib/auth';

interface AssessmentQuizViewProps extends LearnerQuizViewProps {
    assessmentMode?: boolean;
    durationMinutes?: number;
    integrityMonitoring?: boolean;
    taskId?: string;
    cohortId?: string;
    onTimeExpired?: () => void;
    onExitAssessment?: () => void;
}

export default function AssessmentQuizView({
    assessmentMode = false,
    durationMinutes = 60,
    integrityMonitoring = false,
    taskId,
    cohortId,
    onTimeExpired,
    onExitAssessment,
    ...quizProps
}: AssessmentQuizViewProps) {
    const { user } = useAuth();
    const [timeRemaining, setTimeRemaining] = useState(durationMinutes * 60); // in seconds
    const [integritySessionId, setIntegritySessionId] = useState<string | null>(null);
    const [assessmentStarted, setAssessmentStarted] = useState(false);
    
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Timer countdown
    useEffect(() => {
        if (assessmentMode && assessmentStarted && timeRemaining > 0) {
            timerRef.current = setTimeout(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        onTimeExpired?.();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [timeRemaining, assessmentMode, assessmentStarted]);

    // Format time display
    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Start assessment with permissions
    const startAssessment = async () => {
        if (integrityMonitoring) {
            try {
                // Request camera/microphone permissions
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: true, 
                    audio: true 
                });
                stream.getTracks().forEach(track => track.stop());
            } catch (error) {
                alert('Camera and microphone access is required for this assessment.');
                return;
            }
        }

        // Start assessment session via API
        if (taskId) {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/quiz/assessment/start`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        task_id: parseInt(taskId),
                        cohort_id: cohortId ? parseInt(cohortId) : null,
                        integrity_monitoring: integrityMonitoring
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to start assessment session');
                }

                const sessionData = await response.json();
                console.log('Assessment session started:', sessionData);
                
                // Set the duration from the server response
                if (sessionData.duration_minutes) {
                    setTimeRemaining(sessionData.duration_minutes * 60);
                }

                setAssessmentStarted(true);
            } catch (error: any) {
                console.error('Error starting assessment session:', error);
                const message = error?.message || '';
                // Gracefully handle already-active session by proceeding
                if (message.includes('Active assessment session already exists')) {
                    setAssessmentStarted(true);
                    return;
                }
                alert(`Failed to start assessment: ${message}`);
                return;
            }
        } else {
            setAssessmentStarted(true);
        }
    };

    if (!assessmentMode) {
        // Regular quiz mode
        return <LearnerQuizView {...quizProps} />;
    }

    if (!assessmentStarted) {
        // Assessment start screen
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="max-w-md mx-auto text-center p-8">
                    <Shield className="w-16 h-16 text-purple-400 mx-auto mb-6" />
                    <h1 className="text-2xl font-bold mb-4">Assessment Mode</h1>
                    <p className="text-gray-300 mb-6">
                        This quiz is in assessment mode with a {durationMinutes}-minute time limit.
                        {integrityMonitoring && ' Integrity monitoring is enabled.'}
                    </p>
                    
                    {integrityMonitoring && (
                        <div className="bg-yellow-900/20 border border-yellow-900/50 rounded-lg p-4 mb-6">
                            <h3 className="text-yellow-300 font-medium mb-2">Integrity Monitoring</h3>
                            <p className="text-sm text-gray-300">
                                This assessment will monitor your camera and browser activity.
                                You'll be asked to grant permissions.
                            </p>
                        </div>
                    )}
                    
                    <button
                        onClick={startAssessment}
                        className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        Start Assessment
                    </button>
                    
                    {onExitAssessment && (
                        <button
                            onClick={onExitAssessment}
                            className="w-full mt-4 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                            Back to Course
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Integrity Monitoring */}
            {integrityMonitoring && (
                <div className="fixed top-4 right-4 z-50">
                    <IntegratedProctorSystem
                        userId={user?.id || 0}
                        cohortId={cohortId ? parseInt(cohortId) : undefined}
                        taskId={taskId ? parseInt(taskId) : undefined}
                        sensitivity="medium"
                        autoStart={true}
                        onSessionEnd={(sessionId) => setIntegritySessionId(sessionId)}
                    />
                </div>
            )}

            {/* Assessment Header */}
            <div className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-40">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <h1 className="text-lg font-semibold">Assessment Mode</h1>
                        {integrityMonitoring && integritySessionId && (
                            <div className="flex items-center space-x-1 text-green-400">
                                <Shield className="w-4 h-4" />
                                <span className="text-sm">Monitored</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center space-x-4">
                        {/* Timer */}
                        <div className="flex items-center space-x-2">
                            <Clock className="w-5 h-5" />
                            <span className={`font-mono text-lg ${
                                timeRemaining < 300 ? 'text-red-400 font-bold' : 'text-white'
                            }`}>
                                {formatTime(timeRemaining)}
                            </span>
                        </div>

                        {/* Exit Assessment */}
                        {onExitAssessment && (
                            <button
                                onClick={() => {
                                    if (confirm('Are you sure you want to exit? Your progress may be lost.')) {
                                        onExitAssessment();
                                    }
                                }}
                                className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                <X className="w-4 h-4" />
                                <span className="text-sm">Exit</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Quiz Content */}
            <div className="relative">
                <LearnerQuizView 
                    {...quizProps}
                    isTestMode={true}
                />
            </div>

            {/* Low Time Warning */}
            {timeRemaining <= 300 && timeRemaining > 0 && (
                <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
                    <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-medium">⚠️ {formatTime(timeRemaining)} remaining!</span>
                    </div>
                </div>
            )}
        </div>
    );
}
