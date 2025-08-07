'use client';

import React, { useState } from 'react';
import IntegratedProctorSystem from '@/components/IntegratedProctorSystem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, User, BookOpen, Users } from 'lucide-react';

export default function IntegrityDemoPage() {
  const [selectedUser] = useState(1); // Demo user ID
  const [selectedCohort] = useState(1); // Demo cohort ID
  const [selectedTask] = useState(1); // Demo task ID
  const [sessionResults, setSessionResults] = useState<any>(null);
  const [isStarted, setIsStarted] = useState(false);

  const handleSessionEnd = (sessionUuid: string, analysis: any) => {
    setSessionResults({ sessionUuid, analysis });
    setIsStarted(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">MediaPipe Proctoring Demo</h1>
        <p className="text-gray-600">
          Demonstration of integrated proctoring system with MediaPipe and backend monitoring
        </p>
      </div>

      {/* Demo Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Demo Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <User className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-sm font-medium">User ID</div>
                <div className="text-xs text-gray-600">{selectedUser}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
              <Users className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-sm font-medium">Cohort ID</div>
                <div className="text-xs text-gray-600">{selectedCohort}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
              <BookOpen className="h-4 w-4 text-purple-600" />
              <div>
                <div className="text-sm font-medium">Task ID</div>
                <div className="text-xs text-gray-600">{selectedTask}</div>
              </div>
            </div>
          </div>
          
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              This demo requires camera permissions and a stable internet connection. 
              The system will monitor for face detection, multiple faces, gaze tracking, 
              tab switching, and copy/paste activities.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Features Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">MediaPipe Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default">✓</Badge>
                <span className="text-sm">Real-time face detection</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">✓</Badge>
                <span className="text-sm">Multiple face detection</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">✓</Badge>
                <span className="text-sm">Gaze direction tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">✓</Badge>
                <span className="text-sm">Head movement analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">✓</Badge>
                <span className="text-sm">Pose detection</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Native Browser Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">✓</Badge>
                <span className="text-sm">Tab switching detection</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">✓</Badge>
                <span className="text-sm">Window blur monitoring</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">✓</Badge>
                <span className="text-sm">Copy/paste detection</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">✓</Badge>
                <span className="text-sm">Right-click prevention</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">✓</Badge>
                <span className="text-sm">Event batching & throttling</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Proctoring System */}
      <IntegratedProctorSystem
        userId={selectedUser}
        cohortId={selectedCohort}
        taskId={selectedTask}
        onSessionEnd={handleSessionEnd}
        sensitivity="medium"
        autoStart={false}
      />

      {/* Session Results */}
      {sessionResults && (
        <Card>
          <CardHeader>
            <CardTitle>Session Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium">Session UUID</div>
                <div className="font-mono text-xs text-gray-600">
                  {sessionResults.sessionUuid}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-800">
                    {sessionResults.analysis.integrity_score}%
                  </div>
                  <div className="text-xs text-blue-600">Integrity Score</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-800">
                    {sessionResults.analysis.total_events}
                  </div>
                  <div className="text-xs text-green-600">Total Events</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-lg font-bold text-yellow-800">
                    {sessionResults.analysis.flagged_events}
                  </div>
                  <div className="text-xs text-yellow-600">Flagged Events</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-lg font-bold text-red-800">
                    {sessionResults.analysis.flags_count}
                  </div>
                  <div className="text-xs text-red-600">Flags Generated</div>
                </div>
              </div>

              {Object.keys(sessionResults.analysis.event_types).length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Event Types Distribution</div>
                  <div className="space-y-1">
                    {Object.entries(sessionResults.analysis.event_types).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center p-2 bg-white rounded border">
                        <span className="text-sm capitalize">{type.replace(/_/g, ' ')}</span>
                        <Badge variant="outline">{count as number}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>1. Start Proctoring:</strong> Click "Start Proctoring" to initialize the session</p>
            <p><strong>2. Face Detection:</strong> Move your face out of view to trigger "face not detected"</p>
            <p><strong>3. Multiple Faces:</strong> Have another person join you in the camera view</p>
            <p><strong>4. Gaze Tracking:</strong> Look away from the camera for extended periods</p>
            <p><strong>5. Tab Switching:</strong> Switch to another browser tab or application</p>
            <p><strong>6. Copy/Paste:</strong> Try copying and pasting text anywhere on the page</p>
            <p><strong>7. End Session:</strong> Click "End Session" to see the complete analysis</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
