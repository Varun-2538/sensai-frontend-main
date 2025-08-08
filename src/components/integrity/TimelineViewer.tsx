"use client";

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { 
    AlertTriangle, 
    Eye, 
    Copy, 
    MousePointer, 
    Monitor,
    Clock,
    Flag,
    Camera,
    Mic,
    Activity
} from 'lucide-react';
import { integrityAPI, type ProctorEvent } from '@/lib/integrity-api';

interface TimelineViewerProps {
    sessionUuid: string;
    userId: number;
}

type EventType = 
    | 'face_not_detected'
    | 'multiple_faces' 
    | 'looking_away'
    | 'head_movement'
    | 'pose_change'
    | 'tab_switch'
    | 'window_blur'
    | 'copy_paste'
    | 'suspicious_activity';

type SeverityLevel = 'low' | 'medium' | 'high';

const eventIcons: Record<EventType, React.ComponentType<{ className?: string }>> = {
    'face_not_detected': Eye,
    'multiple_faces': Eye,
    'looking_away': Eye,
    'head_movement': Activity,
    'pose_change': Activity,
    'tab_switch': Monitor,
    'window_blur': Monitor,
    'copy_paste': Copy,
    'suspicious_activity': AlertTriangle,
};

const severityColors: Record<SeverityLevel, string> = {
    'low': 'text-blue-400 bg-blue-900/20',
    'medium': 'text-yellow-400 bg-yellow-900/20',
    'high': 'text-red-400 bg-red-900/20',
};

// Helper function to safely format event types
const formatEventType = (eventType: string | undefined): string => {
    if (!eventType || typeof eventType !== 'string') {
        return 'UNKNOWN EVENT';
    }
    return eventType.replace('_', ' ').toUpperCase();
};

// Helper function to safely get event type for processing
const getEventType = (eventType: string | undefined): EventType => {
    if (!eventType || typeof eventType !== 'string') {
        return 'suspicious_activity'; // fallback to a valid EventType
    }
    return eventType as EventType;
};

