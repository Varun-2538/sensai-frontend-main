'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    User,
    FileText,
    Download,
    Flag,
    Eye,
    Activity,
    BarChart,
    Calendar,
    Shield
} from 'lucide-react';
import { proctorAPI, type SessionDetailAnalysis } from '@/lib/proctor-api';
import { SessionEventPlayer } from './';

interface SessionAnalysisProps {
    studentId?: number | null;
    sessionUuid?: string | null;
    onBack: () => void;
}

export default function SessionAnalysis({ studentId, sessionUuid, onBack }: SessionAnalysisProps) {
    const [analysis, setAnalysis] = useState<SessionDetailAnalysis | null>(null);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'overview' | 'timeline' | 'patterns' | 'flags'>('overview');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sessionUuid) return;

        const loadSessionAnalysis = async () => {
            try {
                setLoading(true);
                setError(null);

                const analysisData = await proctorAPI.getSessionDetail(sessionUuid);
                setAnalysis(analysisData);
            } catch (err) {
                setError(`Failed to load session analysis: ${err}`);
                console.error('Session analysis error:', err);
            } finally {
                setLoading(false);
            }
        };

        loadSessionAnalysis();
    }, [sessionUuid]);

    const generateReport = async () => {
        if (!sessionUuid) return;

        try {
            const blob = await proctorAPI.generateSessionReport(sessionUuid, 'pdf');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `session-analysis-${sessionUuid.slice(0, 8)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to generate report:', error);
        }
    };

    const getIntegrityScoreColor = (score: number): string => {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getIntegrityIcon = (score: number) => {
        if (score >= 80) return <CheckCircle className="h-5 w-5 text-green-600" />;
        if (score >= 60) return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
        return <XCircle className="h-5 w-5 text-red-600" />;
    };

    const getRecommendationColor = (action: string): string => {
        switch (action) {
            case 'pass': return 'bg-green-100 text-green-800 border-green-300';
            case 'review': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'investigate': return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'fail': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardContent className="py-12 text-center">
                        <Activity className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
                        <p className="text-gray-600">Loading session analysis...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error || !analysis) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardContent className="py-12 text-center">
                        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <p className="text-gray-600">{error || 'Failed to load session analysis'}</p>
                        <Button onClick={onBack} className="mt-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const viewTabs = [
        { id: 'overview', label: 'Overview', icon: BarChart },
        { id: 'timeline', label: 'Event Timeline', icon: Clock },
        { id: 'patterns', label: 'Behavioral Patterns', icon: TrendingUp },
        { id: 'flags', label: 'Flags & Alerts', icon: Flag }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Button variant="outline" size="sm" onClick={onBack}>
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="h-5 w-5" />
                                    Session Analysis
                                </CardTitle>
                            </div>
                            <div className="text-sm text-gray-600">
                                Session: {analysis.session.session_uuid} • User: {analysis.session.user_id}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Integrity Score */}
                            <div className="text-center">
                                <div className="flex items-center gap-2">
                                    {getIntegrityIcon(analysis.integrity_score)}
                                    <span className={`text-2xl font-bold ${getIntegrityScoreColor(analysis.integrity_score)}`}>
                                        {analysis.integrity_score}%
                                    </span>
                                </div>
                                <div className="text-sm text-gray-500">Integrity Score</div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={generateReport}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Report
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Navigation Tabs */}
            <Card>
                <CardContent className="p-0">
                    <div className="flex border-b">
                        {viewTabs.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setViewMode(tab.id as any)}
                                    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${viewMode === tab.id
                                        ? 'border-b-2 border-blue-500 text-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Content */}
            {viewMode === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Session Summary */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Session Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                                        <div className="text-2xl font-bold text-blue-600">{analysis.total_events}</div>
                                        <div className="text-sm text-gray-500">Total Events</div>
                                    </div>
                                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                                        <div className="text-2xl font-bold text-red-600">{analysis.flagged_events}</div>
                                        <div className="text-sm text-gray-500">Flagged Events</div>
                                    </div>
                                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                                        <div className="text-2xl font-bold text-yellow-600">{analysis.flags_count}</div>
                                        <div className="text-sm text-gray-500">Flags Generated</div>
                                    </div>
                                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                                        <div className={`text-2xl font-bold ${getIntegrityScoreColor(analysis.integrity_score)}`}>
                                            {analysis.integrity_score}%
                                        </div>
                                        <div className="text-sm text-gray-500">Final Score</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Event Types Breakdown */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Event Distribution</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {Object.entries(analysis.event_types).map(([type, count]) => (
                                        <div key={type} className="flex justify-between items-center">
                                            <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-500 h-2 rounded-full"
                                                        style={{ width: `${(count / analysis.total_events) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <Badge variant="outline">{count}</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Behavioral Patterns */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Behavioral Analysis</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                                        <div className="text-lg font-bold text-blue-600">
                                            {analysis.behavioral_patterns.typing_patterns.average_speed} WPM
                                        </div>
                                        <div className="text-sm text-gray-500">Avg Typing Speed</div>
                                    </div>
                                    <div className="text-center p-3 bg-green-50 rounded-lg">
                                        <div className="text-lg font-bold text-green-600">
                                            {Math.round(analysis.behavioral_patterns.focus_patterns.total_focus_time / 60)} min
                                        </div>
                                        <div className="text-sm text-gray-500">Focus Time</div>
                                    </div>
                                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                                        <div className="text-lg font-bold text-purple-600">
                                            {analysis.behavioral_patterns.interaction_patterns.navigation_events}
                                        </div>
                                        <div className="text-sm text-gray-500">Navigation Events</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recommendation Panel */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">AI Recommendation</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className={`p-4 rounded-lg border-2 ${getRecommendationColor(analysis.recommendations.action)}`}>
                                        <div className="font-bold text-lg uppercase text-center">
                                            {analysis.recommendations.action}
                                        </div>
                                        <div className="text-center text-sm mt-1">
                                            Confidence: {analysis.recommendations.confidence}%
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-medium mb-2">Reasons:</h4>
                                        <ul className="text-sm space-y-1">
                                            {analysis.recommendations.reasons.map((reason, index) => (
                                                <li key={index} className="flex items-start gap-2">
                                                    <span className="text-red-500 mt-1">•</span>
                                                    {reason}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div>
                                        <h4 className="font-medium mb-2">Next Steps:</h4>
                                        <ul className="text-sm space-y-1">
                                            {analysis.recommendations.next_steps.map((step, index) => (
                                                <li key={index} className="flex items-start gap-2">
                                                    <span className="text-blue-500 mt-1">•</span>
                                                    {step}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Session Details */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Session Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Session ID:</span>
                                        <span className="font-mono text-xs">{analysis.session.session_uuid.slice(0, 16)}...</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">User ID:</span>
                                        <span>{analysis.session.user_id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Started:</span>
                                        <span>{new Date(analysis.session.session_start).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Status:</span>
                                        <Badge variant={analysis.session.status === 'completed' ? 'default' : 'outline'}>
                                            {analysis.session.status}
                                        </Badge>
                                    </div>
                                    {analysis.session.session_end && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Ended:</span>
                                            <span>{new Date(analysis.session.session_end).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {viewMode === 'timeline' && (
                <SessionEventPlayer
                    events={analysis.event_timeline}
                    sessionUuid={analysis.session.session_uuid}
                />
            )}

            {viewMode === 'patterns' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Typing Patterns */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Typing Patterns</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                                        <div className="text-xl font-bold text-blue-600">
                                            {analysis.behavioral_patterns.typing_patterns.average_speed}
                                        </div>
                                        <div className="text-sm text-gray-500">WPM Average</div>
                                    </div>
                                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                                        <div className="text-xl font-bold text-purple-600">
                                            {Math.round(analysis.behavioral_patterns.typing_patterns.speed_variance)}
                                        </div>
                                        <div className="text-sm text-gray-500">Speed Variance</div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2">Pause Patterns</h4>
                                    <div className="space-y-1">
                                        {analysis.behavioral_patterns.typing_patterns.pause_patterns.slice(0, 5).map((pause, index) => (
                                            <div key={index} className="flex justify-between text-sm">
                                                <span>Pause {index + 1}:</span>
                                                <span>{Math.round(pause / 1000)}s</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Focus Patterns */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Focus Patterns</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center p-3 bg-green-50 rounded-lg">
                                        <div className="text-xl font-bold text-green-600">
                                            {Math.round(analysis.behavioral_patterns.focus_patterns.total_focus_time / 60)}
                                        </div>
                                        <div className="text-sm text-gray-500">Minutes Focused</div>
                                    </div>
                                    <div className="text-center p-3 bg-red-50 rounded-lg">
                                        <div className="text-xl font-bold text-red-600">
                                            {analysis.behavioral_patterns.focus_patterns.focus_breaks}
                                        </div>
                                        <div className="text-sm text-gray-500">Focus Breaks</div>
                                    </div>
                                </div>

                                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                                    <div className="text-lg font-bold text-yellow-600">
                                        {Math.round(analysis.behavioral_patterns.focus_patterns.longest_unfocused_period / 60)} min
                                    </div>
                                    <div className="text-sm text-gray-500">Longest Unfocused Period</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Interaction Patterns */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Interaction Patterns</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-blue-50 rounded-lg">
                                    <div className="text-xl font-bold text-blue-600">
                                        {Math.round(analysis.behavioral_patterns.interaction_patterns.code_editor_time / 60)}
                                    </div>
                                    <div className="text-sm text-gray-500">Minutes in Code Editor</div>
                                </div>
                                <div className="text-center p-4 bg-green-50 rounded-lg">
                                    <div className="text-xl font-bold text-green-600">
                                        {Math.round(analysis.behavioral_patterns.interaction_patterns.text_editor_time / 60)}
                                    </div>
                                    <div className="text-sm text-gray-500">Minutes in Text Editor</div>
                                </div>
                                <div className="text-center p-4 bg-purple-50 rounded-lg">
                                    <div className="text-xl font-bold text-purple-600">
                                        {analysis.behavioral_patterns.interaction_patterns.navigation_events}
                                    </div>
                                    <div className="text-sm text-gray-500">Navigation Events</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {viewMode === 'flags' && (
                <div className="space-y-6">
                    {analysis.flag_details.map((flag) => (
                        <Card key={flag.flag_id}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg capitalize">
                                            {flag.flag_type.replace('_', ' ')}
                                        </CardTitle>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Flag ID: {flag.flag_id} • Confidence: {Math.round(flag.confidence * 100)}%
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant={flag.auto_generated ? 'default' : 'outline'}>
                                            {flag.auto_generated ? 'Auto-Generated' : 'Manual'}
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {flag.evidence && (
                                    <div className="mb-4">
                                        <h4 className="font-medium mb-2">Evidence:</h4>
                                        <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                                            {JSON.stringify(flag.evidence, null, 2)}
                                        </pre>
                                    </div>
                                )}
                                {flag.reviewer_notes && (
                                    <div>
                                        <h4 className="font-medium mb-2">Reviewer Notes:</h4>
                                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                                            {flag.reviewer_notes}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}

                    {analysis.flag_details.length === 0 && (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <p className="text-gray-600">No flags generated for this session.</p>
                                <p className="text-gray-500 text-sm mt-2">This indicates clean behavior throughout the assessment.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
