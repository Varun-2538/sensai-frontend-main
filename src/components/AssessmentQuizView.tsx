// Enhanced quiz view for assessment mode with timer and integrity monitoring

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Clock, Shield, AlertTriangle, X, Eye, EyeOff, CheckCircle } from 'lucide-react';
import LearnerQuizView, { LearnerQuizViewProps } from './LearnerQuizView';
import IntegratedProctorSystem from './IntegratedProctorSystem';  // Correct import as default
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    const [showProctoring, setShowProctoring] = useState(true);
    
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
        // Assessment start screen with improved layout
        return (
            <div className="min-h-screen bg-black flex items-center justify-center px-4">
                <div className="max-w-3xl w-full">
                    <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 md:p-12 shadow-2xl">
                        <div className="text-center mb-8">
                            <div className="relative mb-6">
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full opacity-20 blur-xl"></div>
                                <Shield className="relative w-20 h-20 mx-auto text-purple-400" />
                            </div>
                            
                            <h1 className="text-4xl md:text-5xl font-light mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                Assessment Mode
                            </h1>
                            
                            <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                                This quiz is in assessment mode with a {durationMinutes}-minute time limit.
                                {integrityMonitoring && ' Comprehensive integrity monitoring is enabled.'}
                            </p>
                        </div>
                        
                        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 mb-8 border border-gray-700">
                            <h3 className="text-xl font-light mb-6 text-white flex items-center">
                                <AlertTriangle className="w-5 h-5 mr-3 text-yellow-400" />
                                Assessment Guidelines
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
                                <div className="flex items-start space-x-3">
                                    <div className="bg-green-600/20 p-1 rounded-lg mt-0.5">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                    </div>
                                    <span className="text-sm">Camera and microphone are working</span>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="bg-green-600/20 p-1 rounded-lg mt-0.5">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                    </div>
                                    <span className="text-sm">Quiet, well-lit environment</span>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="bg-red-600/20 p-1 rounded-lg mt-0.5">
                                        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                    </div>
                                    <span className="text-sm">No tab switching or other applications</span>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="bg-red-600/20 p-1 rounded-lg mt-0.5">
                                        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                    </div>
                                    <span className="text-sm">No copying or pasting from external sources</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-800/30 rounded-xl p-6 mb-8">
                            <div className="flex items-center justify-center space-x-8">
                                <div className="text-center">
                                    <div className="text-sm text-purple-400 mb-2 font-medium">Assessment Duration</div>
                                    <div className="text-3xl font-light text-white font-mono">{formatTime(timeRemaining)}</div>
                                </div>
                                {integrityMonitoring && (
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-green-600/20 p-3 rounded-xl">
                                            <Shield className="w-6 h-6 text-green-400" />
                                        </div>
                                        <div>
                                            <div className="text-green-400 font-medium">Integrity Monitoring</div>
                                            <div className="text-green-400/80 text-sm">Active & Enabled</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={startAssessment}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-4 px-8 rounded-full font-medium text-lg transition-all duration-200 transform hover:scale-105 shadow-xl cursor-pointer"
                            >
                                Start Assessment
                            </button>
                            
                            {onExitAssessment && (
                                <button
                                    onClick={onExitAssessment}
                                    className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 px-6 rounded-lg border border-gray-700 transition-colors cursor-pointer"
                                >
                                    ← Back to Course
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 border-b border-gray-800 sticky top-0 z-40 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div>
                            <h1 className="text-xl font-light text-white">Assessment Mode</h1>
                            <p className="text-sm text-gray-400">Timed assessment with monitoring</p>
                        </div>

                        <div className="flex items-center gap-6">
                            {/* Monitoring Status */}
                            {integrityMonitoring && (
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center space-x-2">
                                        <div className="relative">
                                            <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                            <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-75"></div>
                                        </div>
                                        <span className="text-sm text-green-400 font-medium">Monitoring Active</span>
                                    </div>
                                    <button
                                        onClick={() => setShowProctoring(!showProctoring)}
                                        className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded-lg border border-gray-700 transition-colors cursor-pointer"
                                    >
                                        {showProctoring ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            )}

                            {/* Timer */}
                            <div className="flex items-center gap-3 bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
                                <Clock className="w-5 h-5 text-blue-400" />
                                <span className={`font-mono font-medium text-lg ${timeRemaining < 300 ? 'text-red-400' : 'text-white'}`}>
                                    {formatTime(timeRemaining)}
                                </span>
                            </div>

                            {/* Exit */}
                            {onExitAssessment && (
                                <button
                                    onClick={() => {
                                        if (confirm('Are you sure you want to exit? Your progress may be lost.')) {
                                            onExitAssessment();
                                        }
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                                >
                                    <X className="w-4 h-4" /> Exit
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden">
                            <LearnerQuizView {...quizProps} isTestMode={true} className="h-[72vh]" />
                        </div>

                        {timeRemaining <= 300 && timeRemaining > 0 && (
                            <div className="bg-gradient-to-r from-red-900/30 to-orange-900/30 border border-red-800/50 rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="h-6 w-6 text-red-400" />
                                    <div>
                                        <div className="text-red-400 font-medium">Time Warning</div>
                                        <div className="text-red-300 text-sm">Only {formatTime(timeRemaining)} remaining!</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        {integrityMonitoring && showProctoring && (
                            <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden">
                                <IntegratedProctorSystem
                                    userId={user?.id || 0}
                                    cohortId={cohortId ? parseInt(cohortId) : undefined}
                                    taskId={taskId ? parseInt(taskId) : undefined}
                                    sensitivity="medium"
                                    autoStart={assessmentStarted}
                                    onSessionEnd={(sessionId) => setIntegritySessionId(sessionId)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
