/**
 * Enhanced API client for comprehensive proctoring monitoring system
 * Extends the existing integrity-api.ts with advanced monitoring capabilities
 */

import { integrityAPI, type ProctorEvent, type IntegritySession, type SessionAnalysis, EventBatcher } from './integrity-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

// Enhanced event types for comprehensive monitoring
export type EnhancedEventType = ProctorEvent['type'] |
    'keystroke_pattern_anomaly' |
    'excessive_typing_pause' |
    'external_app_detected' |
    'devtools_opened' |
    'screen_capture_attempt' |
    'code_editor_interaction' |
    'text_editor_interaction' |
    'browser_navigation' |
    'clipboard_suspicious' |
    'behavior_pattern_change' |
    'focus_time_low' |
    'interaction_unusual';

export interface EnhancedProctorEvent extends Omit<ProctorEvent, 'type'> {
    type: EnhancedEventType;
    context?: {
        test_id?: string;
        question_id?: string;
        editor_type?: 'code' | 'text';
        navigation_target?: string;
    };
    behavioral_data?: {
        typing_speed?: number;
        pause_duration?: number;
        interaction_pattern?: string;
        focus_percentage?: number;
    };
}

export interface TestSession extends IntegritySession {
    test_id?: string;
    test_name?: string;
    test_type?: 'coding' | 'writing' | 'mixed';
    current_question?: number;
    total_questions?: number;
    test_config?: {
        time_limit?: number;
        allow_code_editor?: boolean;
        allow_text_editor?: boolean;
        monitoring_sensitivity?: 'low' | 'medium' | 'high';
    };
}

export interface StudentSession {
    student_id: number;
    student_name: string;
    student_email: string;
    active_sessions: TestSession[];
    session_history: TestSession[];
    integrity_summary: {
        average_score: number;
        total_sessions: number;
        flagged_sessions: number;
        last_session_date?: string;
    };
}

export interface LiveSessionData {
    session: TestSession;
    live_events: EnhancedProctorEvent[];
    current_integrity_score: number;
    active_flags: number;
    last_event_time: string;
    behavioral_metrics: {
        typing_speed_avg: number;
        focus_time_percentage: number;
        suspicious_activity_count: number;
        pattern_anomalies: number;
    };
}

export interface SessionDetailAnalysis extends SessionAnalysis {
    event_timeline: EnhancedProctorEvent[];
    behavioral_patterns: {
        typing_patterns: {
            average_speed: number;
            speed_variance: number;
            pause_patterns: number[];
        };
        focus_patterns: {
            total_focus_time: number;
            focus_breaks: number;
            longest_unfocused_period: number;
        };
        interaction_patterns: {
            code_editor_time: number;
            text_editor_time: number;
            navigation_events: number;
        };
    };
    flag_details: Array<{
        flag_id: number;
        flag_type: string;
        confidence: number;
        evidence: any;
        auto_generated: boolean;
        reviewer_notes?: string;
    }>;
    recommendations: {
        action: 'pass' | 'review' | 'investigate' | 'fail';
        confidence: number;
        reasons: string[];
        next_steps: string[];
    };
}

// Alert Management
export interface Alert {
    alert_id: string;
    session_uuid: string;
    user_id: number;
    alert_type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    status: 'active' | 'acknowledged' | 'archived';
    created_at: string;
    acknowledged_at?: string;
    metadata?: any;
}

class ProctorAPI {
    private baseUrl: string;

    constructor() {
        this.baseUrl = `${API_BASE_URL}/proctor`;
    }

