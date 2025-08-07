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
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="max-w-2xl mx-auto text-center p-8">
                    <Shield className="w-16 h-16 mx-auto mb-6 text-blue-400" />
                    <h1 className="text-3xl font-bold mb-4">Integrity Assessment</h1>
                    <p className="text-gray-300 mb-8">
                        This assessment includes integrity monitoring to ensure fairness. 
                        We need access to your camera and microphone for proctoring purposes.
                    </p>
                    
                    <div className="bg-gray-900 rounded-lg p-6 mb-8">
                        <h3 className="text-lg font-semibold mb-4">What we monitor:</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                            <div className="flex items-center space-x-3">
                                <Eye className="w-5 h-5 text-blue-400" />
                                <span>Face presence detection</span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <Mic className="w-5 h-5 text-blue-400" />
                                <span>Background noise monitoring</span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <Monitor className="w-5 h-5 text-yellow-400" />
                                <span>Tab switching detection</span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <Shield className="w-5 h-5 text-green-400" />
                                <span>Copy/paste monitoring</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={requestPermissions}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
                    >
                        Grant Permissions & Start Assessment
                    </button>
                    
                    <div className="mt-6">
                        <button
                            onClick={() => router.back()}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            Return to Course
                        </button>
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

            {/* Assessment Content */}
            <div className="px-4 py-6 max-w-7xl mx-auto">
                {cohort && (
                    <>
                        <div className="mb-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl md:text-3xl font-light text-white mb-2">
                                        {cohort.name} - Integrity Assessment
                                    </h1>
                                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                                            <span>Monitoring Active</span>
                                        </div>
                                        <span>•</span>
                                        <span>{cohortCourses.length} course{cohortCourses.length !== 1 ? 's' : ''} available</span>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={() => router.back()}
                                    className="text-gray-400 hover:text-white transition-colors px-4 py-2 border border-gray-700 rounded-lg"
                                >
                                    Exit Assessment
                                </button>
                            </div>
                        </div>

                        {cohortCourses.length > 0 && (
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
                        )}
                        
                        {cohortCourses.length === 0 && (
                            <div className="text-center py-12">
                                <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-400">No courses available in this cohort</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
