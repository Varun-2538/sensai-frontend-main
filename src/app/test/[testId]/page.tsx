'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Clock,
    Code,
    FileText,
    AlertTriangle,
    Shield,
    CheckCircle,
    ArrowLeft,
    ArrowRight,
    Eye,
    EyeOff
} from 'lucide-react';
import { CodeEditor, TextEditor } from '@/components/test';
import IntegratedProctorSystem from '@/components/IntegratedProctorSystem';
import { proctorAPI, type TestSession } from '@/lib/proctor-api';

type QuestionType = 'coding' | 'writing' | 'multiple_choice';

interface Question {
    id: number;
    type: QuestionType;
    title: string;
    description: string;
    content?: string;
    starter_code?: string;
    language?: string;
    time_limit?: number;
    points: number;
}

// Mock test data - in real implementation, this would come from API
const mockTest = {
    id: 'test_001',
    name: 'Full Stack Developer Assessment',
    description: 'Comprehensive assessment covering coding, problem-solving, and communication skills.',
    time_limit: 7200, // 2 hours in seconds
    questions: [
        {
            id: 1,
            type: 'coding' as QuestionType,
            title: 'Implement Array Sorting',
            description: 'Implement a function that sorts an array of integers in ascending order without using built-in sort methods.',
            starter_code: `function sortArray(arr) {
  // Your implementation here
  
}

// Test cases
console.log(sortArray([64, 34, 25, 12, 22, 11, 90])); // Expected: [11, 12, 22, 25, 34, 64, 90]`,
            language: 'javascript',
            time_limit: 1800, // 30 minutes
            points: 25
        },
        {
            id: 2,
            type: 'writing' as QuestionType,
            title: 'System Design Explanation',
            description: 'Explain how you would design a scalable web application to handle 1 million concurrent users. Include considerations for database, caching, load balancing, and security.',
            content: '',
            time_limit: 1200, // 20 minutes
            points: 20
        },
        {
            id: 3,
            type: 'coding' as QuestionType,
            title: 'API Integration',
            description: 'Create a React component that fetches user data from an API and displays it with error handling and loading states.',
            starter_code: `import React, { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  // Your implementation here
  
  return (
    <div>
      {/* Your JSX here */}
    </div>
  );
}

export default UserProfile;`,
            language: 'javascript',
            time_limit: 2400, // 40 minutes
            points: 30
        },
        {
            id: 4,
            type: 'writing' as QuestionType,
            title: 'Problem-Solving Approach',
            description: 'Describe a challenging technical problem you encountered in a previous project. Explain your approach to diagnosing and solving it, including any tools or methodologies you used.',
            content: '',
            time_limit: 900, // 15 minutes
            points: 15
        }
    ] as Question[]
};

