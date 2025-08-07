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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <Card className="max-w-2xl w-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-purple-600" />
                            Assessment Mode
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-gray-600">This quiz is in assessment mode with a {durationMinutes}-minute time limit.{integrityMonitoring && ' Integrity monitoring is enabled.'}</p>
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                    Please ensure:
                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>Your camera and microphone are working</li>
                                        <li>You are in a quiet, well-lit environment</li>
                                        <li>Do not switch tabs or open other applications</li>
                                        <li>Keep your face visible to the camera</li>
                                        <li>Do not copy or paste from external sources</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>
                            <div className="flex items-center gap-6 bg-gray-50 p-4 rounded-lg">
                                <div className="text-center">
                                    <div className="text-xs text-gray-500">Total Time</div>
                                    <div className="font-mono font-bold">{formatTime(timeRemaining)}</div>
                                </div>
                                {integrityMonitoring && (
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-green-600" />
                                        <span className="text-sm text-green-700">Monitoring enabled</span>
                                    </div>
                                )}
                            </div>
                            <Button onClick={startAssessment} className="w-full" size="lg">Start Assessment</Button>
                            {onExitAssessment && (
                                <Button variant="outline" onClick={onExitAssessment} className="w-full">Back to Course</Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b shadow-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">Assessment Mode</h1>
                            <p className="text-sm text-gray-500">Timed assessment</p>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Monitoring Status */}
                            {integrityMonitoring && (
                                <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-green-600" />
                                    <span className="text-sm text-green-700">Monitoring Active</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowProctoring(!showProctoring)}
                                        className="ml-2"
                                    >
                                        {showProctoring ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            )}

                            {/* Timer */}
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-gray-700" />
                                <span className={`font-mono font-bold ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-900'}`}>
                                    {formatTime(timeRemaining)}
                                </span>
                            </div>

                            {/* Exit */}
                            {onExitAssessment && (
                                <Button
                                    onClick={() => {
                                        if (confirm('Are you sure you want to exit? Your progress may be lost.')) {
                                            onExitAssessment();
                                        }
                                    }}
                                    variant="destructive"
                                    size="sm"
                                >
                                    <X className="w-4 h-4 mr-1" /> Exit
                                </Button>
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
                        <Card>
                            <CardContent className="p-0">
                                <div className="relative">
                                    <LearnerQuizView {...quizProps} isTestMode={true} />
                                </div>
                            </CardContent>
                        </Card>

                        {timeRemaining <= 300 && timeRemaining > 0 && (
                            <Alert className="border-red-200">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <AlertDescription className="text-red-700 font-medium">
                                    {formatTime(timeRemaining)} remaining!
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        {integrityMonitoring && showProctoring && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Integrated Proctoring System</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <IntegratedProctorSystem
                                        userId={user?.id || 0}
                                        cohortId={cohortId ? parseInt(cohortId) : undefined}
                                        taskId={taskId ? parseInt(taskId) : undefined}
                                        sensitivity="medium"
                                        autoStart={assessmentStarted}
                                        onSessionEnd={(sessionId) => setIntegritySessionId(sessionId)}
                                    />
                                    {integritySessionId && (
                                        <div className="mt-3 flex items-center gap-2 text-green-700 text-sm">
                                            <CheckCircle className="h-4 w-4" />
                                            <span>Monitoring active</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
