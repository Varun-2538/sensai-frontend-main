"use client";

import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Header } from '@/components/layout/header';
import IntegrityDashboard from '@/components/integrity/IntegrityDashboard';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function IntegrityReviewPage() {
    const params = useParams();
    const { isAuthenticated, isLoading } = useAuth();
    
    const schoolId = params.id as string;
    const cohortId = parseInt(params.cohortId as string);

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
                <p>Please log in to access the admin dashboard</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <Header showCreateCourseButton={false} />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href={`/school/admin/${schoolId}/cohorts/${cohortId}`}
                        className="inline-flex items-center text-gray-400 hover:text-white mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Cohort
                    </Link>
                    
                    <h1 className="text-3xl font-bold text-white">Integrity Review Dashboard</h1>
                    <p className="text-gray-400 mt-2">
                        Monitor and review assessment integrity for all candidates in this cohort
                    </p>
                </div>

                {/* Dashboard */}
                <IntegrityDashboard cohortId={cohortId} />
            </div>
        </div>
    );
}