    // Enhanced session management
    async createTestSession(data: {
        user_id: number;
        test_id: string;
        test_name: string;
        test_type: 'coding' | 'writing' | 'mixed';
        cohort_id?: number;
        test_config?: TestSession['test_config'];
    }): Promise<TestSession> {
        return integrityAPI['makeRequest']('/test-sessions', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getTestSession(sessionUuid: string): Promise<TestSession> {
        return integrityAPI['makeRequest'](`/test-sessions/${sessionUuid}`);
    }

    async updateTestProgress(sessionUuid: string, data: {
        current_question?: number;
        question_completion_time?: number;
        question_events_summary?: any;
    }): Promise<void> {
        return integrityAPI['makeRequest'](`/test-sessions/${sessionUuid}/progress`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    // Enhanced event streaming
    async createEnhancedEvent(data: {
        session_uuid: string;
        user_id: number;
        event_type: EnhancedEventType;
        data?: any;
        severity?: ProctorEvent['severity'];
        flagged?: boolean;
        context?: EnhancedProctorEvent['context'];
        behavioral_data?: EnhancedProctorEvent['behavioral_data'];
    }): Promise<{ event_id: number; message: string }> {
        return integrityAPI['makeRequest']('/events/enhanced', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async streamEvents(sessionUuid: string): Promise<EventSource> {
        const url = `${this.baseUrl}/sessions/${sessionUuid}/events/stream`;
        return new EventSource(url);
    }

    // Admin monitoring endpoints
    async getStudentLookup(studentId: number): Promise<StudentSession> {
        return integrityAPI['makeRequest'](`/admin/students/${studentId}`);
    }

    async searchStudents(query: string): Promise<StudentSession[]> {
        return integrityAPI['makeRequest'](`/admin/students/search?q=${encodeURIComponent(query)}`);
    }

    async getLiveSessions(cohortId?: number): Promise<LiveSessionData[]> {
        const params = cohortId ? `?cohort_id=${cohortId}` : '';
        return integrityAPI['makeRequest'](`/admin/sessions/live${params}`);
    }

    async getSessionDetail(sessionUuid: string): Promise<SessionDetailAnalysis> {
        return integrityAPI['makeRequest'](`/admin/sessions/${sessionUuid}/complete-analysis`);
    }

    // Flag management
    async createManualFlag(data: {
        session_uuid: string;
        user_id: number;
        flag_type: string;
        description: string;
        evidence?: any;
        reviewer_id: number;
    }): Promise<{ flag_id: number }> {
        return integrityAPI['makeRequest']('/admin/flags/manual', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateFlagStatus(flagId: number, data: {
        status: 'valid' | 'invalid' | 'needs_review' | 'resolved';
        reviewer_notes?: string;
        reviewer_id: number;
    }): Promise<void> {
        return integrityAPI['makeRequest'](`/admin/flags/${flagId}/status`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async getPendingFlags(cohortId?: number): Promise<any[]> {
        const params = cohortId ? `?cohort_id=${cohortId}` : '';
        return integrityAPI['makeRequest'](`/admin/flags/pending${params}`);
    }

    // Report generation
    async generateSessionReport(sessionUuid: string, format: 'pdf' | 'excel' = 'pdf'): Promise<Blob> {
        const response = await fetch(`${this.baseUrl}/admin/sessions/${sessionUuid}/report?format=${format}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to generate report');
        }

        return response.blob();
    }

    async generateCohortReport(cohortId: number, format: 'pdf' | 'excel' = 'pdf'): Promise<Blob> {
        const response = await fetch(`${this.baseUrl}/admin/cohorts/${cohortId}/report?format=${format}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to generate cohort report');
        }

        return response.blob();
    }

    // Real-time monitoring utilities
    async getSessionMetrics(sessionUuid: string): Promise<{
        duration: number;
        events_per_minute: number;
        current_integrity_score: number;
        behavioral_anomalies: number;
        active_flags: number;
    }> {
        return integrityAPI['makeRequest'](`/admin/sessions/${sessionUuid}/metrics`);
    }

    // Enhanced alert management methods
    async getAlerts(filters?: {
        status?: 'active' | 'acknowledged' | 'archived';
        severity?: 'low' | 'medium' | 'high' | 'critical';
        cohortId?: number;
    }): Promise<Alert[]> {
        const params = new URLSearchParams();
        if (filters?.status) params.append('status', filters.status);
        if (filters?.severity) params.append('severity', filters.severity);
        if (filters?.cohortId) params.append('cohort_id', filters.cohortId.toString());

        const query = params.toString() ? `?${params.toString()}` : '';
        return integrityAPI['makeRequest'](`/admin/alerts/enhanced${query}`);
    }

    async acknowledgeAlert(alertId: string): Promise<void> {
        return integrityAPI['makeRequest'](`/admin/alerts/${alertId}/acknowledge`, {
            method: 'POST',
        });
    }

    async archiveAlert(alertId: string): Promise<void> {
        return integrityAPI['makeRequest'](`/admin/alerts/${alertId}/archive`, {
            method: 'POST',
        });
    }

    async exportAlerts(filters?: {
        status?: string;
        severity?: string;
        format?: 'csv' | 'excel';
        dateRange?: string;
    }): Promise<Blob> {
        const params = new URLSearchParams();
        if (filters?.status) params.append('status', filters.status);
        if (filters?.severity) params.append('severity', filters.severity);
        if (filters?.format) params.append('format', filters.format);
        if (filters?.dateRange) params.append('date_range', filters.dateRange);

        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await fetch(`${this.baseUrl}/admin/alerts/export${query}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to export alerts');
        }

        return response.blob();
    }

    // Additional report generation methods
    async generateSystemReport(format: 'pdf' | 'excel' = 'pdf'): Promise<Blob> {
        const response = await fetch(`${this.baseUrl}/admin/reports/system?format=${format}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to generate system report');
        }

        return response.blob();
    }

    async generateCustomReport(config: {
        dateRange: string;
        includeDetails: boolean;
        includeCharts: boolean;
        format: 'pdf' | 'excel';
    }): Promise<Blob> {
        const response = await fetch(`${this.baseUrl}/admin/reports/custom`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(config),
        });

        if (!response.ok) {
            throw new Error('Failed to generate custom report');
        }

        return response.blob();
    }
}

// Export singleton instance
export const proctorAPI = new ProctorAPI();

// Enhanced behavioral monitoring utilities
export class BehavioralMonitor {
    private keystrokePattern: number[] = [];
    private pauseTimes: number[] = [];
    private lastKeystroke: number = 0;
    private focusEvents: Array<{ timestamp: number; focused: boolean }> = [];
    private interactionPattern: string[] = [];

    recordKeystroke() {
        const now = Date.now();
        if (this.lastKeystroke > 0) {
            const interval = now - this.lastKeystroke;
            this.keystrokePattern.push(interval);

            // Track pauses (longer than 2 seconds)
            if (interval > 2000) {
                this.pauseTimes.push(interval);
            }
        }
        this.lastKeystroke = now;
    }

    recordFocusChange(focused: boolean) {
        this.focusEvents.push({
            timestamp: Date.now(),
            focused
        });
    }

    recordInteraction(type: string) {
        this.interactionPattern.push(`${Date.now()}:${type}`);
    }

    getTypingSpeed(): number {
        if (this.keystrokePattern.length < 2) return 0;

        const validIntervals = this.keystrokePattern.filter(interval => interval < 1000);
        if (validIntervals.length === 0) return 0;

        const avgInterval = validIntervals.reduce((a, b) => a + b) / validIntervals.length;
        return Math.round(60000 / avgInterval); // Characters per minute
    }

    getTypingVariance(): number {
        if (this.keystrokePattern.length < 5) return 0;

        const mean = this.keystrokePattern.reduce((a, b) => a + b) / this.keystrokePattern.length;
        const variance = this.keystrokePattern.reduce((sum, interval) =>
            sum + Math.pow(interval - mean, 2), 0) / this.keystrokePattern.length;

        return Math.sqrt(variance);
    }

    getUnusualPauseCount(): number {
        return this.pauseTimes.filter(pause => pause > 10000).length; // Pauses longer than 10 seconds
    }

    getFocusPercentage(): number {
        if (this.focusEvents.length < 2) return 100;

        let focusedTime = 0;
        let totalTime = 0;

        for (let i = 1; i < this.focusEvents.length; i++) {
            const duration = this.focusEvents[i].timestamp - this.focusEvents[i - 1].timestamp;
            totalTime += duration;
            if (this.focusEvents[i - 1].focused) {
                focusedTime += duration;
            }
        }

        return totalTime > 0 ? Math.round((focusedTime / totalTime) * 100) : 100;
    }

    detectAnomalies(): Array<{
        type: 'typing_speed' | 'typing_variance' | 'excessive_pauses' | 'low_focus';
        severity: 'low' | 'medium' | 'high';
        value: number;
        threshold: number;
    }> {
        const anomalies = [];

        const typingSpeed = this.getTypingSpeed();
        if (typingSpeed > 150) {
            anomalies.push({
                type: 'typing_speed' as const,
                severity: 'high' as const,
                value: typingSpeed,
                threshold: 150
            });
        }

        const variance = this.getTypingVariance();
        if (variance > 500) {
            anomalies.push({
                type: 'typing_variance' as const,
                severity: 'medium' as const,
                value: variance,
                threshold: 500
            });
        }

        const unusualPauses = this.getUnusualPauseCount();
        if (unusualPauses > 5) {
            anomalies.push({
                type: 'excessive_pauses' as const,
                severity: 'medium' as const,
                value: unusualPauses,
                threshold: 5
            });
        }

        const focusPercentage = this.getFocusPercentage();
        if (focusPercentage < 60) {
            anomalies.push({
                type: 'low_focus' as const,
                severity: 'high' as const,
                value: focusPercentage,
                threshold: 60
            });
        }

        return anomalies;
    }

    reset() {
        this.keystrokePattern = [];
        this.pauseTimes = [];
        this.lastKeystroke = 0;
        this.focusEvents = [];
        this.interactionPattern = [];
    }

    getBehavioralSummary() {
        return {
            typing_speed: this.getTypingSpeed(),
            typing_variance: this.getTypingVariance(),
            unusual_pauses: this.getUnusualPauseCount(),
            focus_percentage: this.getFocusPercentage(),
            total_interactions: this.interactionPattern.length,
            anomalies: this.detectAnomalies()
        };
    }
}

// Enhanced event batching for real-time monitoring
export class EnhancedEventBatcher extends EventBatcher {
    private sessionUuid: string;
    private behavioralMonitor: BehavioralMonitor;

    constructor(sessionUuid: string, batchSize: number = 5, flushIntervalMs: number = 2000) {
        super(batchSize, flushIntervalMs);
        this.sessionUuid = sessionUuid;
        this.behavioralMonitor = new BehavioralMonitor();
    }

    addEnhancedEvent(event: {
        user_id: number;
        event_type: EnhancedEventType;
        data?: any;
        severity?: ProctorEvent['severity'];
        flagged?: boolean;
        context?: EnhancedProctorEvent['context'];
        behavioral_data?: EnhancedProctorEvent['behavioral_data'];
    }) {
        // Add behavioral context if available
        const behavioralSummary = this.behavioralMonitor.getBehavioralSummary();

        // Create a base event that's compatible with EventBatcher
        const baseEvent = {
            session_uuid: this.sessionUuid,
            user_id: event.user_id,
            event_type: event.event_type as ProctorEvent['type'], // Cast to base type
            data: {
                ...event.data,
                context: event.context,
                behavioral_data: {
                    ...event.behavioral_data,
                    typing_speed: behavioralSummary.typing_speed,
                    focus_percentage: behavioralSummary.focus_percentage,
                    anomaly_count: behavioralSummary.anomalies.length
                }
            },
            severity: event.severity,
            flagged: event.flagged
        };

        this.addEvent(baseEvent);
    }

    getBehavioralMonitor(): BehavioralMonitor {
        return this.behavioralMonitor;
    }
}
