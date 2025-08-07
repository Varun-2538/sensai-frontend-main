'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    AlertTriangle,
    Eye,
    Mouse,
    Keyboard,
    Camera,
    Shield,
    Clock,
    Activity
} from 'lucide-react';

import { EnhancedProctorEvent } from '@/lib/proctor-api';

interface SessionEventPlayerProps {
    events: EnhancedProctorEvent[];
    sessionUuid: string;
}

export default function SessionEventPlayer({ events, sessionUuid }: SessionEventPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentEventIndex, setCurrentEventIndex] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [filter, setFilter] = useState<'all' | 'flagged' | 'high_risk'>('all');
    const [showDetails, setShowDetails] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

        const filteredEvents = events.filter(event => {
        if (filter === 'flagged') return event.data?.flagged || false;
        if (filter === 'high_risk') return event.severity === 'high';
        return true;
    });

    const currentEvent = filteredEvents[currentEventIndex];

    useEffect(() => {
        if (isPlaying && currentEventIndex < filteredEvents.length - 1) {
            intervalRef.current = setInterval(() => {
                setCurrentEventIndex(prev => {
                    if (prev >= filteredEvents.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, Math.max(500, 2000 / playbackSpeed));
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isPlaying, currentEventIndex, filteredEvents.length, playbackSpeed]);

    const togglePlayback = () => {
        setIsPlaying(!isPlaying);
    };

    const skipToEvent = (index: number) => {
        setCurrentEventIndex(Math.max(0, Math.min(index, filteredEvents.length - 1)));
        setIsPlaying(false);
    };

    const getEventIcon = (eventType: string) => {
        switch (eventType) {
            case 'window_focus': case 'window_blur': case 'tab_switch': return <Eye className="h-4 w-4" />;
            case 'mouse_click': case 'mouse_move': return <Mouse className="h-4 w-4" />;
            case 'keystroke': case 'text_input': case 'keystroke_pattern_anomaly': return <Keyboard className="h-4 w-4" />;
            case 'face_not_detected': case 'multiple_faces': case 'looking_away': return <Camera className="h-4 w-4" />;
            case 'suspicious_activity': case 'devtools_opened': return <Shield className="h-4 w-4" />;
            case 'system_event': default: return <Activity className="h-4 w-4" />;
        }
    };

    const getSeverityColor = (severity: string): string => {
        switch (severity) {
            case 'low': return 'bg-gray-100 text-gray-700 border-gray-300';
            case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
            case 'high': return 'bg-red-100 text-red-700 border-red-300';
            default: return 'bg-gray-100 text-gray-700 border-gray-300';
        }
    };

    const formatTimestamp = (timestamp: number): string => {
        return new Date(timestamp).toLocaleTimeString();
    };

    const getTimelineProgress = (): number => {
        if (filteredEvents.length === 0) return 0;
        return (currentEventIndex / (filteredEvents.length - 1)) * 100;
    };

    const getEventDescription = (event: EnhancedProctorEvent): string => {
        const type = event.type.replace('_', ' ');
        const context = event.context;
        
        if (context?.test_id) {
            return `${type} during test ${context.test_id}`;
        }
        if (context?.editor_type) {
            return `${type} in ${context.editor_type} editor`;
        }
        return type;
    };

    if (filteredEvents.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No events match the current filter.</p>
                    <p className="text-gray-500 text-sm mt-2">Try adjusting the filter settings.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Player Controls */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Event Timeline Player</CardTitle>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                                Event {currentEventIndex + 1} of {filteredEvents.length}
                            </span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Timeline Progress */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">
                                {currentEvent ? formatTimestamp(currentEvent.timestamp) : '--:--:--'}
                            </span>
                            <span className="text-sm text-gray-600">
                                {Math.round(getTimelineProgress())}% Complete
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${getTimelineProgress()}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between mt-2">
                            <span className="text-xs text-gray-500">Start</span>
                            <span className="text-xs text-gray-500">End</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex justify-center items-center gap-4 mb-6">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => skipToEvent(currentEventIndex - 1)}
                            disabled={currentEventIndex === 0}
                        >
                            <SkipBack className="h-4 w-4" />
                        </Button>

                        <Button
                            onClick={togglePlayback}
                            disabled={currentEventIndex >= filteredEvents.length - 1}
                            className="px-8"
                        >
                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            <span className="ml-2">{isPlaying ? 'Pause' : 'Play'}</span>
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => skipToEvent(currentEventIndex + 1)}
                            disabled={currentEventIndex >= filteredEvents.length - 1}
                        >
                            <SkipForward className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Playback Options */}
                    <div className="flex justify-center items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Volume2 className="h-4 w-4 text-gray-600" />
                            <span className="text-sm text-gray-600">Speed:</span>
                            <select
                                value={playbackSpeed}
                                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                                className="text-sm border rounded px-2 py-1"
                            >
                                <option value={0.5}>0.5x</option>
                                <option value={1}>1x</option>
                                <option value={2}>2x</option>
                                <option value={4}>4x</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Filter:</span>
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as any)}
                                className="text-sm border rounded px-2 py-1"
                            >
                                <option value="all">All Events</option>
                                <option value="flagged">Flagged Only</option>
                                <option value="high_risk">High Risk Only</option>
                            </select>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDetails(!showDetails)}
                        >
                            {showDetails ? 'Hide' : 'Show'} Details
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Current Event Display */}
            {currentEvent && (
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            {getEventIcon(currentEvent.type)}
                            <div>
                                <CardTitle className="text-lg capitalize">
                                    {currentEvent.type.replace('_', ' ')}
                                </CardTitle>
                                <p className="text-sm text-gray-600">
                                    {formatTimestamp(currentEvent.timestamp)}
                                </p>
                            </div>
                        </div>                            <div className="flex items-center gap-2">
                                <Badge className={getSeverityColor(currentEvent.severity)}>
                                    {currentEvent.severity.toUpperCase()}
                                </Badge>
                                {currentEvent.data?.flagged && (
                                    <Badge variant="destructive">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        Flagged
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-700 mb-4">
                            {currentEvent.context?.test_id ? `${currentEvent.type.replace('_', ' ')} during test ${currentEvent.context.test_id}` : 
                             currentEvent.context?.editor_type ? `${currentEvent.type.replace('_', ' ')} in ${currentEvent.context.editor_type} editor` : 
                             currentEvent.type.replace('_', ' ')}
                        </p>

                        {showDetails && currentEvent.data && (
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Event Details:</h4>
                                <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto max-h-64">
                                    {JSON.stringify(currentEvent.data, null, 2)}
                                </pre>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Event List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Event List</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredEvents.map((event, index) => (
                            <div
                                key={`${event.timestamp}-${index}`}
                                onClick={() => skipToEvent(index)}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${index === currentEventIndex
                                        ? 'bg-blue-100 border-2 border-blue-300'
                                        : 'bg-gray-50 hover:bg-gray-100'
                                    }`}
                            >
                                <div className="flex-shrink-0">
                                    {getEventIcon(event.type)}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-medium text-sm capitalize">
                                                {event.type.replace('_', ' ')}
                                            </h4>
                                            <p className="text-xs text-gray-600 truncate">
                                                {event.context?.test_id ? `Test ${event.context.test_id}` : 
                                                 event.context?.editor_type ? `${event.context.editor_type} editor` : 
                                                 'System event'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2">
                                            <span className="text-xs text-gray-500">
                                                {formatTimestamp(event.timestamp)}
                                            </span>
                                            <Badge className={getSeverityColor(event.severity)}>
                                                {event.severity}
                                            </Badge>
                                            {event.data?.flagged && (
                                                <AlertTriangle className="h-3 w-3 text-red-500" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
