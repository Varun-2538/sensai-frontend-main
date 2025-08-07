'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Search,
    User,
    Mail,
    Clock,
    AlertTriangle,
    CheckCircle,
    Eye,
    TrendingDown,
    TrendingUp,
    Calendar
} from 'lucide-react';
import { proctorAPI, type StudentSession } from '@/lib/proctor-api';

interface StudentLookupProps {
    onStudentSelect: (studentId: number) => void;
}

export default function StudentLookup({ onStudentSelect }: StudentLookupProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<StudentSession[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<StudentSession | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        setError(null);

        try {
            // Try to parse as student ID first
            const studentId = parseInt(searchQuery);
            if (!isNaN(studentId)) {
                const student = await proctorAPI.getStudentLookup(studentId);
                setSearchResults([student]);
            } else {
                // Search by name or email
                const results = await proctorAPI.searchStudents(searchQuery);
                setSearchResults(results);
            }
        } catch (err) {
            setError(`Failed to search students: ${err}`);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery]);

    const handleStudentSelect = (student: StudentSession) => {
        setSelectedStudent(student);
        onStudentSelect(student.student_id);
    };

    const getIntegrityScoreColor = (score: number): string => {
        if (score >= 80) return 'text-green-600 bg-green-50';
        if (score >= 60) return 'text-yellow-600 bg-yellow-50';
        return 'text-red-600 bg-red-50';
    };

    const getIntegrityTrend = (sessions: any[]): 'up' | 'down' | 'stable' => {
        if (sessions.length < 2) return 'stable';

        const recent = sessions.slice(-3);
        const avg = recent.reduce((sum, s) => sum + (s.integrity_score || 0), 0) / recent.length;
        const previous = sessions.slice(-6, -3);
        const prevAvg = previous.length > 0
            ? previous.reduce((sum, s) => sum + (s.integrity_score || 0), 0) / previous.length
            : avg;

        if (avg > prevAvg + 5) return 'up';
        if (avg < prevAvg - 5) return 'down';
        return 'stable';
    };

    return (
        <div className="space-y-6">
            {/* Search Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Student Lookup
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Enter student ID, name, or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <Button
                                onClick={handleSearch}
                                disabled={isSearching || !searchQuery.trim()}
                                className="px-6"
                            >
                                {isSearching ? 'Searching...' : 'Search'}
                            </Button>
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                {error}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Search Results */}
            {searchResults.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Search Results ({searchResults.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {searchResults.map((student) => {
                                const trend = getIntegrityTrend(student.session_history);

                                return (
                                    <div
                                        key={student.student_id}
                                        className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${selectedStudent?.student_id === student.student_id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                            }`}
                                        onClick={() => handleStudentSelect(student)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <User className="h-5 w-5 text-gray-400" />
                                                    <div>
                                                        <h3 className="font-medium text-gray-900">{student.student_name}</h3>
                                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                                            <Mail className="h-3 w-3" />
                                                            {student.student_email}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Student Stats */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                                                    <div className="text-center p-2 bg-gray-50 rounded">
                                                        <div className="text-lg font-bold text-gray-900">
                                                            {student.integrity_summary.total_sessions}
                                                        </div>
                                                        <div className="text-xs text-gray-500">Total Sessions</div>
                                                    </div>

                                                    <div className="text-center p-2 bg-gray-50 rounded">
                                                        <div className={`text-lg font-bold ${getIntegrityScoreColor(student.integrity_summary.average_score).split(' ')[0]}`}>
                                                            {Math.round(student.integrity_summary.average_score)}%
                                                        </div>
                                                        <div className="text-xs text-gray-500">Avg Score</div>
                                                    </div>

                                                    <div className="text-center p-2 bg-gray-50 rounded">
                                                        <div className="text-lg font-bold text-red-600">
                                                            {student.integrity_summary.flagged_sessions}
                                                        </div>
                                                        <div className="text-xs text-gray-500">Flagged</div>
                                                    </div>

                                                    <div className="text-center p-2 bg-gray-50 rounded">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                                                            {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                                                            {trend === 'stable' && <div className="w-4 h-4 bg-gray-400 rounded-full" />}
                                                            <span className="text-sm font-medium">
                                                                {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-gray-500">Trend</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="ml-4 text-right">
                                                {/* Active Sessions */}
                                                {student.active_sessions.length > 0 && (
                                                    <Badge variant="default" className="mb-2">
                                                        {student.active_sessions.length} Active Session{student.active_sessions.length > 1 ? 's' : ''}
                                                    </Badge>
                                                )}

                                                {/* Last Session */}
                                                {student.integrity_summary.last_session_date && (
                                                    <div className="text-sm text-gray-500 flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        Last: {new Date(student.integrity_summary.last_session_date).toLocaleDateString()}
                                                    </div>
                                                )}

                                                {/* Risk Level */}
                                                <div className="mt-2">
                                                    {student.integrity_summary.average_score >= 80 ? (
                                                        <Badge className="bg-green-100 text-green-800">Low Risk</Badge>
                                                    ) : student.integrity_summary.average_score >= 60 ? (
                                                        <Badge className="bg-yellow-100 text-yellow-800">Medium Risk</Badge>
                                                    ) : (
                                                        <Badge className="bg-red-100 text-red-800">High Risk</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Student Details */}
            {selectedStudent && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Eye className="h-5 w-5" />
                            Student Details: {selectedStudent.student_name}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {/* Active Sessions */}
                            {selectedStudent.active_sessions.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Active Sessions</h4>
                                    <div className="space-y-2">
                                        {selectedStudent.active_sessions.map((session) => (
                                            <div key={session.session_uuid} className="flex justify-between items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                <div>
                                                    <div className="font-medium">{session.test_name || `Test ${session.test_id}`}</div>
                                                    <div className="text-sm text-gray-600">
                                                        Started: {new Date(session.session_start).toLocaleString()}
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        Type: {session.test_type || 'Unknown'}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <Badge variant="default">
                                                        {session.status.toUpperCase()}
                                                    </Badge>
                                                    <div className="text-sm text-gray-600 mt-1">
                                                        Question {session.current_question || 0}/{session.total_questions || 0}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recent Session History */}
                            <div>
                                <h4 className="font-medium text-gray-900 mb-3">Recent Session History</h4>
                                <div className="space-y-2">
                                    {selectedStudent.session_history.slice(0, 5).map((session) => (
                                        <div key={session.session_uuid} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <div className="font-medium">{session.test_name || `Test ${session.test_id}`}</div>
                                                <div className="text-sm text-gray-600">
                                                    {new Date(session.session_start).toLocaleDateString()} - {session.test_type}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant={session.status === 'completed' ? 'default' : 'outline'}>
                                                    {session.status.toUpperCase()}
                                                </Badge>
                                                {/* Add integrity score display if available */}
                                            </div>
                                        </div>
                                    ))}

                                    {selectedStudent.session_history.length === 0 && (
                                        <div className="text-center py-8 text-gray-500">
                                            No session history available
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-4 border-t">
                                <Button onClick={() => handleStudentSelect(selectedStudent)}>
                                    View Detailed Analysis
                                </Button>
                                <Button variant="outline">
                                    View All Sessions
                                </Button>
                                <Button variant="outline">
                                    Generate Report
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {searchResults.length === 0 && searchQuery && !isSearching && !error && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No students found matching your search.</p>
                        <p className="text-gray-500 text-sm mt-2">
                            Try searching by student ID, name, or email address.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