export default function TestTakingPage() {
    const params = useParams();
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading, user } = useAuth();

    const testId = params.testId as string;

    // State
    const [session, setSession] = useState<TestSession | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [timeRemaining, setTimeRemaining] = useState(mockTest.time_limit);
    const [questionTimeRemaining, setQuestionTimeRemaining] = useState(0);
    const [isTestStarted, setIsTestStarted] = useState(false);
    const [isTestCompleted, setIsTestCompleted] = useState(false);
    const [showProctoring, setShowProctoring] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs
    const testTimerRef = useRef<NodeJS.Timeout | null>(null);
    const questionTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize session
    useEffect(() => {
        if (!isAuthenticated && !user) {
            // In development mode, create a mock user if auth fails
            if (process.env.NODE_ENV === 'development') {
                console.log('Development mode: Using mock user');
                // We'll still need to wait for auth to complete
                return;
            } else {
                return;
            }
        }

        const initializeSession = async () => {
            try {
                setLoading(true);

                // Use mock user in development if no real user
                const currentUser = user || {
                    id: '123',
                    name: 'Test User',
                    email: 'test@example.com'
                };

                // Check if we're in development mode and API is not available
                const isDevelopment = process.env.NODE_ENV === 'development';

                let newSession: TestSession;

                if (isDevelopment) {
                    // Try API first, fallback to mock data if it fails
                    try {
                        newSession = await proctorAPI.createTestSession({
                            user_id: parseInt(currentUser.id),
                            test_id: testId,
                            test_name: mockTest.name,
                            test_type: 'mixed',
                            test_config: {
                                time_limit: mockTest.time_limit,
                                allow_code_editor: true,
                                allow_text_editor: true,
                                monitoring_sensitivity: 'high'
                            }
                        });
                    } catch (apiError) {
                        console.warn('API not available, using mock session data:', apiError);
                        // Create mock session for development
                        newSession = {
                            id: Math.floor(Math.random() * 1000),
                            session_uuid: `test-session-${Date.now()}`,
                            user_id: parseInt(currentUser.id),
                            cohort_id: 1,
                            task_id: 1,
                            test_id: testId,
                            test_name: mockTest.name,
                            test_type: 'mixed',
                            current_question: 0,
                            total_questions: mockTest.questions.length,
                            test_config: {
                                time_limit: mockTest.time_limit,
                                allow_code_editor: true,
                                allow_text_editor: true,
                                monitoring_sensitivity: 'high'
                            },
                            monitoring_config: {},
                            session_start: new Date().toISOString(),
                            status: 'active'
                        };
                    }
                } else {
                    // Production mode - API must be available
                    newSession = await proctorAPI.createTestSession({
                        user_id: parseInt(currentUser.id),
                        test_id: testId,
                        test_name: mockTest.name,
                        test_type: 'mixed',
                        test_config: {
                            time_limit: mockTest.time_limit,
                            allow_code_editor: true,
                            allow_text_editor: true,
                            monitoring_sensitivity: 'high'
                        }
                    });
                }

                setSession(newSession);
            } catch (err) {
                setError(`Failed to initialize test session: ${err}`);
            } finally {
                setLoading(false);
            }
        };

        initializeSession();
    }, [isAuthenticated, user, testId]);

    // Timer management
    useEffect(() => {
        if (!isTestStarted) return;

        // Main test timer
        testTimerRef.current = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    completeTest();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (testTimerRef.current) {
                clearInterval(testTimerRef.current);
            }
        };
    }, [isTestStarted]);

    // Question timer
    useEffect(() => {
        if (!isTestStarted || !mockTest.questions[currentQuestion]?.time_limit) return;

        const questionLimit = mockTest.questions[currentQuestion].time_limit!;
        setQuestionTimeRemaining(questionLimit);

        questionTimerRef.current = setInterval(() => {
            setQuestionTimeRemaining(prev => {
                if (prev <= 1) {
                    // Auto-save and move to next question
                    saveCurrentAnswer();
                    if (currentQuestion < mockTest.questions.length - 1) {
                        setCurrentQuestion(currentQuestion + 1);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (questionTimerRef.current) {
                clearInterval(questionTimerRef.current);
            }
        };
    }, [isTestStarted, currentQuestion]);

    const startTest = () => {
        setIsTestStarted(true);
        setQuestionTimeRemaining(mockTest.questions[0].time_limit || 0);
    };

    const saveCurrentAnswer = async () => {
        if (!session) return;

        try {
            // Only call API if not in mock mode
            if (session.session_uuid.startsWith('test-session-')) {
                console.log('Mock mode: Saving progress locally', {
                    current_question: currentQuestion + 1,
                    question_completion_time: mockTest.questions[currentQuestion].time_limit! - questionTimeRemaining
                });
            } else {
                await proctorAPI.updateTestProgress(session.session_uuid, {
                    current_question: currentQuestion + 1,
                    question_completion_time: mockTest.questions[currentQuestion].time_limit! - questionTimeRemaining
                });
            }
        } catch (err) {
            console.error('Failed to save progress:', err);
        }
    };

    const nextQuestion = () => {
        saveCurrentAnswer();
        if (currentQuestion < mockTest.questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        }
    };

    const previousQuestion = () => {
        saveCurrentAnswer();
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1);
        }
    };

    const completeTest = async () => {
        if (!session) return;

        try {
            await saveCurrentAnswer();
            setIsTestCompleted(true);
            setIsTestStarted(false);

            // End the monitoring session
            // This would typically trigger the onSessionEnd callback in IntegratedProctorSystem
        } catch (err) {
            setError(`Failed to complete test: ${err}`);
        }
    };

    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const getTimeColor = (time: number, limit: number): string => {
        const percentage = (time / limit) * 100;
        if (percentage <= 10) return 'text-red-500';
        if (percentage <= 25) return 'text-yellow-500';
        return 'text-green-500';
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="w-12 h-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthenticated && process.env.NODE_ENV !== 'development') {
        router.push('/login');
        return null;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Initializing test session...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <Card className="max-w-md w-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Test Session Error
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600 mb-4">{error}</p>
                        <Button onClick={() => router.push('/')} className="w-full">
                            Return Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isTestCompleted) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <Card className="max-w-2xl w-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-6 w-6" />
                            Test Completed Successfully
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-gray-600">
                                Thank you for completing the {mockTest.name}. Your responses have been submitted
                                and our proctoring system has recorded your session for review.
                            </p>

                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-medium text-gray-900 mb-2">Session Summary</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">Questions Answered:</span>
                                        <span className="ml-2 font-medium">{Object.keys(answers).length}/{mockTest.questions.length}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Time Used:</span>
                                        <span className="ml-2 font-medium">{formatTime(mockTest.time_limit - timeRemaining)}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Session ID:</span>
                                        <span className="ml-2 font-mono text-xs">{session?.session_uuid.slice(0, 8)}...</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Status:</span>
                                        <span className="ml-2 font-medium text-green-600">Complete</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={() => router.push('/')} className="flex-1">
                                    Return Home
                                </Button>
                                <Button variant="outline" onClick={() => router.push('/test-results')} className="flex-1">
                                    View Results
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const currentQuestionData = mockTest.questions[currentQuestion];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">{mockTest.name}</h1>
                            <p className="text-sm text-gray-500">Question {currentQuestion + 1} of {mockTest.questions.length}</p>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Development Mode Indicator */}
                            {process.env.NODE_ENV === 'development' && session?.session_uuid.startsWith('test-session-') && (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                    Mock Mode
                                </Badge>
                            )}

                            {/* Proctoring Status */}
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-green-600">Monitoring Active</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowProctoring(!showProctoring)}
                                    className="ml-2"
                                >
                                    {showProctoring ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>

                            {/* Timer */}
                            <div className="flex items-center gap-4">
                                {questionTimeRemaining > 0 && (
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500">Question Time</div>
                                        <div className={`font-mono font-bold ${getTimeColor(questionTimeRemaining, mockTest.questions[currentQuestion].time_limit || 0)}`}>
                                            {formatTime(questionTimeRemaining)}
                                        </div>
                                    </div>
                                )}

                                <div className="text-center">
                                    <div className="text-xs text-gray-500">Total Time</div>
                                    <div className={`font-mono font-bold ${getTimeColor(timeRemaining, mockTest.time_limit)}`}>
                                        {formatTime(timeRemaining)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-3">
                        {!isTestStarted ? (
                            // Test Instructions
                            <Card>
                                <CardHeader>
                                    <CardTitle>Test Instructions</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <p className="text-gray-600">{mockTest.description}</p>

                                        <Alert>
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertDescription>
                                                This test is monitored by our integrity system. Please ensure:
                                                <ul className="list-disc list-inside mt-2 space-y-1">
                                                    <li>Your camera and microphone are working</li>
                                                    <li>You are in a quiet, well-lit environment</li>
                                                    <li>Do not switch tabs or open other applications</li>
                                                    <li>Keep your face visible to the camera</li>
                                                    <li>Do not copy or paste from external sources</li>
                                                </ul>
                                            </AlertDescription>
                                        </Alert>

                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <h4 className="font-medium text-gray-900 mb-2">Test Overview</h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Total Questions:</span>
                                                    <span className="ml-2 font-medium">{mockTest.questions.length}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Time Limit:</span>
                                                    <span className="ml-2 font-medium">{formatTime(mockTest.time_limit)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Total Points:</span>
                                                    <span className="ml-2 font-medium">{mockTest.questions.reduce((sum, q) => sum + q.points, 0)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Question Types:</span>
                                                    <span className="ml-2 font-medium">Coding, Writing</span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button onClick={startTest} className="w-full" size="lg">
                                            Start Test
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            // Test Question
                            <div className="space-y-6">
                                {/* Question Header */}
                                <Card>
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="flex items-center gap-2">
                                                    {currentQuestionData.type === 'coding' ? (
                                                        <Code className="h-5 w-5" />
                                                    ) : (
                                                        <FileText className="h-5 w-5" />
                                                    )}
                                                    {currentQuestionData.title}
                                                </CardTitle>
                                                <div className="flex items-center gap-4 mt-2">
                                                    <Badge variant="outline">
                                                        {currentQuestionData.type === 'coding' ? 'Coding' : 'Writing'}
                                                    </Badge>
                                                    <span className="text-sm text-gray-500">
                                                        {currentQuestionData.points} points
                                                    </span>
                                                    {currentQuestionData.time_limit && (
                                                        <span className="text-sm text-gray-500">
                                                            {Math.floor(currentQuestionData.time_limit / 60)} minutes
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-gray-700">{currentQuestionData.description}</p>
                                    </CardContent>
                                </Card>

                                {/* Question Content */}
                                {currentQuestionData.type === 'coding' ? (
                                    <CodeEditor
                                        language={currentQuestionData.language || 'javascript'}
                                        value={answers[currentQuestionData.id] || currentQuestionData.starter_code || ''}
                                        onChange={(value: string) => setAnswers(prev => ({ ...prev, [currentQuestionData.id]: value }))}
                                        sessionUuid={session?.session_uuid || ''}
                                        userId={parseInt((user?.id || '123'))}
                                    />
                                ) : (
                                    <TextEditor
                                        value={answers[currentQuestionData.id] || ''}
                                        onChange={(value: string) => setAnswers(prev => ({ ...prev, [currentQuestionData.id]: value }))}
                                        sessionUuid={session?.session_uuid || ''}
                                        userId={parseInt((user?.id || '123'))}
                                    />
                                )}

                                {/* Navigation */}
                                <Card>
                                    <CardContent className="py-4">
                                        <div className="flex justify-between items-center">
                                            <Button
                                                variant="outline"
                                                onClick={previousQuestion}
                                                disabled={currentQuestion === 0}
                                                className="flex items-center gap-2"
                                            >
                                                <ArrowLeft className="h-4 w-4" />
                                                Previous
                                            </Button>

                                            <div className="flex gap-2">
                                                {currentQuestion === mockTest.questions.length - 1 ? (
                                                    <Button onClick={completeTest} className="bg-green-600 hover:bg-green-700">
                                                        Complete Test
                                                    </Button>
                                                ) : (
                                                    <Button onClick={nextQuestion} className="flex items-center gap-2">
                                                        Next
                                                        <ArrowRight className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="space-y-6">
                            {/* Question Navigator */}
                            {isTestStarted && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm">Questions</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 gap-2">
                                            {mockTest.questions.map((_, index) => (
                                                <Button
                                                    key={index}
                                                    variant={index === currentQuestion ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => {
                                                        saveCurrentAnswer();
                                                        setCurrentQuestion(index);
                                                    }}
                                                    className={`h-8 ${answers[mockTest.questions[index].id] ? 'bg-green-100 border-green-300' : ''}`}
                                                >
                                                    {index + 1}
                                                    {answers[mockTest.questions[index].id] && (
                                                        <CheckCircle className="h-3 w-3 ml-1 text-green-600" />
                                                    )}
                                                </Button>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Proctoring System */}
                            {session && showProctoring && (
                                <IntegratedProctorSystem
                                    userId={parseInt((user?.id || '123'))}
                                    cohortId={session.cohort_id}
                                    taskId={session.task_id}
                                    sensitivity="high"
                                    autoStart={isTestStarted}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
