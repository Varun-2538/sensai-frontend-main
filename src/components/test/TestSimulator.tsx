'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Monitor,
    Cpu,
    HardDrive,
    Wifi,
    Battery,
    AlertTriangle,
    CheckCircle,
    Activity,
    Zap,
    Globe
} from 'lucide-react';
import { proctorAPI, BehavioralMonitor, type EnhancedEventType } from '@/lib/proctor-api';

interface TestSimulatorProps {
    sessionUuid: string;
    userId: number;
    testType: 'coding' | 'writing' | 'mixed';
}

interface SystemMetrics {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    network_speed: number;
    battery_level?: number;
    active_processes: number;
    screen_resolution: string;
    browser_version: string;
    os_version: string;
}

export default function TestSimulator({ sessionUuid, userId, testType }: TestSimulatorProps) {
    const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
    const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'poor' | 'offline'>('good');
    const [runningProcesses, setRunningProcesses] = useState<string[]>([]);
    const [suspiciousActivities, setSuspiciousActivities] = useState<string[]>([]);
    const [isMonitoring, setIsMonitoring] = useState(true);
    const [alerts, setAlerts] = useState<Array<{ id: number; message: string; severity: 'low' | 'medium' | 'high'; timestamp: Date }>>([]);

    const behavioralMonitor = React.useRef(new BehavioralMonitor());

    // Simulate system monitoring
    useEffect(() => {
        if (!isMonitoring) return;

        const updateSystemMetrics = () => {
            // Simulate realistic system metrics
            const metrics: SystemMetrics = {
                cpu_usage: Math.random() * 100,
                memory_usage: 60 + Math.random() * 30,
                disk_usage: 45 + Math.random() * 10,
                network_speed: 50 + Math.random() * 50,
                battery_level: navigator.getBattery ? undefined : 80 + Math.random() * 20,
                active_processes: 45 + Math.floor(Math.random() * 20),
                screen_resolution: `${window.screen.width}x${window.screen.height}`,
                browser_version: navigator.userAgent.split(' ').slice(-1)[0],
                os_version: navigator.platform
            };

            setSystemMetrics(metrics);

            // Simulate suspicious process detection
            const suspiciousApps = [
                'TeamViewer',
                'AnyDesk',
                'Chrome Developer Tools',
                'Postman',
                'VS Code',
                'Slack',
                'WhatsApp',
                'VirtualBox',
                'VMware'
            ];

            // Randomly add/remove suspicious processes
            if (Math.random() > 0.8) {
                const newProcess = suspiciousApps[Math.floor(Math.random() * suspiciousApps.length)];
                if (!runningProcesses.includes(newProcess)) {
                    setRunningProcesses(prev => [...prev, newProcess]);

                    // Record external application detection
                    proctorAPI.createEnhancedEvent({
                        session_uuid: sessionUuid,
                        user_id: userId,
                        event_type: 'external_app_detected',
                        data: {
                            process_name: newProcess,
                            detection_time: new Date().toISOString(),
                            system_metrics: metrics
                        },
                        severity: 'high',
                        flagged: true,
                        context: { test_id: sessionUuid }
                    });

                    addAlert(`Suspicious application detected: ${newProcess}`, 'high');
                }
            }

            // Network quality simulation
            if (metrics.network_speed < 10) {
                setNetworkQuality('poor');
                if (Math.random() > 0.9) {
                    addAlert('Poor network connectivity detected', 'medium');
                }
            } else if (metrics.network_speed < 30) {
                setNetworkQuality('good');
            } else {
                setNetworkQuality('excellent');
            }

            // High CPU usage detection
            if (metrics.cpu_usage > 80) {
                proctorAPI.createEnhancedEvent({
                    session_uuid: sessionUuid,
                    user_id: userId,
                    event_type: 'suspicious_activity',
                    data: {
                        activity_type: 'high_cpu_usage',
                        cpu_usage: metrics.cpu_usage,
                        active_processes: metrics.active_processes
                    },
                    severity: 'medium',
                    flagged: true,
                    context: { test_id: sessionUuid }
                });
            }
        };

        // Update metrics every 5 seconds
        const interval = setInterval(updateSystemMetrics, 5000);
        updateSystemMetrics(); // Initial update

        return () => clearInterval(interval);
    }, [isMonitoring, sessionUuid, userId, runningProcesses]);

    // Simulate browser monitoring
    useEffect(() => {
        if (!isMonitoring) return;

        const detectDevTools = () => {
            // Simple dev tools detection
            const threshold = 160;
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;

            if (widthThreshold || heightThreshold) {
                proctorAPI.createEnhancedEvent({
                    session_uuid: sessionUuid,
                    user_id: userId,
                    event_type: 'devtools_opened',
                    data: {
                        window_dimensions: {
                            outer: { width: window.outerWidth, height: window.outerHeight },
                            inner: { width: window.innerWidth, height: window.innerHeight }
                        },
                        detection_method: 'dimension_analysis'
                    },
                    severity: 'high',
                    flagged: true,
                    context: { test_id: sessionUuid }
                });

                addAlert('Developer tools may be open', 'high');
            }
        };

        const handleRightClick = (e: MouseEvent) => {
            e.preventDefault();

            proctorAPI.createEnhancedEvent({
                session_uuid: sessionUuid,
                user_id: userId,
                event_type: 'suspicious_activity',
                data: {
                    activity_type: 'right_click_attempt',
                    coordinates: { x: e.clientX, y: e.clientY }
                },
                severity: 'medium',
                flagged: true,
                context: { test_id: sessionUuid }
            });
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            // Detect suspicious key combinations
            const suspiciousKeys = [
                'F12', // Dev tools
                'F11', // Fullscreen
                'PrintScreen',
                'Alt+Tab',
                'Ctrl+Shift+I', // Dev tools
                'Ctrl+Shift+J', // Console
                'Ctrl+U', // View source
            ];

            const keyCombo = `${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.altKey ? 'Alt+' : ''}${e.key}`;

            if (suspiciousKeys.some(combo => keyCombo.includes(combo)) || e.key === 'F12') {
                e.preventDefault();

                proctorAPI.createEnhancedEvent({
                    session_uuid: sessionUuid,
                    user_id: userId,
                    event_type: 'suspicious_activity',
                    data: {
                        activity_type: 'suspicious_key_combination',
                        key_combination: keyCombo,
                        prevented: true
                    },
                    severity: 'high',
                    flagged: true,
                    context: { test_id: sessionUuid }
                });

                addAlert(`Blocked suspicious key combination: ${keyCombo}`, 'high');
            }
        };

        // Check for dev tools every 2 seconds
        const devToolsInterval = setInterval(detectDevTools, 2000);

        document.addEventListener('contextmenu', handleRightClick);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            clearInterval(devToolsInterval);
            document.removeEventListener('contextmenu', handleRightClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isMonitoring, sessionUuid, userId]);

    // Simulate screen capture detection
    useEffect(() => {
        if (!isMonitoring) return;

        const detectScreenCapture = async () => {
            try {
                // Check if screen capture is active (this is a simulation)
                if (Math.random() > 0.95) { // 5% chance of detection
                    proctorAPI.createEnhancedEvent({
                        session_uuid: sessionUuid,
                        user_id: userId,
                        event_type: 'screen_capture_attempt',
                        data: {
                            detection_method: 'system_api',
                            timestamp: new Date().toISOString()
                        },
                        severity: 'high',
                        flagged: true,
                        context: { test_id: sessionUuid }
                    });

                    addAlert('Screen capture activity detected', 'high');
                }
            } catch (error) {
                console.log('Screen capture detection not available');
            }
        };

        const interval = setInterval(detectScreenCapture, 10000);
        return () => clearInterval(interval);
    }, [isMonitoring, sessionUuid, userId]);

    const addAlert = useCallback((message: string, severity: 'low' | 'medium' | 'high') => {
        const alert = {
            id: Date.now(),
            message,
            severity,
            timestamp: new Date()
        };

        setAlerts(prev => [alert, ...prev.slice(0, 4)]); // Keep only last 5 alerts

        // Auto-remove alert after 10 seconds
        setTimeout(() => {
            setAlerts(prev => prev.filter(a => a.id !== alert.id));
        }, 10000);
    }, []);

    const getMetricColor = (value: number, thresholds: { good: number; warning: number }) => {
        if (value <= thresholds.good) return 'text-green-600';
        if (value <= thresholds.warning) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getNetworkIcon = () => {
        switch (networkQuality) {
            case 'excellent': return <Wifi className="h-4 w-4 text-green-500" />;
            case 'good': return <Wifi className="h-4 w-4 text-yellow-500" />;
            case 'poor': return <Wifi className="h-4 w-4 text-red-500" />;
            case 'offline': return <Globe className="h-4 w-4 text-red-500" />;
        }
    };

    if (!systemMetrics) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="text-center">
                        <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                        <p className="text-gray-600">Initializing system monitoring...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Active Alerts */}
            {alerts.length > 0 && (
                <div className="space-y-2">
                    {alerts.map(alert => (
                        <Alert
                            key={alert.id}
                            variant={alert.severity === 'high' ? 'destructive' : 'default'}
                            className="animate-pulse-slow"
                        >
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="flex justify-between items-center">
                                <span>{alert.message}</span>
                                <span className="text-xs">{alert.timestamp.toLocaleTimeString()}</span>
                            </AlertDescription>
                        </Alert>
                    ))}
                </div>
            )}

            {/* System Metrics */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Monitor className="h-5 w-5" />
                        System Monitor
                        <Badge variant={isMonitoring ? 'default' : 'outline'} className="ml-auto">
                            {isMonitoring ? 'Active' : 'Inactive'}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* CPU Usage */}
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <Cpu className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                            <div className={`text-lg font-bold ${getMetricColor(systemMetrics.cpu_usage, { good: 50, warning: 80 })}`}>
                                {Math.round(systemMetrics.cpu_usage)}%
                            </div>
                            <div className="text-xs text-gray-500">CPU Usage</div>
                        </div>

                        {/* Memory Usage */}
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <Zap className="h-6 w-6 mx-auto mb-2 text-green-500" />
                            <div className={`text-lg font-bold ${getMetricColor(systemMetrics.memory_usage, { good: 60, warning: 85 })}`}>
                                {Math.round(systemMetrics.memory_usage)}%
                            </div>
                            <div className="text-xs text-gray-500">Memory</div>
                        </div>

                        {/* Network Speed */}
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="mx-auto mb-2">{getNetworkIcon()}</div>
                            <div className={`text-lg font-bold ${getMetricColor(100 - systemMetrics.network_speed, { good: 30, warning: 70 })}`}>
                                {Math.round(systemMetrics.network_speed)} Mbps
                            </div>
                            <div className="text-xs text-gray-500">Network</div>
                        </div>

                        {/* Active Processes */}
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <Activity className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                            <div className={`text-lg font-bold ${getMetricColor(systemMetrics.active_processes, { good: 50, warning: 80 })}`}>
                                {systemMetrics.active_processes}
                            </div>
                            <div className="text-xs text-gray-500">Processes</div>
                        </div>
                    </div>

                    {/* System Information */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">System Information</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <span className="text-gray-500">Resolution:</span>
                                <span className="ml-2 font-mono">{systemMetrics.screen_resolution}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">OS:</span>
                                <span className="ml-2">{systemMetrics.os_version}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Browser:</span>
                                <span className="ml-2">{systemMetrics.browser_version.slice(0, 20)}...</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Network:</span>
                                <span className="ml-2 capitalize">{networkQuality}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Running Processes */}
            {runningProcesses.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Suspicious Applications
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {runningProcesses.map((process, index) => (
                                <div key={index} className="flex justify-between items-center p-2 bg-red-50 border border-red-200 rounded">
                                    <span className="font-medium text-red-800">{process}</span>
                                    <Badge variant="destructive">Active</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Test Environment Status */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Test Environment Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Camera Access:</span>
                            <Badge variant="default">Granted</Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Microphone Access:</span>
                            <Badge variant="default">Granted</Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Screen Sharing:</span>
                            <Badge variant="outline">Blocked</Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Dev Tools:</span>
                            <Badge variant="outline">Blocked</Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Context Menu:</span>
                            <Badge variant="outline">Disabled</Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Print Screen:</span>
                            <Badge variant="outline">Disabled</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Monitoring Controls */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-medium">Environment Monitoring</p>
                            <p className="text-sm text-gray-500">Real-time system and behavior analysis</p>
                        </div>
                        <Button
                            onClick={() => setIsMonitoring(!isMonitoring)}
                            variant={isMonitoring ? 'destructive' : 'default'}
                        >
                            {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
