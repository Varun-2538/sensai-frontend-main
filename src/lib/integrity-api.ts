/**
 * API client for integrity monitoring and proctoring
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export interface ProctorEvent {
  type: 'face_not_detected' | 'multiple_faces' | 'looking_away' | 'head_movement' | 'pose_change' | 'tab_switch' | 'window_blur' | 'copy_paste' | 'suspicious_activity' | 'mouse_drift';
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
  data: any;
  flagged?: boolean;
}

export interface IntegritySession {
  id: number;
  session_uuid: string;
  user_id: number;
  cohort_id?: number;
  task_id?: number;
  monitoring_config?: any;
  session_start: string;
  session_end?: string;
  status: 'active' | 'completed' | 'terminated' | 'suspended';
}

export interface IntegrityFlag {
  id: number;
  session_uuid: string;
  user_id: number;
  flag_type: 'identity_verification' | 'multiple_persons' | 'unauthorized_assistance' | 'technical_violation' | 'suspicious_behavior';
  confidence_score: number;
  evidence?: any;
  reviewer_decision?: 'valid' | 'invalid' | 'needs_review' | 'resolved';
  created_at: string;
  reviewed_at?: string;
}

export interface SessionAnalysis {
  session: IntegritySession;
  integrity_score: number;
  total_events: number;
  flagged_events: number;
  flags_count: number;
  event_types: Record<string, number>;
  severity_distribution: Record<string, number>;
  recent_events: ProctorEvent[];
  flags: IntegrityFlag[];
}

class IntegrityAPI {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/integrity`;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private normalizeTimestampToMs(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return Date.now();
    // Ensure ISO 8601 and assume UTC if no timezone
    let iso = value.includes('T') ? value : value.replace(' ', 'T');
    const hasTz = /[zZ]|[\+\-]\d{2}:?\d{2}$/.test(iso);
    if (!hasTz) iso += 'Z';
    const ms = Date.parse(iso);
    return isNaN(ms) ? Date.now() : ms;
  }

  private normalizeSessionTimestamps(session: any) {
    if (!session) return session;
    if (session.session_start) {
      session.session_start = new Date(this.normalizeTimestampToMs(session.session_start)).toISOString();
    }
    if (session.session_end) {
      session.session_end = new Date(this.normalizeTimestampToMs(session.session_end)).toISOString();
    }
    return session;
  }

  // Session Management
  async createSession(data: {
    user_id: number;
    cohort_id?: number;
    task_id?: number;
    monitoring_config?: any;
  }): Promise<IntegritySession> {
    const session = await this.makeRequest('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.normalizeSessionTimestamps(session);
  }

  async getSession(sessionUuid: string): Promise<IntegritySession> {
    const session = await this.makeRequest(`/sessions/${sessionUuid}`);
    return this.normalizeSessionTimestamps(session);
  }

  async updateSessionStatus(
    sessionUuid: string,
    status: 'active' | 'completed' | 'terminated' | 'suspended',
    sessionEnd?: string
  ): Promise<void> {
    await this.makeRequest(`/sessions/${sessionUuid}/status`, {
      method: 'PUT',
      body: JSON.stringify({
        status,
        session_end: sessionEnd,
      }),
    });
  }

  async getUserSessions(userId: number): Promise<IntegritySession[]> {
    return this.makeRequest(`/users/${userId}/sessions`);
  }

  // Event Management
  async createEvent(data: {
    session_uuid: string;
    user_id: number;
    event_type: ProctorEvent['type'];
    data?: any;
    severity?: ProctorEvent['severity'];
    flagged?: boolean;
  }): Promise<{ event_id: number; message: string }> {
    return this.makeRequest('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createBatchEvents(events: Array<{
    session_uuid: string;
    user_id: number;
    event_type: ProctorEvent['type'];
    data?: any;
    severity?: ProctorEvent['severity'];
    flagged?: boolean;
  }>): Promise<{ event_ids: number[]; count: number; message: string }> {
    return this.makeRequest('/events/batch', {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  }

  async getSessionEvents(
    sessionUuid: string,
    options: {
      event_type?: ProctorEvent['type'];
      flagged_only?: boolean;
      limit?: number;
    } = {}
  ): Promise<ProctorEvent[]> {
    const params = new URLSearchParams();
    if (options.event_type) params.append('event_type', options.event_type);
    if (options.flagged_only) params.append('flagged_only', 'true');
    if (options.limit) params.append('limit', options.limit.toString());

    const query = params.toString();
    const res = await this.makeRequest(`/sessions/${sessionUuid}/events${query ? `?${query}` : ''}`);
    // Map backend fields to frontend ProctorEvent shape if needed
    return (res || []).map((e: any) => ({
      type: e.event_type ?? e.type,
      timestamp: this.normalizeTimestampToMs(e.timestamp),
      severity: e.severity ?? 'medium',
      data: e.data ?? {},
      flagged: Boolean(e.flagged)
    } as ProctorEvent));
  }

  async getUserEvents(
    userId: number,
    options: {
      event_type?: ProctorEvent['type'];
      flagged_only?: boolean;
      limit?: number;
    } = {}
  ): Promise<ProctorEvent[]> {
    const params = new URLSearchParams();
    if (options.event_type) params.append('event_type', options.event_type);
    if (options.flagged_only) params.append('flagged_only', 'true');
    if (options.limit) params.append('limit', options.limit.toString());

    const query = params.toString();
    return this.makeRequest(`/users/${userId}/events${query ? `?${query}` : ''}`);
  }

  // Flag Management
  async createFlag(data: {
    session_uuid: string;
    user_id: number;
    flag_type: IntegrityFlag['flag_type'];
    confidence_score?: number;
    evidence?: any;
  }): Promise<{ flag_id: number; message: string }> {
    return this.makeRequest('/flags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFlagDecision(
    flagId: number,
    decision: IntegrityFlag['reviewer_decision']
  ): Promise<void> {
    await this.makeRequest(`/flags/${flagId}/decision`, {
      method: 'PUT',
      body: JSON.stringify({ reviewer_decision: decision }),
    });
  }

  async getSessionFlags(sessionUuid: string): Promise<IntegrityFlag[]> {
    return this.makeRequest(`/sessions/${sessionUuid}/flags`);
  }

  async getPendingFlags(): Promise<IntegrityFlag[]> {
    return this.makeRequest('/flags/pending');
  }

  // Analysis
  async getSessionAnalysis(sessionUuid: string): Promise<SessionAnalysis> {
    const analysis = await this.makeRequest(`/sessions/${sessionUuid}/analysis`);
    if (analysis?.session) this.normalizeSessionTimestamps(analysis.session);
    if (Array.isArray(analysis?.recent_events)) {
      analysis.recent_events = analysis.recent_events.map((e: any) => ({
        ...e,
        timestamp: this.normalizeTimestampToMs(e.timestamp),
      }));
    }
    return analysis;
  }

  async getCohortOverview(
    cohortId: number,
    includeDetails: boolean = false
  ): Promise<{
    cohort_id: number;
    total_sessions: number;
    average_integrity_score: number;
    total_flags: number;
    sessions_with_issues: number;
    session_analyses?: SessionAnalysis[];
  }> {
    const params = includeDetails ? '?include_details=true' : '';
    const overview = await this.makeRequest(`/cohorts/${cohortId}/integrity-overview${params}`);
    if (Array.isArray(overview?.session_analyses)) {
      overview.session_analyses = overview.session_analyses.map((sa: any) => {
        if (sa?.session) this.normalizeSessionTimestamps(sa.session);
        if (Array.isArray(sa?.recent_events)) {
          sa.recent_events = sa.recent_events.map((e: any) => ({
            ...e,
            timestamp: this.normalizeTimestampToMs(e.timestamp),
          }));
        }
        return sa;
      });
    }
    return overview;
  }

  // Analysis
  async analyzeGaze(data: {
    session_uuid: string;
    user_id: number;
    timestamp?: string; // ISO optional
    euler_angles?: { yaw?: number; pitch?: number; roll?: number };
    face_landmarks?: Array<{ x: number; y: number; z?: number }>;
    config?: Record<string, any>;
  }): Promise<{
    looking_away: boolean;
    confidence: number;
    metrics: Record<string, any>;
  }> {
    return this.makeRequest('/analyze/gaze', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async analyzeMouseDrift(data: {
    session_uuid: string;
    user_id: number;
    samples: Array<{ t: number; x: number; y: number }>;
    screen_width?: number;
    screen_height?: number;
    config?: Record<string, any>;
  }): Promise<{
    is_drift: boolean;
    drift_score: number;
    metrics: Record<string, any>;
  }> {
    return this.makeRequest('/analyze/mouse-drift', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; service: string; timestamp: string }> {
    return this.makeRequest('/health');
  }
}

// Export singleton instance
export const integrityAPI = new IntegrityAPI();

// Export event throttling utility
export class EventThrottler {
  private lastEventTimes: Map<string, number> = new Map();
  private cooldownPeriods: Map<string, number> = new Map();

  constructor() {
    // Set default cooldown periods (in milliseconds)
    this.setCooldown('face_not_detected', 2000);
    this.setCooldown('multiple_faces', 1000);
    this.setCooldown('looking_away', 3000);
    this.setCooldown('head_movement', 5000);
    this.setCooldown('pose_change', 5000);
    this.setCooldown('tab_switch', 1000);
    this.setCooldown('window_blur', 1000);
    this.setCooldown('copy_paste', 500);
  }

  setCooldown(eventType: ProctorEvent['type'], milliseconds: number) {
    this.cooldownPeriods.set(eventType, milliseconds);
  }

  shouldSendEvent(eventType: ProctorEvent['type']): boolean {
    const now = Date.now();
    const lastTime = this.lastEventTimes.get(eventType) || 0;
    const cooldown = this.cooldownPeriods.get(eventType) || 1000;

    if (now - lastTime >= cooldown) {
      this.lastEventTimes.set(eventType, now);
      return true;
    }

    return false;
  }

  reset() {
    this.lastEventTimes.clear();
  }
}

// Export utility for automatic event batching
export class EventBatcher {
  private events: Array<{
    session_uuid: string;
    user_id: number;
    event_type: ProctorEvent['type'];
    data?: any;
    severity?: ProctorEvent['severity'];
    flagged?: boolean;
  }> = [];
  private batchSize: number;
  private flushInterval: number;
  private timeoutId: number | null = null;

  constructor(batchSize: number = 10, flushIntervalMs: number = 5000) {
    this.batchSize = batchSize;
    this.flushInterval = flushIntervalMs;
  }

  addEvent(event: {
    session_uuid: string;
    user_id: number;
    event_type: ProctorEvent['type'];
    data?: any;
    severity?: ProctorEvent['severity'];
    flagged?: boolean;
  }) {
    this.events.push(event);

    // Auto-flush if batch is full
    if (this.events.length >= this.batchSize) {
      this.flush();
    } else {
      // Set timeout for next flush
      this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = window.setTimeout(() => {
      this.flush();
    }, this.flushInterval);
  }

  async flush(): Promise<void> {
    if (this.events.length === 0) return;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    const eventsToSend = [...this.events];
    this.events = [];

    try {
      await integrityAPI.createBatchEvents(eventsToSend);
    } catch (error) {
      console.error('Failed to send event batch:', error);
      // Optionally re-queue events or implement retry logic
    }
  }

  destroy() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.flush(); // Send any remaining events
  }
}
