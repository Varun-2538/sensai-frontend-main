'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Shield,
    Users,
    Search,
    AlertTriangle,
    Eye,
    Clock,
    TrendingUp,
    Monitor,
    FileText,
    Download,
    RefreshCw,
    BarChart,
    Activity
} from 'lucide-react';
import StudentLookup from '@/components/admin/StudentLookup';
import { LiveMonitor, SessionAnalysis, AlertCenter, ReportCenter } from '@/components/admin';
import { proctorAPI, type StudentSession, type LiveSessionData } from '@/lib/proctor-api';

type TabType = 'overview' | 'lookup' | 'live' | 'analysis' | 'alerts' | 'reports';

export default function ProctorDashboardPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading, user } = useAuth();

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [selectedSessionUuid, setSelectedSessionUuid] = useState<string | null>(null);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [overviewStats, setOverviewStats] = useState<any>(null);
    const [liveSessions, setLiveSessions] = useState<LiveSessionData[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

    // Load dashboard data
    useEffect(() => {
        if (!isAuthenticated) return;

        const loadDashboardData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Load overview statistics
                const [liveSessionsData, alertsData] = await Promise.all([
                    proctorAPI.getLiveSessions(),
                    proctorAPI.getAlerts()
                ]);

                setLiveSessions(liveSessionsData);
                setAlerts(alertsData);

                // Calculate overview stats
                const stats = {
                    total_active_sessions: liveSessionsData.length,
                    high_risk_sessions: liveSessionsData.filter(s => s.current_integrity_score < 60).length,
                    pending_alerts: alertsData.filter(a => a.status !== 'acknowledged').length,
                    average_integrity_score: liveSessionsData.length > 0
                        ? Math.round(liveSessionsData.reduce((sum, s) => sum + s.current_integrity_score, 0) / liveSessionsData.length)
                        : 100
                };
                setOverviewStats(stats);

            } catch (err) {
                setError(`Failed to load dashboard data: ${err}`);
                console.error('Dashboard load error:', err);
            } finally {
                setLoading(false);
            }
        };

        loadDashboardData();

        // Set up auto-refresh for live data
        const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
        setRefreshInterval(interval);

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isAuthenticated]);

    const handleStudentSelect = (studentId: number) => {
        setSelectedStudentId(studentId);
        setActiveTab('analysis');
    };

    const handleSessionSelect = (sessionUuid: string) => {
        setSelectedSessionUuid(sessionUuid);
        setSelectedSession(sessionUuid);
        setActiveTab('analysis');
    };

    const handleBackFromAnalysis = () => {
        setSelectedStudentId(null);
        setSelectedSessionUuid(null);
        setActiveTab('overview');
    };

    const handleAlertAcknowledge = async (alertId: string) => {
        try {
            await proctorAPI.acknowledgeAlert(alertId);
            setAlerts(prev => prev.map(alert =>
                alert.alert_id === alertId ? { ...alert, status: 'acknowledged' } : alert
            ));
        } catch (error) {
            console.error('Failed to acknowledge alert:', error);
        }
    };

    const generateReport = async (type: 'session' | 'overview', format: 'pdf' | 'excel' = 'pdf') => {
        try {
            let blob: Blob;

            if (type === 'session' && selectedSession) {
                blob = await proctorAPI.generateSessionReport(selectedSession, format);
            } else {
                // Generate overview report (would need cohort ID in real implementation)
                blob = await proctorAPI.generateCohortReport(1, format);
            }

            // Download the report
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `proctor-report-${Date.now()}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to generate report:', error);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-12 h-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        router.push('/login');
        return null;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="text-center py-12">
                        <Shield className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
                        <p className="text-gray-600">Loading proctor dashboard...</p>
                    </div>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart },
        { id: 'live', label: 'Live Monitor', icon: Activity },
        { id: 'lookup', label: 'Student Lookup', icon: Search },
        { id: 'analysis', label: 'Analysis', icon: TrendingUp },
        { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
        { id: 'reports', label: 'Reports', icon: FileText }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <Shield className="h-6 w-6 text-blue-600" />
                                Proctor Dashboard
                            </h1>
                            <p className="text-gray-600 mt-1">Real-time monitoring and analysis</p>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Refresh Button */}
                            <Button
                                variant="outline"
                                onClick={() => window.location.reload()}
                                className="flex items-center gap-2"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Refresh
                            </Button>

                            {/* Quick Stats */}
                            <div className="flex items-center gap-4 text-sm">
                                <div className="text-center">
                                    <div className="font-bold text-blue-600">{overviewStats?.total_active_sessions || 0}</div>
                                    <div className="text-gray-500">Active</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-red-600">{overviewStats?.high_risk_sessions || 0}</div>
                                    <div className="text-gray-500">High Risk</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-yellow-600">{overviewStats?.pending_alerts || 0}</div>
                                    <div className="text-gray-500">Alerts</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex space-x-1">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabType)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {tab.label}
                                    {tab.id === 'alerts' && alerts.filter(a => a.status !== 'acknowledged').length > 0 && (
                                        <Badge variant="destructive" className="ml-1">
                                            {alerts.filter(a => a.status !== 'acknowledged').length}
                                        </Badge>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Error Display */}
                {error && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Overview Statistics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600">Active Sessions</p>
                                            <p className="text-2xl font-bold text-blue-600">{overviewStats?.total_active_sessions || 0}</p>
                                        </div>
                                        <Users className="h-8 w-8 text-blue-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600">High Risk Sessions</p>
                                            <p className="text-2xl font-bold text-red-600">{overviewStats?.high_risk_sessions || 0}</p>
                                        </div>
                                        <AlertTriangle className="h-8 w-8 text-red-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600">Pending Alerts</p>
                                            <p className="text-2xl font-bold text-yellow-600">{overviewStats?.pending_alerts || 0}</p>
                                        </div>
                                        <Clock className="h-8 w-8 text-yellow-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600">Avg Integrity Score</p>
                                            <p className="text-2xl font-bold text-green-600">{overviewStats?.average_integrity_score || 100}</p>
                                        </div>
                                        <Shield className="h-8 w-8 text-green-500" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Recent Activity */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Live Sessions Preview */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Eye className="h-5 w-5" />
                                        Live Sessions
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {liveSessions.slice(0, 5).map(session => (
                                        <div key={session.session.session_uuid} className="flex justify-between items-center py-2 border-b last:border-b-0">
                                            <div>
                                                <div className="font-medium">Session {session.session.session_uuid.slice(0, 8)}</div>
                                                <div className="text-sm text-gray-500">User {session.session.user_id}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-bold ${session.current_integrity_score >= 80 ? 'text-green-600' :
                                                    session.current_integrity_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                                                    }`}>
                                                    {session.current_integrity_score}%
                                                </div>
                                                <div className="text-sm text-gray-500">{session.active_flags} flags</div>
                                            </div>
                                        </div>
                                    ))}

                                    {liveSessions.length === 0 && (
                                        <div className="text-center py-8 text-gray-500">
                                            No active sessions
                                        </div>
                                    )}

                                    <Button
                                        variant="outline"
                                        className="w-full mt-4"
                                        onClick={() => setActiveTab('live')}
                                    >
                                        View All Live Sessions
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Recent Alerts */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5" />
                                        Recent Alerts
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {alerts.slice(0, 5).map(alert => (
                                        <div key={alert.alert_id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                                            <div className="flex-1">
                                                <div className="font-medium">{alert.title}</div>
                                                <div className="text-sm text-gray-500">
                                                    {new Date(alert.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                            <Badge variant={alert.status === 'acknowledged' ? 'outline' : 'destructive'}>
                                                {alert.status === 'acknowledged' ? 'Resolved' : 'Active'}
                                            </Badge>
                                        </div>
                                    ))}

                                    {alerts.length === 0 && (
                                        <div className="text-center py-8 text-gray-500">
                                            No recent alerts
                                        </div>
                                    )}

                                    <Button
                                        variant="outline"
                                        className="w-full mt-4"
                                        onClick={() => setActiveTab('alerts')}
                                    >
                                        View All Alerts
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {activeTab === 'lookup' && (
                    <StudentLookup onStudentSelect={handleStudentSelect} />
                )}

                {activeTab === 'live' && (
                    <LiveMonitor sessions={liveSessions} onSessionSelect={handleSessionSelect} />
                )}

                {activeTab === 'analysis' && (
                    <SessionAnalysis
                        studentId={selectedStudentId}
                        sessionUuid={selectedSessionUuid}
                        onBack={handleBackFromAnalysis}
                    />
                )}

                {activeTab === 'alerts' && (
                    <AlertCenter />
                )}

                {activeTab === 'reports' && (
                    <ReportCenter />
                )}
            </div>
        </div>
    );
}
