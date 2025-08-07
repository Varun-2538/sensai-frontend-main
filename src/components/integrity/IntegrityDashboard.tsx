"use client";

import { useState, useEffect } from 'react';
import { Shield, Users, AlertTriangle, CheckCircle, Clock, Eye, TrendingUp } from 'lucide-react';
import TimelineViewer from './TimelineViewer';
import { integrityAPI, type SessionAnalysis } from '@/lib/integrity-api';

interface IntegrityDashboardProps {
    cohortId: number;
}

interface CohortOverview {
    cohort_id: number;
    total_sessions: number;
    average_integrity_score: number;
    total_flags: number;
    sessions_with_issues: number;
    session_analyses?: SessionAnalysis[];
}

interface EnhancedSessionAnalysis extends SessionAnalysis {
    user_name?: string;
    user_email?: string;
}

export default function IntegrityDashboard({ cohortId }: IntegrityDashboardProps) {
    const [overview, setOverview] = useState<CohortOverview | null>(null);
    const [sessionAnalyses, setSessionAnalyses] = useState<EnhancedSessionAnalysis[]>([]);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOverview = async () => {
            try {
                setLoading(true);
                setError(null);

                // Fetch cohort integrity overview
                const overviewData = await integrityAPI.getCohortOverview(cohortId, true);
                setOverview(overviewData);

                if (overviewData.session_analyses) {
                    // Enhance session data with user information
                    const enhancedSessions = await Promise.all(
                        overviewData.session_analyses.map(async (analysis) => {
                            try {
                                const userResponse = await fetch(
                                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/users/${analysis.session.user_id}`
                                );
                                const userData = await userResponse.json();
                                
                                return {
                                    ...analysis,
                                    user_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
                                    user_email: userData.email
                                } as EnhancedSessionAnalysis;
                            } catch {
                                return analysis as EnhancedSessionAnalysis;
                            }
                        })
                    );

                    setSessionAnalyses(enhancedSessions);
                }
            } catch (error) {
                console.error('Failed to fetch integrity overview:', error);
                setError('Failed to load integrity data');
            } finally {
                setLoading(false);
            }
        };

        fetchOverview();
    }, [cohortId]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="animate-pulse">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-gray-900 p-6 rounded-lg">
                                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                                <div className="h-8 bg-gray-700 rounded w-1/2"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error || !overview) {
        return (
            <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">{error || 'Failed to load integrity overview'}</p>
            </div>
        );
    }

    const getRecommendationStats = () => {
        if (!sessionAnalyses.length) return { pass: 0, review: 0, fail: 0 };
        
        return {
            pass: sessionAnalyses.filter(s => s.integrity_score >= 80).length,
            review: sessionAnalyses.filter(s => s.integrity_score >= 60 && s.integrity_score < 80).length,
            fail: sessionAnalyses.filter(s => s.integrity_score < 60).length
        };
    };

    const getRecommendation = (score: number) => {
        if (score >= 80) return 'pass';
        if (score >= 60) return 'review';
        return 'fail';
    };

    const getRecommendationColor = (recommendation: string) => {
        switch (recommendation) {
            case 'pass': return 'bg-green-900/20 text-green-400';
            case 'review': return 'bg-yellow-900/20 text-yellow-400';
            case 'fail': return 'bg-red-900/20 text-red-400';
            default: return 'bg-gray-900/20 text-gray-400';
        }
    };

    const stats = getRecommendationStats();

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gray-900 p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Total Sessions</p>
                            <p className="text-2xl font-bold text-white">{overview.total_sessions}</p>
                        </div>
                        <Users className="w-8 h-8 text-blue-400" />
                    </div>
                </div>

                <div className="bg-gray-900 p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Pass Rate</p>
                            <p className="text-2xl font-bold text-green-400">
                                {overview.total_sessions > 0 ? Math.round((stats.pass / overview.total_sessions) * 100) : 0}%
                            </p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                </div>

                <div className="bg-gray-900 p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Need Review</p>
                            <p className="text-2xl font-bold text-yellow-400">{stats.review}</p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-yellow-400" />
                    </div>
                </div>

                <div className="bg-gray-900 p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-sm">Avg Integrity Score</p>
                            <p className="text-2xl font-bold text-white">
                                {Math.round(overview.average_integrity_score || 0)}
                            </p>
                        </div>
                        <Shield className="w-8 h-8 text-purple-400" />
                    </div>
                </div>
            </div>

            {/* Sessions List */}
            <div className="bg-gray-900 rounded-lg">
                <div className="p-6 border-b border-gray-700">
                    <h3 className="text-lg font-semibold text-white">Assessment Sessions</h3>
                </div>

                <div className="divide-y divide-gray-700">
                    {sessionAnalyses.map((analysis) => {
                        const recommendation = getRecommendation(analysis.integrity_score || 0);
                        
                        return (
                            <div key={analysis.session.session_uuid} className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-4 mb-2">
                                            <h4 className="font-medium text-white">
                                                {analysis.user_name || analysis.user_email || `User ${analysis.session.user_id}`}
                                            </h4>
                                            <span className={`
                                                px-2 py-1 rounded text-xs font-medium
                                                ${analysis.session.status === 'completed' ? 'bg-green-900/20 text-green-400' : 
                                                  analysis.session.status === 'active' ? 'bg-blue-900/20 text-blue-400' :
                                                  'bg-gray-700 text-gray-300'}
                                            `}>
                                                {analysis.session.status}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center space-x-6 text-sm text-gray-400">
                                            <span>Started: {analysis.session.session_start ? new Date(analysis.session.session_start).toLocaleString() : 'Unknown'}</span>
                                            <span>Score: {analysis.integrity_score || 0}/100</span>
                                            <span>Events: {analysis.total_events || 0}</span>
                                            <span>Flags: {analysis.flags_count || 0}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        {/* Integrity Metrics */}
                                        <div className="flex items-center space-x-2 text-sm">
                                            <Eye className="w-4 h-4 text-gray-400" />
                                            <span className="text-gray-300">
                                                {analysis.flagged_events || 0} flagged
                                            </span>
                                        </div>

                                        {/* Recommendation Badge */}
                                        <span className={`
                                            px-3 py-1 rounded-full text-sm font-medium
                                            ${getRecommendationColor(recommendation)}
                                        `}>
                                            {recommendation.toUpperCase()}
                                        </span>

                                        <button
                                            onClick={() => setSelectedSession(
                                                selectedSession === analysis.session.session_uuid ? null : analysis.session.session_uuid
                                            )}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                                        >
                                            {selectedSession === analysis.session.session_uuid ? 'Hide Timeline' : 'View Timeline'}
                                        </button>
                                    </div>
                                </div>

                                {/* Event Type Breakdown */}
                                {analysis.event_types && Object.keys(analysis.event_types).length > 0 && (
                                    <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                                        <h5 className="text-sm font-medium text-gray-300 mb-2">Event Breakdown</h5>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                            {Object.entries(analysis.event_types).map(([type, count]) => (
                                                <div key={type} className="flex justify-between">
                                                    <span className="text-gray-400 capitalize">
                                                        {type.replace('_', ' ')}:
                                                    </span>
                                                    <span className="text-white">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Timeline Viewer */}
                                {selectedSession === analysis.session.session_uuid && (
                                    <div className="mt-6">
                                        <TimelineViewer 
                                            sessionUuid={analysis.session.session_uuid}
                                            userId={analysis.session.user_id}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {sessionAnalyses.length === 0 && (
                    <div className="p-12 text-center">
                        <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">No integrity sessions found for this cohort</p>
                        <p className="text-gray-500 text-sm mt-2">
                            Sessions will appear here once learners start integrity-monitored assessments
                        </p>
                    </div>
                )}
            </div>

            {/* Summary and Insights */}
            {overview.total_sessions > 0 && (
                <div className="bg-gray-900 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-blue-400" />
                        Cohort Insights
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-800 p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Integrity Status</h4>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-green-400">Passing:</span>
                                    <span className="text-white">{stats.pass} sessions</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-yellow-400">Review:</span>
                                    <span className="text-white">{stats.review} sessions</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-red-400">Failing:</span>
                                    <span className="text-white">{stats.fail} sessions</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-800 p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Alert Summary</h4>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Total Flags:</span>
                                    <span className="text-white">{overview.total_flags}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Sessions with Issues:</span>
                                    <span className="text-white">{overview.sessions_with_issues}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Issue Rate:</span>
                                    <span className="text-white">
                                        {Math.round((overview.sessions_with_issues / overview.total_sessions) * 100)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-800 p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Recommendations</h4>
                            <div className="space-y-1 text-xs text-gray-400">
                                {overview.sessions_with_issues > overview.total_sessions * 0.3 ? (
                                    <p>Consider reviewing assessment instructions and monitoring sensitivity</p>
                                ) : overview.average_integrity_score > 85 ? (
                                    <p>Excellent integrity performance across the cohort</p>
                                ) : (
                                    <p>Monitor flagged sessions for potential issues</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
