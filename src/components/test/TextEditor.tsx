'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    FileText,
    Save,
    RotateCcw,
    Download,
    Copy,
    Type,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Bold,
    Italic,
    Underline,
    List,
    CheckSquare
} from 'lucide-react';
import { proctorAPI, BehavioralMonitor, type EnhancedEventType } from '@/lib/proctor-api';

interface TextEditorProps {
    value: string;
    onChange: (value: string) => void;
    sessionUuid: string;
    userId: number;
    readOnly?: boolean;
    maxLength?: number;
}

export default function TextEditor({
    value,
    onChange,
    sessionUuid,
    userId,
    readOnly = false,
    maxLength = 5000
}: TextEditorProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [wordCount, setWordCount] = useState(0);
    const [isFormatting, setIsFormatting] = useState(false);
    const [selectedText, setSelectedText] = useState('');

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const behavioralMonitor = useRef(new BehavioralMonitor());
    const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

    // Track word count and behavioral patterns
    useEffect(() => {
        const words = value.trim().split(/\s+/).filter(word => word.length > 0);
        setWordCount(words.length);

        // Auto-save functionality
        if (autoSaveRef.current) {
            clearTimeout(autoSaveRef.current);
        }

        autoSaveRef.current = setTimeout(() => {
            saveContent();
        }, 5000); // Auto-save every 5 seconds

        return () => {
            if (autoSaveRef.current) {
                clearTimeout(autoSaveRef.current);
            }
        };
    }, [value]);

    // Track text editor interactions for behavioral analysis
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            behavioralMonitor.current.recordKeystroke();

            // Track specific text editing patterns
            if (e.ctrlKey || e.metaKey) {
                const eventType: EnhancedEventType = e.key === 'v' ? 'clipboard_suspicious' : 'text_editor_interaction';

                proctorAPI.createEnhancedEvent({
                    session_uuid: sessionUuid,
                    user_id: userId,
                    event_type: eventType,
                    data: {
                        key_combination: `${e.ctrlKey ? 'Ctrl+' : ''}${e.metaKey ? 'Cmd+' : ''}${e.key}`,
                        cursor_position: textarea.selectionStart,
                        content_length: value.length,
                        word_count: wordCount
                    },
                    severity: e.key === 'v' ? 'high' : 'low',
                    flagged: e.key === 'v',
                    context: {
                        editor_type: 'text',
                        test_id: sessionUuid
                    },
                    behavioral_data: behavioralMonitor.current.getBehavioralSummary()
                });
            }

            // Track long pauses in writing
            const pauseThreshold = 10000; // 10 seconds
            setTimeout(() => {
                const timeSinceLastKeystroke = Date.now() - Date.now();
                if (timeSinceLastKeystroke > pauseThreshold) {
                    proctorAPI.createEnhancedEvent({
                        session_uuid: sessionUuid,
                        user_id: userId,
                        event_type: 'excessive_typing_pause',
                        data: {
                            pause_duration: timeSinceLastKeystroke,
                            content_at_pause: value.slice(0, 100) + '...',
                            word_count: wordCount
                        },
                        severity: timeSinceLastKeystroke > 30000 ? 'high' : 'medium',
                        flagged: timeSinceLastKeystroke > 30000,
                        context: { editor_type: 'text' }
                    });
                }
            }, pauseThreshold);
        };

        const handleFocus = () => {
            behavioralMonitor.current.recordFocusChange(true);
            proctorAPI.createEnhancedEvent({
                session_uuid: sessionUuid,
                user_id: userId,
                event_type: 'text_editor_interaction',
                data: { action: 'focus_gained' },
                severity: 'low',
                context: { editor_type: 'text' }
            });
        };

        const handleBlur = () => {
            behavioralMonitor.current.recordFocusChange(false);
            saveContent(); // Auto-save on blur

            proctorAPI.createEnhancedEvent({
                session_uuid: sessionUuid,
                user_id: userId,
                event_type: 'text_editor_interaction',
                data: { action: 'focus_lost', content_length: value.length },
                severity: 'low',
                context: { editor_type: 'text' }
            });
        };

        const handleSelection = () => {
            const selection = window.getSelection()?.toString() || '';
            setSelectedText(selection);

            if (selection.length > 50) {
                proctorAPI.createEnhancedEvent({
                    session_uuid: sessionUuid,
                    user_id: userId,
                    event_type: 'text_editor_interaction',
                    data: {
                        action: 'large_text_selection',
                        selection_length: selection.length,
                        selection_preview: selection.slice(0, 50) + '...'
                    },
                    severity: 'low',
                    context: { editor_type: 'text' }
                });
            }
        };

        textarea.addEventListener('keydown', handleKeyDown);
        textarea.addEventListener('focus', handleFocus);
        textarea.addEventListener('blur', handleBlur);
        textarea.addEventListener('select', handleSelection);
        document.addEventListener('selectionchange', handleSelection);

        return () => {
            textarea.removeEventListener('keydown', handleKeyDown);
            textarea.removeEventListener('focus', handleFocus);
            textarea.removeEventListener('blur', handleBlur);
            textarea.removeEventListener('select', handleSelection);
            document.removeEventListener('selectionchange', handleSelection);
        };
    }, [sessionUuid, userId, value, wordCount]);

    // Detect writing pattern anomalies
    useEffect(() => {
        const interval = setInterval(() => {
            const anomalies = behavioralMonitor.current.detectAnomalies();

            anomalies.forEach(anomaly => {
                if (anomaly.severity === 'high') {
                    proctorAPI.createEnhancedEvent({
                        session_uuid: sessionUuid,
                        user_id: userId,
                        event_type: 'behavior_pattern_change',
                        data: {
                            anomaly_type: anomaly.type,
                            value: anomaly.value,
                            threshold: anomaly.threshold,
                            editor_type: 'text'
                        },
                        severity: anomaly.severity,
                        flagged: true,
                        context: { editor_type: 'text' },
                        behavioral_data: behavioralMonitor.current.getBehavioralSummary()
                    });
                }
            });
        }, 45000); // Check every 45 seconds

        return () => clearInterval(interval);
    }, [sessionUuid, userId]);

    const saveContent = async () => {
        setIsSaving(true);

        try {
            // Record save event
            proctorAPI.createEnhancedEvent({
                session_uuid: sessionUuid,
                user_id: userId,
                event_type: 'text_editor_interaction',
                data: {
                    action: 'content_save',
                    content_length: value.length,
                    word_count: wordCount,
                    auto_save: true
                },
                severity: 'low',
                context: { editor_type: 'text' }
            });

            // Simulate save delay
            await new Promise(resolve => setTimeout(resolve, 500));
            setLastSaved(new Date());
        } catch (error) {
            console.error('Failed to save content:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const resetContent = () => {
        onChange('');
        setLastSaved(null);

        proctorAPI.createEnhancedEvent({
            session_uuid: sessionUuid,
            user_id: userId,
            event_type: 'text_editor_interaction',
            data: { action: 'content_reset', previous_length: value.length },
            severity: 'medium',
            flagged: value.length > 100,
            context: { editor_type: 'text' }
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
                    source: 'text_editor'
                },
                severity: 'medium',
                flagged: true,
                context: { editor_type: 'text' }
            });
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    };

    const downloadContent = () => {
        const blob = new Blob([value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'response.txt';
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
                file_type: 'text',
                content_length: value.length
            },
            severity: 'high',
            flagged: true,
            context: { editor_type: 'text' }
        });
    };

    const formatText = (format: string) => {
        const textarea = textareaRef.current;
        if (!textarea || !selectedText) return;

        setIsFormatting(true);

        proctorAPI.createEnhancedEvent({
            session_uuid: sessionUuid,
            user_id: userId,
            event_type: 'text_editor_interaction',
            data: {
                action: 'text_formatting',
                format_type: format,
                selection_length: selectedText.length
            },
            severity: 'low',
            context: { editor_type: 'text' }
        });

        // Simple text formatting simulation
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const beforeText = value.substring(0, start);
        const afterText = value.substring(end);

        let formattedText = selectedText;
        switch (format) {
            case 'bold':
                formattedText = `**${selectedText}**`;
                break;
            case 'italic':
                formattedText = `*${selectedText}*`;
                break;
            case 'underline':
                formattedText = `_${selectedText}_`;
                break;
        }

        onChange(beforeText + formattedText + afterText);
        setIsFormatting(false);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;

        // Enforce max length
        if (newValue.length > maxLength) {
            return;
        }

        onChange(newValue);

        // Track large text changes (potential paste operations)
        if (Math.abs(newValue.length - value.length) > 100) {
            proctorAPI.createEnhancedEvent({
                session_uuid: sessionUuid,
                user_id: userId,
                event_type: 'text_editor_interaction',
                data: {
                    action: 'large_text_change',
                    old_length: value.length,
                    new_length: newValue.length,
                    change_magnitude: Math.abs(newValue.length - value.length)
                },
                severity: Math.abs(newValue.length - value.length) > 500 ? 'high' : 'medium',
                flagged: Math.abs(newValue.length - value.length) > 500,
                context: { editor_type: 'text' }
            });
        }
    };

    const getReadingTime = (): number => {
        // Average reading speed: 200 words per minute
        return Math.ceil(wordCount / 200);
    };

    const getProgressColor = (): string => {
        const percentage = (value.length / maxLength) * 100;
        if (percentage >= 90) return 'text-red-500';
        if (percentage >= 75) return 'text-yellow-500';
        return 'text-green-500';
    };

    return (
        <div className="space-y-4">
            {/* Editor Header */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <FileText className="h-5 w-5" />
                            Text Editor
                            {lastSaved && (
                                <Badge variant="outline" className="ml-2 text-green-600">
                                    Saved {lastSaved.toLocaleTimeString()}
                                </Badge>
                            )}
                        </CardTitle>

                        <div className="flex items-center gap-2">
                            {/* Formatting Tools */}
                            <div className="flex items-center gap-1 border-r pr-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => formatText('bold')}
                                    disabled={!selectedText || isFormatting}
                                    title="Bold"
                                >
                                    <Bold className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => formatText('italic')}
                                    disabled={!selectedText || isFormatting}
                                    title="Italic"
                                >
                                    <Italic className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => formatText('underline')}
                                    disabled={!selectedText || isFormatting}
                                    title="Underline"
                                >
                                    <Underline className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={copyToClipboard}
                                    disabled={!value.trim()}
                                    title="Copy"
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={downloadContent}
                                    disabled={!value.trim()}
                                    title="Download"
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={resetContent}
                                    disabled={!value.trim()}
                                    title="Reset"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                                <Button
                                    onClick={saveContent}
                                    disabled={isSaving || !value.trim()}
                                    className="bg-blue-600 hover:bg-blue-700"
                                    size="sm"
                                >
                                    <Save className="h-4 w-4 mr-1" />
                                    {isSaving ? 'Saving...' : 'Save'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Text Editor */}
            <Card>
                <CardContent className="p-0">
                    <div className="relative">
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={handleTextChange}
                            readOnly={readOnly}
                            className="w-full min-h-[500px] p-6 resize-none outline-none border-none bg-white text-gray-900 placeholder-gray-400 leading-relaxed"
                            style={{ fontSize: '16px', fontFamily: 'system-ui, sans-serif' }}
                            placeholder="Start writing your response here..."
                            maxLength={maxLength}
                        />

                        {/* Character/Word Counter */}
                        <div className="absolute bottom-4 right-4 flex items-center gap-4 text-sm text-gray-500 bg-white px-3 py-1 rounded-lg shadow-sm border">
                            <span>{wordCount} words</span>
                            <span className={getProgressColor()}>
                                {value.length}/{maxLength} characters
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Writing Statistics */}
            <div className="grid grid-cols-5 gap-4 text-center">
                <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{wordCount}</div>
                    <div className="text-xs text-gray-500">Words</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{value.length}</div>
                    <div className="text-xs text-gray-500">Characters</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{value.split(/[.!?]+/).filter(s => s.trim().length > 0).length}</div>
                    <div className="text-xs text-gray-500">Sentences</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{getReadingTime()}</div>
                    <div className="text-xs text-gray-500">Min Read</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{behavioralMonitor.current.getTypingSpeed()}</div>
                    <div className="text-xs text-gray-500">WPM</div>
                </div>
            </div>

            {/* Content Analysis */}
            {value.length > 100 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Writing Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <div className="text-gray-500">Avg Sentence Length</div>
                                <div className="font-medium">
                                    {Math.round(wordCount / Math.max(1, value.split(/[.!?]+/).filter(s => s.trim().length > 0).length))} words
                                </div>
                            </div>
                            <div>
                                <div className="text-gray-500">Avg Word Length</div>
                                <div className="font-medium">
                                    {wordCount > 0 ? Math.round(value.replace(/\s+/g, '').length / wordCount * 10) / 10 : 0} chars
                                </div>
                            </div>
                            <div>
                                <div className="text-gray-500">Paragraphs</div>
                                <div className="font-medium">
                                    {value.split(/\n\s*\n/).filter(p => p.trim().length > 0).length}
                                </div>
                            </div>
                            <div>
                                <div className="text-gray-500">Typing Speed</div>
                                <div className="font-medium">
                                    {behavioralMonitor.current.getTypingSpeed()} WPM
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
