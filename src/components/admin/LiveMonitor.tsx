'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Eye,
    AlertTriangle,
    Clock,
    Shield,
    Activity,
    Users,
    CheckCircle,
    XCircle,
    Pause,
    Play,
    Monitor,
    TrendingUp,
    TrendingDown
} from 'lucide-react';
import { proctorAPI, type LiveSessionData } from '@/lib/proctor-api';

interface LiveMonitorProps {
    sessions: LiveSessionData[];
    onSessionSelect: (sessionUuid: string) => void;
}

export default function LiveMonitor({ sessions, onSessionSelect }: LiveMonitorProps) {
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'time' | 'score' | 'flags'>('score');
    const [filterBy, setFilterBy] = useState<'all' | 'high_risk' | 'flagged'>('all');
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Sort and filter sessions
    const filteredSessions = sessions
        .filter(session => {
            switch (filterBy) {
                case 'high_risk':
                    return session.current_integrity_score < 60;
                case 'flagged':
                    return session.active_flags > 0;
                default:
                    return true;
            }
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'time':
                    return new Date(b.last_event_time).getTime() - new Date(a.last_event_time).getTime();
                case 'score':
                    return a.current_integrity_score - b.current_integrity_score;
                case 'flags':
                    return b.active_flags - a.active_flags;
                default:
                    return 0;
            }
        });

    const getScoreColor = (score: number): string => {
        if (score >= 80) return 'text-green-600 bg-green-50';
        if (score >= 60) return 'text-yellow-600 bg-yellow-50';
        return 'text-red-600 bg-red-50';
    };

    const getScoreIcon = (score: number) => {
        if (score >= 80) return <CheckCircle className="h-4 w-4 text-green-600" />;
        if (score >= 60) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
        return <XCircle className="h-4 w-4 text-red-600" />;
    };

    const getSessionStatusIcon = (session: LiveSessionData) => {
        const timeSinceLastEvent = Date.now() - new Date(session.last_event_time).getTime();

        if (timeSinceLastEvent > 300000) { // 5 minutes
            return <Pause className="h-4 w-4 text-gray-500" />;
        }
        return <Play className="h-4 w-4 text-green-500" />;
    };

    const getSessionRiskLevel = (session: LiveSessionData): 'low' | 'medium' | 'high' => {
        if (session.current_integrity_score < 60 || session.active_flags > 3) return 'high';
        if (session.current_integrity_score < 80 || session.active_flags > 1) return 'medium';
        return 'low';
    };

    const handleSessionClick = (session: LiveSessionData) => {
        setSelectedSession(session.session.session_uuid);
        onSessionSelect(session.session.session_uuid);
    };

    return (
        <div className="space-y-6">
            {/* Controls */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2">
                            <Monitor className="h-5 w-5" />
                            Live Session Monitor
                            <Badge variant="default">{sessions.length} Active</Badge>
                        </CardTitle>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Filter:</label>
                                <select
                                    value={filterBy}
                                    onChange={(e) => setFilterBy(e.target.value as any)}
                                    className="px-3 py-1 border border-gray-300 rounded text-sm"
                                >
                                    <option value="all">All Sessions</option>
                                    <option value="high_risk">High Risk Only</option>
                                    <option value="flagged">Flagged Only</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">Sort by:</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="px-3 py-1 border border-gray-300 rounded text-sm"
                                >
                                    <option value="score">Integrity Score</option>
                                    <option value="flags">Flag Count</option>
                                    <option value="time">Last Activity</option>
                                </select>
                            </div>

                            <Button
                                variant={autoRefresh ? "default" : "outline"}
                                size="sm"
                                onClick={() => setAutoRefresh(!autoRefresh)}
                                className="flex items-center gap-2"
                            >
                                <Activity className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                                Auto Refresh
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Session Grid */}
            {filteredSessions.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredSessions.map((session) => {
                        const riskLevel = getSessionRiskLevel(session);
                        const timeSinceLastEvent = Date.now() - new Date(session.last_event_time).getTime();

                        return (
                            <Card
                                key={session.session.session_uuid}
                                className={`cursor-pointer transition-all hover:shadow-lg ${selectedSession === session.session.session_uuid ? 'ring-2 ring-blue-500' : ''
                                    } ${riskLevel === 'high' ? 'border-red-300' :
                                        riskLevel === 'medium' ? 'border-yellow-300' : 'border-gray-200'
                                    }`}
                                onClick={() => handleSessionClick(session)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                {getSessionStatusIcon(session)}
                                                Session {session.session.session_uuid.slice(0, 8)}
                                            </CardTitle>
                                            <p className="text-xs text-gray-500 mt-1">
                                                User {session.session.user_id} • {session.session.test_type || 'Test'}
                                            </p>
                                        </div>

                                        <Badge
                                            variant={riskLevel === 'high' ? 'destructive' : riskLevel === 'medium' ? 'default' : 'outline'}
                                            className="text-xs"
                                        >
                                            {riskLevel.toUpperCase()} RISK
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    {/* Integrity Score */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Integrity Score</span>
                                        <div className="flex items-center gap-2">
                                            {getScoreIcon(session.current_integrity_score)}
                                            <span className={`font-bold ${getScoreColor(session.current_integrity_score).split(' ')[0]}`}>
                                                {session.current_integrity_score}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Metrics Grid */}
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="text-center p-2 bg-gray-50 rounded">
                                            <div className="font-bold text-red-600">{session.active_flags}</div>
                                            <div className="text-gray-500">Active Flags</div>
                                        </div>
                                        <div className="text-center p-2 bg-gray-50 rounded">
                                            <div className="font-bold text-blue-600">{session.live_events.length}</div>
                                            <div className="text-gray-500">Live Events</div>
                                        </div>
                                    </div>

                                    {/* Behavioral Metrics */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500">Focus Time:</span>
                                            <span className={`font-medium ${session.behavioral_metrics.focus_time_percentage >= 80 ? 'text-green-600' :
                                                    session.behavioral_metrics.focus_time_percentage >= 60 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                {session.behavioral_metrics.focus_time_percentage}%
                                            </span>
                                        </div>

                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500">Typing Speed:</span>
                                            <span className="font-medium">
                                                {session.behavioral_metrics.typing_speed_avg} WPM
                                            </span>
                                        </div>

                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500">Anomalies:</span>
                                            <span className={`font-medium ${session.behavioral_metrics.pattern_anomalies > 3 ? 'text-red-600' :
                                                    session.behavioral_metrics.pattern_anomalies > 1 ? 'text-yellow-600' : 'text-green-600'
                                                }`}>
                                                {session.behavioral_metrics.pattern_anomalies}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Last Activity */}
                                    <div className="flex items-center justify-between text-xs pt-2 border-t">
                                        <div className="flex items-center gap-1 text-gray-500">
                                            <Clock className="h-3 w-3" />
                                            Last activity:
                                        </div>
                                        <span className={`font-medium ${timeSinceLastEvent > 300000 ? 'text-red-600' : 'text-green-600'
                                            }`}>
                                            {Math.round(timeSinceLastEvent / 60000)}m ago
                                        </span>
                                    </div>

                                    {/* Recent Events Preview */}
                                    {session.live_events.slice(0, 2).length > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium text-gray-700">Recent Events:</p>
                                            {session.live_events.slice(0, 2).map((event, index) => (
                                                <div key={index} className="text-xs p-2 bg-gray-50 rounded flex justify-between">
                                                    <span className="capitalize">{event.type.replace('_', ' ')}</span>
                                                    <Badge
                                                        variant={event.severity === 'high' ? 'destructive' : event.severity === 'medium' ? 'default' : 'outline'}
                                                        className="text-xs h-4"
                                                    >
                                                        {event.severity}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Action Button */}
                                    <Button
                                        size="sm"
                                        className="w-full"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSessionClick(session);
                                        }}
                                    >
                                        <Eye className="h-4 w-4 mr-2" />
                                        View Details
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">
                            {sessions.length === 0
                                ? 'No active monitoring sessions found.'
                                : 'No sessions match the current filter.'}
                        </p>
                        <p className="text-gray-500 text-sm mt-2">
                            {sessions.length === 0
                                ? 'Sessions will appear here when students start taking monitored tests.'
                                : 'Try adjusting your filter settings to see more sessions.'}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Summary Stats */}
            {sessions.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Session Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-blue-600">{sessions.length}</div>
                                <div className="text-xs text-gray-500">Total Active</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-red-600">
                                    {sessions.filter(s => getSessionRiskLevel(s) === 'high').length}
                                </div>
                                <div className="text-xs text-gray-500">High Risk</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-yellow-600">
                                    {sessions.filter(s => s.active_flags > 0).length}
                                </div>
                                <div className="text-xs text-gray-500">With Flags</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-green-600">
                                    {Math.round(sessions.reduce((sum, s) => sum + s.current_integrity_score, 0) / sessions.length)}%
                                </div>
                                <div className="text-xs text-gray-500">Avg Score</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
