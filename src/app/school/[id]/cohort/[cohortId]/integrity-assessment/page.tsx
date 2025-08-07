"use client";

import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import IntegrityLearnerView from '@/components/integrity/IntegrityLearnerView';
import { Header } from '@/components/layout/header';

export default function IntegrityAssessmentPage() {
    const params = useParams();
    const { user, isAuthenticated, isLoading } = useAuth();
    
    const schoolId = params.id as string;
    const cohortId = params.cohortId as string;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <p>Please log in to access the assessment</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black">
            <Header showCreateCourseButton={false} />
            <IntegrityLearnerView 
                cohortId={cohortId}
                schoolSlug={schoolId}
            />
        </div>
    );
}
