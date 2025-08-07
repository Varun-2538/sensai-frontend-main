'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Play,
    Square,
    RotateCcw,
    Download,
    Copy,
    CheckCircle,
    AlertTriangle,
    Code2,
    Zap
} from 'lucide-react';
import { proctorAPI, BehavioralMonitor, type EnhancedEventType } from '@/lib/proctor-api';

interface CodeEditorProps {
    language: string;
    value: string;
    onChange: (value: string) => void;
    sessionUuid: string;
    userId: number;
    readOnly?: boolean;
}

// Mock code execution results for demo
const mockExecutionResults = {
    javascript: {
        success: true,
        output: "Array sorted successfully!\n[11, 12, 22, 25, 34, 64, 90]",
        executionTime: "2.3ms"
    },
    python: {
        success: true,
        output: "Function executed successfully!\nTest cases passed: 3/3",
        executionTime: "1.8ms"
    },
    java: {
        success: false,
        output: "Compilation Error: Missing semicolon on line 15",
        executionTime: "0ms"
    }
};

export default function CodeEditor({
    language,
    value,
    onChange,
    sessionUuid,
    userId,
    readOnly = false
}: CodeEditorProps) {
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionResult, setExecutionResult] = useState<any>(null);
    const [showLineNumbers, setShowLineNumbers] = useState(true);
    const [fontSize, setFontSize] = useState(14);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const behavioralMonitor = useRef(new BehavioralMonitor());
    const lastInteractionRef = useRef<number>(Date.now());

    // Track editor interactions for behavioral analysis
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            behavioralMonitor.current.recordKeystroke();
            lastInteractionRef.current = Date.now();

            // Track specific coding patterns
            if (e.ctrlKey || e.metaKey) {
                const eventType: EnhancedEventType = e.key === 'v' ? 'clipboard_suspicious' : 'code_editor_interaction';

                proctorAPI.createEnhancedEvent({
                    session_uuid: sessionUuid,
                    user_id: userId,
                    event_type: eventType,
                    data: {
                        key_combination: `${e.ctrlKey ? 'Ctrl+' : ''}${e.metaKey ? 'Cmd+' : ''}${e.key}`,
                        editor_language: language,
                        cursor_position: textarea.selectionStart,
                        content_length: value.length
                    },
                    severity: e.key === 'v' ? 'high' : 'low',
                    flagged: e.key === 'v',
                    context: {
                        editor_type: 'code',
                        test_id: sessionUuid
                    },
                    behavioral_data: behavioralMonitor.current.getBehavioralSummary()
                });
            }
        };

        const handleFocus = () => {
            behavioralMonitor.current.recordFocusChange(true);
            proctorAPI.createEnhancedEvent({
                session_uuid: sessionUuid,
                user_id: userId,
                event_type: 'code_editor_interaction',
                data: { action: 'focus_gained', language },
                severity: 'low',
                context: { editor_type: 'code' }
            });
        };

        const handleBlur = () => {
            behavioralMonitor.current.recordFocusChange(false);
            proctorAPI.createEnhancedEvent({
                session_uuid: sessionUuid,
                user_id: userId,
                event_type: 'code_editor_interaction',
                data: { action: 'focus_lost', language },
                severity: 'low',
                context: { editor_type: 'code' }
            });
        };

        textarea.addEventListener('keydown', handleKeyDown);
        textarea.addEventListener('focus', handleFocus);
        textarea.addEventListener('blur', handleBlur);

        return () => {
            textarea.removeEventListener('keydown', handleKeyDown);
            textarea.removeEventListener('focus', handleFocus);
            textarea.removeEventListener('blur', handleBlur);
        };
    }, [sessionUuid, userId, language, value]);

    // Detect typing pattern anomalies
    useEffect(() => {
        const interval = setInterval(() => {
            const anomalies = behavioralMonitor.current.detectAnomalies();

            anomalies.forEach(anomaly => {
                if (anomaly.severity === 'high') {
                    proctorAPI.createEnhancedEvent({
                        session_uuid: sessionUuid,
                        user_id: userId,
                        event_type: 'keystroke_pattern_anomaly',
                        data: {
                            anomaly_type: anomaly.type,
                            value: anomaly.value,
                            threshold: anomaly.threshold,
                            editor_type: 'code'
                        },
                        severity: anomaly.severity,
                        flagged: true,
                        context: { editor_type: 'code' },
                        behavioral_data: behavioralMonitor.current.getBehavioralSummary()
                    });
                }
            });
        }, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, [sessionUuid, userId]);

    const executeCode = async () => {
        setIsExecuting(true);

        // Record code execution event
        proctorAPI.createEnhancedEvent({
            session_uuid: sessionUuid,
            user_id: userId,
            event_type: 'code_editor_interaction',
            data: {
                action: 'code_execution',
                language,
                code_length: value.length,
                line_count: value.split('\n').length
            },
            severity: 'low',
            context: { editor_type: 'code' }
        });

        // Simulate code execution (in real implementation, this would send to a secure sandbox)
        setTimeout(() => {
            const result = mockExecutionResults[language as keyof typeof mockExecutionResults] || {
                success: false,
                output: "Language not supported for execution",
                executionTime: "0ms"
            };

            setExecutionResult(result);
            setIsExecuting(false);
        }, 1500);
    };

    const resetCode = () => {
        onChange('');
        setExecutionResult(null);

        proctorAPI.createEnhancedEvent({
            session_uuid: sessionUuid,
            user_id: userId,
            event_type: 'code_editor_interaction',
            data: { action: 'code_reset', language },
            severity: 'low',
            context: { editor_type: 'code' }
        });
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(value);

            proctorAPI.createEnhancedEvent({
                session_uuid: sessionUuid,
                user_id: userId,
                event_type: 'copy_paste',
                data: {
                    action: 'copy',
                    content_length: value.length,
                    source: 'code_editor'
                },
                severity: 'medium',
                flagged: true,
                context: { editor_type: 'code' }
            });
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    };

    const downloadCode = () => {
        const blob = new Blob([value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `code.${language === 'javascript' ? 'js' : language}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        proctorAPI.createEnhancedEvent({
            session_uuid: sessionUuid,
            user_id: userId,
            event_type: 'suspicious_activity',
            data: {
                action: 'file_download',
                file_type: 'code',
                language
            },
            severity: 'high',
            flagged: true,
            context: { editor_type: 'code' }
        });
    };

    const getLanguageIcon = () => {
        switch (language) {
            case 'javascript': return '🟨';
            case 'python': return '🐍';
            case 'java': return '☕';
            case 'cpp': return '⚡';
            default: return '📝';
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        onChange(newValue);

        // Track significant changes
        if (Math.abs(newValue.length - value.length) > 50) {
            proctorAPI.createEnhancedEvent({
                session_uuid: sessionUuid,
                user_id: userId,
                event_type: 'code_editor_interaction',
                data: {
                    action: 'large_text_change',
                    old_length: value.length,
                    new_length: newValue.length,
                    language
                },
                severity: newValue.length > value.length * 2 ? 'medium' : 'low',
                flagged: newValue.length > value.length * 2,
                context: { editor_type: 'code' }
            });
        }
    };

    return (
        <div className="space-y-4">
            {/* Editor Header */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Code2 className="h-5 w-5" />
                            Code Editor
                            <Badge variant="outline" className="ml-2">
                                {getLanguageIcon()} {language.toUpperCase()}
                            </Badge>
                        </CardTitle>

                        <div className="flex items-center gap-2">
                            {/* Editor Controls */}
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowLineNumbers(!showLineNumbers)}
                                >
                                    Lines
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFontSize(fontSize === 14 ? 16 : 14)}
                                >
                                    {fontSize}px
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                                >
                                    {theme === 'light' ? '🌙' : '☀️'}
                                </Button>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={copyToClipboard}
                                    disabled={!value.trim()}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={downloadCode}
                                    disabled={!value.trim()}
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={resetCode}
                                    disabled={!value.trim()}
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                                <Button
                                    onClick={executeCode}
                                    disabled={isExecuting || !value.trim()}
                                    className="bg-green-600 hover:bg-green-700"
                                    size="sm"
                                >
                                    {isExecuting ? (
                                        <Square className="h-4 w-4" />
                                    ) : (
                                        <Play className="h-4 w-4" />
                                    )}
                                    {isExecuting ? 'Running...' : 'Run'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Code Editor */}
            <Card>
                <CardContent className="p-0">
                    <div className={`relative ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
                        {/* Line Numbers */}
                        {showLineNumbers && (
                            <div className={`absolute left-0 top-0 w-12 h-full ${theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500'} border-r text-xs font-mono flex flex-col z-10`}>
                                {value.split('\n').map((_, index) => (
                                    <div key={index} className="h-6 flex items-center justify-end pr-2 leading-6">
                                        {index + 1}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Code Textarea */}
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={handleTextChange}
                            readOnly={readOnly}
                            className={`
                w-full min-h-[400px] font-mono resize-none outline-none border-none
                ${showLineNumbers ? 'pl-14' : 'pl-4'} pr-4 py-3
                ${theme === 'dark'
                                    ? 'bg-gray-900 text-gray-100 placeholder-gray-500'
                                    : 'bg-white text-gray-900 placeholder-gray-400'
                                }
                leading-6
              `}
                            style={{ fontSize: `${fontSize}px` }}
                            placeholder={`Write your ${language} code here...`}
                            spellCheck={false}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Execution Results */}
            {executionResult && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Zap className="h-4 w-4" />
                            Execution Result
                            {executionResult.success ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <Badge variant={executionResult.success ? 'default' : 'destructive'}>
                                    {executionResult.success ? 'Success' : 'Error'}
                                </Badge>
                                <span className="text-gray-500">
                                    Execution time: {executionResult.executionTime}
                                </span>
                            </div>

                            <div className={`p-3 rounded-lg font-mono text-sm whitespace-pre-wrap ${executionResult.success
                                    ? 'bg-green-50 text-green-800 border border-green-200'
                                    : 'bg-red-50 text-red-800 border border-red-200'
                                }`}>
                                {executionResult.output}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Editor Stats */}
            <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{value.split('\n').length}</div>
                    <div className="text-xs text-gray-500">Lines</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{value.length}</div>
                    <div className="text-xs text-gray-500">Characters</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{value.split(/\s+/).filter(w => w.length > 0).length}</div>
                    <div className="text-xs text-gray-500">Words</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{behavioralMonitor.current.getTypingSpeed()}</div>
                    <div className="text-xs text-gray-500">WPM</div>
                </div>
            </div>
        </div>
    );
}