export default function TimelineViewer({ sessionUuid, userId }: TimelineViewerProps) {
    const [events, setEvents] = useState<ProctorEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<ProctorEvent | null>(null);
    const [filterSeverity, setFilterSeverity] = useState<SeverityLevel | 'all'>('all');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const eventsData = await integrityAPI.getSessionEvents(sessionUuid);
                // Ensure we have valid event data with safety checks
                const safeEvents = (eventsData || []).filter(event => 
                    event && typeof event === 'object'
                );
                setEvents(safeEvents);
            } catch (error) {
                console.error('Failed to fetch events:', error);
                setError(`Failed to load event timeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                setLoading(false);
            }
        };

        if (sessionUuid) {
            fetchEvents();
        } else {
            setError('No session UUID provided');
            setLoading(false);
        }
    }, [sessionUuid]);

    const filteredEvents = useMemo(() => {
        if (filterSeverity === 'all') return events;
        return events.filter(event => event.severity === filterSeverity);
    }, [events, filterSeverity]);

    const groupedEvents = useMemo(() => {
        const groups: { [key: string]: ProctorEvent[] } = {};
        filteredEvents.forEach(event => {
            const timeKey = event.timestamp ? format(new Date(event.timestamp), 'HH:mm') : 'Unknown';
            if (!groups[timeKey]) groups[timeKey] = [];
            groups[timeKey].push(event);
        });
        return groups;
    }, [filteredEvents]);

    if (loading) {
        return (
            <div className="bg-gray-900 rounded-lg p-6">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-12 bg-gray-700 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-gray-900 rounded-lg p-6">
                <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                    <p className="text-gray-400">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-white">Assessment Timeline</h3>
                
                {/* Severity Filter */}
                <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value as SeverityLevel | 'all')}
                    className="bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700"
                >
                    <option value="all">All Events ({events.length})</option>
                    <option value="low">Low Severity ({events.filter(e => e.severity === 'low').length})</option>
                    <option value="medium">Medium Severity ({events.filter(e => e.severity === 'medium').length})</option>
                    <option value="high">High Severity ({events.filter(e => e.severity === 'high').length})</option>
                </select>
            </div>

            {/* Event Statistics */}
            {events.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-800 rounded-lg">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">{events.filter(e => e.severity === 'low').length}</div>
                        <div className="text-sm text-gray-400">Low Severity</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">{events.filter(e => e.severity === 'medium').length}</div>
                        <div className="text-sm text-gray-400">Medium Severity</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-400">{events.filter(e => e.severity === 'high').length}</div>
                        <div className="text-sm text-gray-400">High Severity</div>
                    </div>
                </div>
            )}

            {/* Timeline */}
            <div className="space-y-6">
                {Object.entries(groupedEvents).map(([timeKey, timeEvents]) => (
                    <div key={timeKey} className="relative">
                        {/* Time Header */}
                        <div className="flex items-center mb-4">
                            <Clock className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-gray-400 font-medium">{timeKey}</span>
                            <div className="flex-1 h-px bg-gray-700 ml-4"></div>
                        </div>

                        {/* Events for this time */}
                        <div className="space-y-3 ml-6">
                            {timeEvents.map((event, index) => {
                                const safeEventType = getEventType(event.type);
                                const IconComponent = eventIcons[safeEventType] || AlertTriangle;
                                return (
                                    <div
                                        key={index}
                                        onClick={() => setSelectedEvent(event)}
                                        className={`
                                            flex items-start p-4 rounded-lg cursor-pointer transition-colors
                                            ${severityColors[event.severity] || 'text-gray-400 bg-gray-900/20'}
                                            hover:bg-opacity-40
                                        `}
                                    >
                                        <IconComponent className="w-5 h-5 mr-3 mt-0.5" />
                                        
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-medium">
                                                    {formatEventType(event.type)}
                                                </span>
                                                <span className="text-xs opacity-70">
                                                    {event.timestamp ? format(new Date(event.timestamp), 'HH:mm:ss') : 'Unknown time'}
                                                </span>
                                            </div>
                                            
                                            <p className="text-sm opacity-80">
                                                {getEventDescription(event)}
                                            </p>

                                            {/* Severity Badge */}
                                            <div className="mt-2">
                                                <span className={`
                                                    px-2 py-1 rounded text-xs font-medium
                                                    ${severityColors[event.severity] || 'text-gray-400 bg-gray-900/20'}
                                                `}>
                                                    {(event.severity || 'unknown').toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {filteredEvents.length === 0 && events.length > 0 && (
                    <div className="text-center py-8">
                        <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">No events found for selected severity level</p>
                    </div>
                )}

                {events.length === 0 && (
                    <div className="text-center py-8">
                        <Camera className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">No integrity events recorded</p>
                        <p className="text-gray-500 text-sm mt-2">This indicates a clean assessment session</p>
                    </div>
                )}
            </div>

            {/* Event Detail Modal */}
            {selectedEvent && (
                <EventDetailModal
                    event={selectedEvent}
                    onClose={() => setSelectedEvent(null)}
                />
            )}
        </div>
    );
}

function getEventDescription(event: ProctorEvent): string {
    const eventType = getEventType(event.type);
    
    switch (eventType) {
        case 'face_not_detected':
            return 'No face detected in the camera feed';
        case 'multiple_faces':
            return 'Multiple faces detected simultaneously';
        case 'looking_away':
            return 'User looking away from the screen';
        case 'head_movement':
            return 'Excessive head movement detected';
        case 'pose_change':
            return 'Significant posture change detected';
        case 'tab_switch':
            return 'User switched to a different browser tab';
        case 'window_blur':
            return 'Assessment window lost focus';
        case 'copy_paste':
            return 'Copy or paste operation detected';
        case 'suspicious_activity':
            return 'Suspicious behavior pattern identified';
        default:
            return event.type ? `Event: ${formatEventType(event.type)}` : 'Unknown integrity monitoring event detected';
    }
}

// Event Detail Modal Component
function EventDetailModal({ 
    event, 
    onClose 
}: { 
    event: ProctorEvent; 
    onClose: () => void; 
}) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-lg p-6 max-w-lg w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-white">Event Details</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xl"
                    >
                        ×
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-gray-400">Event Type</label>
                        <p className="text-white font-medium">
                            {formatEventType(event.type)}
                        </p>
                    </div>

                    <div>
                        <label className="text-sm text-gray-400">Timestamp</label>
                        <p className="text-white">
                            {event.timestamp ? format(new Date(event.timestamp), 'PPpp') : 'Unknown timestamp'}
                        </p>
                    </div>

                    <div>
                        <label className="text-sm text-gray-400">Severity</label>
                        <span className={`
                            inline-block px-2 py-1 rounded text-xs font-medium ml-2
                            ${severityColors[event.severity] || 'text-gray-400 bg-gray-900/20'}
                        `}>
                            {(event.severity || 'unknown').toUpperCase()}
                        </span>
                    </div>

                    <div>
                        <label className="text-sm text-gray-400">Description</label>
                        <p className="text-white">
                            {getEventDescription(event)}
                        </p>
                    </div>

                    {event.data && Object.keys(event.data).length > 0 && (
                        <div>
                            <label className="text-sm text-gray-400">Event Data</label>
                            <pre className="bg-gray-800 p-3 rounded text-sm text-gray-300 overflow-auto max-h-32">
                                {JSON.stringify(event.data, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>

                <button
                    onClick={onClose}
                    className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg w-full"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
