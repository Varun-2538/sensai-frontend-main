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
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [generatingSessionUuid, setGeneratingSessionUuid] = useState<string | null>(null);
    const [reportContent, setReportContent] = useState<string | null>(null);

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
                                
                                if (userResponse.ok) {
                                    const userData = await userResponse.json();
                                    return {
                                        ...analysis,
                                        user_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
                                        user_email: userData.email
                                    } as EnhancedSessionAnalysis;
                                } else {
                                    return {
                                        ...analysis,
                                        user_name: `User ${analysis.session.user_id}`,
                                        user_email: `user${analysis.session.user_id}@unknown.com`
                                    } as EnhancedSessionAnalysis;
                                }
                            } catch {
                                return {
                                    ...analysis,
                                    user_name: `User ${analysis.session.user_id}`,
                                    user_email: `user${analysis.session.user_id}@unknown.com`
                                } as EnhancedSessionAnalysis;
                            }
                        })
                    );

                    setSessionAnalyses(enhancedSessions);
                }
            } catch (error) {
                console.error('Failed to fetch integrity overview:', error);
                setError(`Failed to load integrity data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                setLoading(false);
            }
        };

        fetchOverview();
    }, [cohortId]);

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="animate-pulse">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-xl border border-gray-700">
                                <div className="h-4 bg-gray-700 rounded w-3/4 mb-3"></div>
                                <div className="h-8 bg-gray-600 rounded w-1/2 mb-2"></div>
                                <div className="h-3 bg-gray-700 rounded w-1/4"></div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
                        <div className="h-6 bg-gray-700 rounded w-1/3 mb-6"></div>
                        <div className="space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-16 bg-gray-800 rounded-lg"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !overview) {
        return (
            <div className="text-center py-16">
                <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 p-12 max-w-md mx-auto">
                    <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
                    <h3 className="text-xl font-light text-white mb-3">Failed to Load Data</h3>
                    <p className="text-gray-400 leading-relaxed">{error || 'Failed to load integrity overview'}</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
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

    const handleGenerateReportForSession = async (sessionUuid: string, userId: number) => {
        try {
            setError(null);
            setGeneratingSessionUuid(sessionUuid);
            const url = process.env.NEXT_PUBLIC_INTEGRITY_REPORT_URL;
            if (!url) {
                throw new Error('Report endpoint is not configured. Set NEXT_PUBLIC_INTEGRITY_REPORT_URL');
            }
            const events = await integrityAPI.getSessionEvents(sessionUuid);
            const payload = { session_uuid: sessionUuid, user_id: userId, events };
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(text || `HTTP ${resp.status}`);
            }
            const data = await resp.json();
            const report = typeof data === 'string' ? data : data.report || JSON.stringify(data);
            setReportContent(report);
        } catch (e) {
            console.error('Failed to generate report', e);
            setError(`Report generation failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        } finally {
            setGeneratingSessionUuid(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 p-6 rounded-xl border border-blue-800/30 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-300/80 text-sm font-medium">Total Sessions</p>
                            <p className="text-3xl font-light text-white mt-2">{overview.total_sessions}</p>
                            <p className="text-xs text-blue-400 mt-1">Active assessments</p>
                        </div>
                        <div className="bg-blue-600/20 p-3 rounded-xl">
                            <Users className="w-8 h-8 text-blue-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-900/20 to-green-800/10 p-6 rounded-xl border border-green-800/30 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-300/80 text-sm font-medium">Pass Rate</p>
                            <p className="text-3xl font-light text-white mt-2">
                                {overview.total_sessions > 0 ? Math.round((stats.pass / overview.total_sessions) * 100) : 0}%
                            </p>
                            <p className="text-xs text-green-400 mt-1">{stats.pass} successful sessions</p>
                        </div>
                        <div className="bg-green-600/20 p-3 rounded-xl">
                            <CheckCircle className="w-8 h-8 text-green-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 p-6 rounded-xl border border-yellow-800/30 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-yellow-300/80 text-sm font-medium">Need Review</p>
                            <p className="text-3xl font-light text-white mt-2">{stats.review}</p>
                            <p className="text-xs text-yellow-400 mt-1">Sessions flagged</p>
                        </div>
                        <div className="bg-yellow-600/20 p-3 rounded-xl">
                            <AlertTriangle className="w-8 h-8 text-yellow-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 p-6 rounded-xl border border-purple-800/30 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-300/80 text-sm font-medium">Avg Integrity Score</p>
                            <p className="text-3xl font-light text-white mt-2">
                                {Math.round(overview.average_integrity_score || 0)}
                            </p>
                            <p className="text-xs text-purple-400 mt-1">Out of 100</p>
                        </div>
                        <div className="bg-purple-600/20 p-3 rounded-xl">
                            <Shield className="w-8 h-8 text-purple-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Sessions List */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800">
                <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-light text-white">Assessment Sessions</h3>
                        <p className="text-gray-400 text-sm mt-1">Detailed integrity monitoring results</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Sort by</span>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                            className="bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 text-sm"
                        >
                            <option value="desc">Newest First</option>
                            <option value="asc">Oldest First</option>
                        </select>
                    </div>
                </div>

                <div className="divide-y divide-gray-700">
                    {([...sessionAnalyses]
                        .sort((a, b) => {
                            const ta = a.session.session_start ? new Date(a.session.session_start).getTime() : 0;
                            const tb = b.session.session_start ? new Date(b.session.session_start).getTime() : 0;
                            return sortOrder === 'desc' ? tb - ta : ta - tb;
                        })
                    ).map((analysis) => {
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
                                        <button
                                            onClick={() => handleGenerateReportForSession(analysis.session.session_uuid, analysis.session.user_id)}
                                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                                            disabled={generatingSessionUuid === analysis.session.session_uuid}
                                        >
                                            {generatingSessionUuid === analysis.session.session_uuid ? 'Generating…' : 'Generate Report'}
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
                    <div className="p-16 text-center">
                        <div className="bg-gray-800/50 rounded-xl p-8 max-w-sm mx-auto">
                            <Clock className="w-16 h-16 text-gray-600 mx-auto mb-6" />
                            <h4 className="text-lg font-light text-white mb-3">No Sessions Yet</h4>
                            <p className="text-gray-400 leading-relaxed">
                                No integrity sessions found for this cohort. Sessions will appear here once learners start integrity-monitored assessments.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Report Modal */}
            {reportContent && (
                <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center">
                    <div className="bg-gray-900 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Generated Report</h3>
                            <button
                                onClick={() => setReportContent(null)}
                                className="text-gray-400 hover:text-white text-xl"
                            >
                                ×
                            </button>
                        </div>
                        <pre className="bg-gray-800 p-4 rounded text-sm text-gray-200 whitespace-pre-wrap break-words">{reportContent}</pre>
                        <button
                            onClick={() => setReportContent(null)}
                            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg w-full"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

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

