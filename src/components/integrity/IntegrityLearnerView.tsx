"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Mic, Shield, AlertTriangle, Eye, Monitor } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import LearnerCohortView from '@/components/LearnerCohortView';
import IntegratedProctorSystem from '@/components/IntegratedProctorSystem';
import { useCourses } from '@/lib/api';
import { Course, Cohort } from '@/types';

interface IntegrityLearnerViewProps {
    cohortId: string;
    schoolSlug: string;
    taskId?: string;
}

export default function IntegrityLearnerView({ 
    cohortId, 
    schoolSlug,
    taskId 
}: IntegrityLearnerViewProps) {
    const router = useRouter();
    const { user } = useAuth();
    const { courses } = useCourses();
    
    const [permissionsGranted, setPermissionsGranted] = useState(false);
    const [integrityEnabled, setIntegrityEnabled] = useState(false);
    const [cohort, setCohort] = useState<Cohort | null>(null);
    const [cohortCourses, setCohortCourses] = useState<Course[]>([]);
    const [activeCourseIndex, setActiveCourseIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch cohort data
    useEffect(() => {
        const fetchCohortData = async () => {
            if (!cohortId) return;
            
            try {
                setLoading(true);
                
                // Fetch cohort details
                const cohortResponse = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}`
                );
                
                if (!cohortResponse.ok) {
                    throw new Error(`Failed to fetch cohort: ${cohortResponse.status}`);
                }
                
                const cohortData = await cohortResponse.json();
                setCohort(cohortData);
                
                // Fetch cohort courses
                const coursesResponse = await fetch(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/courses`
                );
                
                if (coursesResponse.ok) {
                    const coursesData = await coursesResponse.json();
                    setCohortCourses(coursesData);
                }
                
            } catch (error) {
                console.error('Failed to fetch cohort data:', error);
                setError('Failed to load assessment data');
            } finally {
                setLoading(false);
            }
        };

        fetchCohortData();
    }, [cohortId]);

    // Request permissions for integrity monitoring
    const requestPermissions = async () => {
        try {
            // Request camera and microphone
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            // Stop the test stream immediately
            stream.getTracks().forEach(track => track.stop());
            
            setPermissionsGranted(true);
            setIntegrityEnabled(true);
        } catch (error) {
            console.error('Permission denied:', error);
            alert('Camera and microphone access is required for this integrity-monitored assessment.');
        }
    };

    const handleCourseSelect = useCallback((index: number) => {
        setActiveCourseIndex(index);
    }, []);

    // Show loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                    <h1 className="text-2xl font-bold mb-2">Error</h1>
                    <p className="text-gray-400">{error}</p>
                </div>
            </div>
        );
    }

    // Show permissions request screen
    if (!permissionsGranted) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="bg-gradient-to-b from-gray-900 to-black border border-gray-800 rounded-2xl p-8 md:p-12 shadow-2xl">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full opacity-20 blur-xl"></div>
                            <Shield className="relative w-20 h-20 mx-auto text-blue-400" />
                        </div>
                        
                        <h1 className="text-4xl md:text-5xl font-light mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                            Integrity Assessment
                        </h1>
                        
                        <p className="text-lg text-gray-300 mb-10 leading-relaxed">
                            This assessment includes comprehensive integrity monitoring to ensure fairness and maintain academic standards. 
                            Camera and microphone access is required for proctoring.
                        </p>
                        
                        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 mb-10 border border-gray-700">
                            <h3 className="text-xl font-light mb-6 text-white">Monitoring Features</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                <div className="flex items-start space-x-4 group">
                                    <div className="bg-blue-600/20 p-2 rounded-lg group-hover:bg-blue-600/30 transition-colors">
                                        <Eye className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-white">Identity Verification</div>
                                        <div className="text-sm text-gray-400">Continuous face presence detection</div>
                                    </div>
                                </div>
                                
                                <div className="flex items-start space-x-4 group">
                                    <div className="bg-green-600/20 p-2 rounded-lg group-hover:bg-green-600/30 transition-colors">
                                        <Mic className="w-5 h-5 text-green-400" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-white">Audio Monitoring</div>
                                        <div className="text-sm text-gray-400">Background noise and voice detection</div>
                                    </div>
                                </div>
                                
                                <div className="flex items-start space-x-4 group">
                                    <div className="bg-yellow-600/20 p-2 rounded-lg group-hover:bg-yellow-600/30 transition-colors">
                                        <Monitor className="w-5 h-5 text-yellow-400" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-white">Browser Activity</div>
                                        <div className="text-sm text-gray-400">Tab switching and window focus</div>
                                    </div>
                                </div>
                                
                                <div className="flex items-start space-x-4 group">
                                    <div className="bg-purple-600/20 p-2 rounded-lg group-hover:bg-purple-600/30 transition-colors">
                                        <Shield className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-white">Input Security</div>
                                        <div className="text-sm text-gray-400">Copy/paste and keyboard monitoring</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={requestPermissions}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-10 py-4 rounded-full font-medium text-lg transition-all duration-200 transform hover:scale-105 shadow-xl cursor-pointer"
                            >
                                Grant Permissions & Start Assessment
                            </button>
                            
                            <div className="text-center">
                                <button
                                    onClick={() => router.back()}
                                    className="text-gray-400 hover:text-white transition-colors px-6 py-2 rounded-lg cursor-pointer"
                                >
                                    ← Return to Course
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Main assessment interface with integrity monitoring
    return (
        <div className="relative bg-black min-h-screen">
            {/* Integrity Monitoring Overlay */}
            {integrityEnabled && (
                <div className="fixed top-20 right-4 z-50">
                    <IntegratedProctorSystem
                        userId={user?.id || 0}
                        cohortId={parseInt(cohortId)}
                        taskId={taskId ? parseInt(taskId) : undefined}
                        sensitivity="medium"
                        autoStart={true}
                    />
                </div>
            )}

            {/* Monitoring Status Bar */}
            <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border-b border-gray-800 backdrop-blur-sm">
                <div className="px-4 py-3 max-w-7xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <div className="relative">
                                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                    <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-75"></div>
                                </div>
                                <span className="text-green-400 font-medium">Integrity Monitoring Active</span>
                            </div>
                            <div className="h-4 w-px bg-gray-600"></div>
                            <div className="flex items-center space-x-2">
                                <Shield className="w-4 h-4 text-blue-400" />
                                <span className="text-gray-300 text-sm">Session Protected</span>
                            </div>
                        </div>
                        
                        <button
                            onClick={() => router.back()}
                            className="text-gray-400 hover:text-white transition-colors px-4 py-2 border border-gray-700 rounded-lg hover:border-gray-600 cursor-pointer"
                        >
                            Exit Assessment
                        </button>
                    </div>
                </div>
            </div>

            {/* Assessment Content */}
            <div className="px-4 py-8 max-w-7xl mx-auto">
                {cohort && (
                    <>
                        <div className="mb-8">
                            <h1 className="text-3xl md:text-4xl font-light text-white mb-3">
                                {cohort.name}
                            </h1>
                            <p className="text-gray-400 text-lg">
                                Integrity-monitored assessment • {cohortCourses.length} course{cohortCourses.length !== 1 ? 's' : ''} available
                            </p>
                        </div>

                        {cohortCourses.length > 0 && (
                            <div className="bg-gray-900/30 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden">
                                <LearnerCohortView
                                    courseTitle=""
                                    modules={[]} // Will be populated by the component
                                    schoolId={schoolSlug}
                                    cohortId={cohortId}
                                    courses={cohortCourses}
                                    onCourseSelect={handleCourseSelect}
                                    activeCourseIndex={activeCourseIndex}
                                    integrityMode={true}
                                    sessionUuid={`INT-${cohortId}-${user?.id}`}
                                />
                            </div>
                        )}
                        
                        {cohortCourses.length === 0 && (
                            <div className="text-center py-16">
                                <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 p-12 max-w-md mx-auto">
                                    <AlertTriangle className="w-16 h-16 text-gray-600 mx-auto mb-6" />
                                    <h3 className="text-xl font-light text-white mb-3">No Courses Available</h3>
                                    <p className="text-gray-400">There are no courses available in this cohort for assessment.</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
