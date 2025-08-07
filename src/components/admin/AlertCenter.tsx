'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AlertTriangle,
    Shield,
    CheckCircle,
    XCircle,
    Clock,
    Eye,
    Filter,
    Download,
    RefreshCw,
    Bell,
    BellRing,
    Settings,
    Archive,
    AlertOctagon
} from 'lucide-react';
import { proctorAPI, type Alert } from '@/lib/proctor-api';

interface AlertCenterProps {
    refreshInterval?: number;
}

export default function AlertCenter({ refreshInterval = 30000 }: AlertCenterProps) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged' | 'archived'>('all');
    const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const loadAlerts = async () => {
        try {
            setLoading(true);
            setError(null);

            const alertsData = await proctorAPI.getAlerts({
                status: filter === 'all' ? undefined : filter,
                severity: severityFilter === 'all' ? undefined : severityFilter
            });

            // Check for new critical alerts for sound notification
            if (soundEnabled && alerts.length > 0) {
                const newCriticalAlerts = alertsData.filter(alert =>
                    alert.severity === 'critical' &&
                    alert.status === 'active' &&
                    !alerts.some(existing => existing.alert_id === alert.alert_id)
                );

                if (newCriticalAlerts.length > 0) {
                    playAlertSound();
                }
            }

            setAlerts(alertsData);
            setLastRefresh(new Date());
        } catch (err) {
            setError(`Failed to load alerts: ${err}`);
            console.error('Alert loading error:', err);
        } finally {
            setLoading(false);
        }
    };

    const playAlertSound = () => {
        // Create a simple beep sound for critical alerts
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800; // Frequency in Hz
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    };

    const acknowledgeAlert = async (alertId: string) => {
        try {
            await proctorAPI.acknowledgeAlert(alertId);
            setAlerts(prev => prev.map(alert =>
                alert.alert_id === alertId
                    ? { ...alert, status: 'acknowledged', acknowledged_at: new Date().toISOString() }
                    : alert
            ));
        } catch (error) {
            console.error('Failed to acknowledge alert:', error);
        }
    };

    const archiveAlert = async (alertId: string) => {
        try {
            await proctorAPI.archiveAlert(alertId);
            setAlerts(prev => prev.map(alert =>
                alert.alert_id === alertId
                    ? { ...alert, status: 'archived' }
                    : alert
            ));
        } catch (error) {
            console.error('Failed to archive alert:', error);
        }
    };

    const exportAlerts = async () => {
        try {
            const blob = await proctorAPI.exportAlerts({
                status: filter === 'all' ? undefined : filter,
                severity: severityFilter === 'all' ? undefined : severityFilter
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `alerts-export-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export alerts:', error);
        }
    };

    useEffect(() => {
        loadAlerts();

        // Set up auto-refresh
        const interval = setInterval(loadAlerts, refreshInterval);
        return () => clearInterval(interval);
    }, [filter, severityFilter, refreshInterval]);

    const filteredAlerts = alerts;

    const getAlertIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <AlertOctagon className="h-5 w-5 text-red-600" />;
            case 'high': return <AlertTriangle className="h-5 w-5 text-orange-600" />;
            case 'medium': return <Shield className="h-5 w-5 text-yellow-600" />;
            case 'low': return <Eye className="h-5 w-5 text-blue-600" />;
            default: return <Shield className="h-5 w-5 text-gray-600" />;
        }
    };

    const getSeverityColor = (severity: string): string => {
        switch (severity) {
            case 'critical': return 'bg-red-100 text-red-800 border-red-300';
            case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'active': return 'bg-red-100 text-red-800';
            case 'acknowledged': return 'bg-yellow-100 text-yellow-800';
            case 'archived': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active': return <AlertTriangle className="h-4 w-4" />;
            case 'acknowledged': return <CheckCircle className="h-4 w-4" />;
            case 'archived': return <Archive className="h-4 w-4" />;
            default: return <Clock className="h-4 w-4" />;
        }
    };

    const alertCounts = {
        total: alerts.length,
        active: alerts.filter(a => a.status === 'active').length,
        critical: alerts.filter(a => a.severity === 'critical' && a.status === 'active').length,
        high: alerts.filter(a => a.severity === 'high' && a.status === 'active').length
    };

    return (
        <div className="space-y-6">
            {/* Alert Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <AlertTriangle className="h-5 w-5 text-gray-600" />
                            <span className="text-2xl font-bold">{alertCounts.total}</span>
                        </div>
                        <div className="text-sm text-gray-500">Total Alerts</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <BellRing className="h-5 w-5 text-red-600" />
                            <span className="text-2xl font-bold text-red-600">{alertCounts.active}</span>
                        </div>
                        <div className="text-sm text-gray-500">Active Alerts</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <AlertOctagon className="h-5 w-5 text-red-600" />
                            <span className="text-2xl font-bold text-red-600">{alertCounts.critical}</span>
                        </div>
                        <div className="text-sm text-gray-500">Critical</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                            <span className="text-2xl font-bold text-orange-600">{alertCounts.high}</span>
                        </div>
                        <div className="text-sm text-gray-500">High Priority</div>
                    </CardContent>
                </Card>
            </div>

            {/* Controls */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            Alert Center
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                                Last updated: {lastRefresh.toLocaleTimeString()}
                            </span>
                            <Button variant="outline" size="sm" onClick={loadAlerts} disabled={loading}>
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                        {/* Status Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-gray-600" />
                            <span className="text-sm text-gray-600">Status:</span>
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as any)}
                                className="text-sm border rounded px-2 py-1"
                            >
                                <option value="all">All</option>
                                <option value="active">Active</option>
                                <option value="acknowledged">Acknowledged</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>

                        {/* Severity Filter */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Severity:</span>
                            <select
                                value={severityFilter}
                                onChange={(e) => setSeverityFilter(e.target.value as any)}
                                className="text-sm border rounded px-2 py-1"
                            >
                                <option value="all">All</option>
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>

                        {/* Sound Toggle */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSoundEnabled(!soundEnabled)}
                                className={soundEnabled ? 'bg-green-50' : ''}
                            >
                                {soundEnabled ? <Bell className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
                                <span className="ml-2">{soundEnabled ? 'Sound On' : 'Sound Off'}</span>
                            </Button>
                        </div>

                        {/* Export */}
                        <Button variant="outline" size="sm" onClick={exportAlerts}>
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Alert List */}
            <div className="space-y-4">
                {loading && filteredAlerts.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <RefreshCw className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
                            <p className="text-gray-600">Loading alerts...</p>
                        </CardContent>
                    </Card>
                ) : filteredAlerts.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <p className="text-gray-600">No alerts match the current filters.</p>
                            <p className="text-gray-500 text-sm mt-2">All systems operating normally.</p>
                        </CardContent>
                    </Card>
                ) : (
                    filteredAlerts.map((alert) => (
                        <Card key={alert.alert_id} className={alert.severity === 'critical' ? 'border-red-300 bg-red-50' : ''}>
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-start gap-4">
                                        <div className="flex-shrink-0 mt-1">
                                            {getAlertIcon(alert.severity)}
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="font-semibold text-lg">{alert.title}</h3>
                                                <Badge className={getSeverityColor(alert.severity)}>
                                                    {alert.severity.toUpperCase()}
                                                </Badge>
                                                <Badge variant="outline" className={getStatusColor(alert.status)}>
                                                    {getStatusIcon(alert.status)}
                                                    <span className="ml-1 capitalize">{alert.status}</span>
                                                </Badge>
                                            </div>

                                            <p className="text-gray-700 mb-3">{alert.description}</p>

                                            <div className="text-sm text-gray-600 space-y-1">
                                                <div>Session: {alert.session_uuid}</div>
                                                <div>User: {alert.user_id}</div>
                                                <div>Created: {new Date(alert.created_at).toLocaleString()}</div>
                                                {alert.acknowledged_at && (
                                                    <div>Acknowledged: {new Date(alert.acknowledged_at).toLocaleString()}</div>
                                                )}
                                            </div>

                                            {alert.metadata && (
                                                <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
                                                    <details>
                                                        <summary className="cursor-pointer font-medium">Additional Details</summary>
                                                        <pre className="mt-2 text-xs overflow-auto">
                                                            {JSON.stringify(alert.metadata, null, 2)}
                                                        </pre>
                                                    </details>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 ml-4">
                                        {alert.status === 'active' && (
                                            <Button
                                                size="sm"
                                                onClick={() => acknowledgeAlert(alert.alert_id)}
                                                className="whitespace-nowrap"
                                            >
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Acknowledge
                                            </Button>
                                        )}

                                        {alert.status === 'acknowledged' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => archiveAlert(alert.alert_id)}
                                                className="whitespace-nowrap"
                                            >
                                                <Archive className="h-4 w-4 mr-2" />
                                                Archive
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {error && (
                <Card className="border-red-300 bg-red-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-red-600" />
                            <span className="text-red-800">{error}</span>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
