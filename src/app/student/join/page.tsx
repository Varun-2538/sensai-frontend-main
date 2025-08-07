"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function StudentJoinPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const [courseCode, setCourseCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleJoinCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!courseCode.trim()) {
            setError('Please enter a course code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Parse the course code - it should be a URL like domain.com/school/slug/join?cohortId=123
            const code = courseCode.trim();
            let inviteUrl;
            
            if (code.startsWith('http') && code.includes('/school/') && code.includes('/join?cohortId=')) {
                // Full URL provided
                inviteUrl = new URL(code);
            } else if (code.includes('/school/') && code.includes('/join?cohortId=')) {
                // Relative URL provided
                inviteUrl = new URL(code, window.location.origin);
            } else {
                throw new Error('Invalid invite link format. Please paste the complete invite link.');
            }
            
            const pathParts = inviteUrl.pathname.split('/');
            const schoolSlug = pathParts[2]; // /school/{slug}/join
            const cohortId = inviteUrl.searchParams.get('cohortId');
            
            if (!schoolSlug || !cohortId) {
                throw new Error('Invalid invite link. Please check the link and try again.');
            }
            
            // Use the existing join endpoint
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohortId}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    emails: [user?.email],
                    roles: ['learner'],
                    org_slug: schoolSlug
                })
            });

            if (!response.ok) {
                if (response.status === 400) {
                    const errorData = await response.json();
                    if (errorData.detail && errorData.detail.includes('already exists')) {
                        // User is already in this cohort, just redirect them
                        router.push(`/school/${schoolSlug}/cohort/${cohortId}`);
                        return;
                    }
                }
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to join course');
            }
            
            // Redirect to the course/cohort page
            router.push(`/school/${schoolSlug}/cohort/${cohortId}`);
        } catch (error) {
            console.error('Error joining course:', error);
            setError(error instanceof Error ? error.message : 'Failed to join course. Please check the invite link and try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="max-w-md mx-auto text-center p-8">
                    <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
                    <p className="text-gray-400 mb-6">You need to sign in to join a course</p>
                    <Link
                        href="/login?role=student"
                        className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Sign In as Student
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center text-gray-400 hover:text-white mb-6"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Home
                    </Link>
                    
                    <div className="text-center">
                        <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold mb-2">Join a Course</h1>
                        <p className="text-gray-400">Enter your course code to get started with learning</p>
                    </div>
                </div>

                {/* Join Form */}
                <div className="bg-gray-900 rounded-lg p-8">
                    <form onSubmit={handleJoinCourse} className="space-y-6">
                        <div>
                            <label htmlFor="courseCode" className="block text-sm font-medium text-gray-300 mb-2">
                                Invite Link
                            </label>
                            <input
                                type="text"
                                id="courseCode"
                                value={courseCode}
                                onChange={(e) => setCourseCode(e.target.value)}
                                placeholder="Paste your invite link here"
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                disabled={loading}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Paste the complete invite link provided by your instructor (e.g., domain.com/school/xyz/join?cohortId=123)
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4">
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !courseCode.trim()}
                            className="w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Joining Course...' : 'Join Course'}
                        </button>
                    </form>
                </div>

                {/* Help Section */}
                <div className="mt-8 bg-gray-900 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <BookOpen className="w-5 h-5 mr-2 text-green-400" />
                        Don't have an invite link?
                    </h3>
                    <div className="space-y-3 text-sm text-gray-400">
                        <p>• Ask your instructor or teacher for the invite link</p>
                        <p>• Check your email for an invitation link</p>
                        <p>• Invite links are usually shared during the first class</p>
                        <p>• The link should look like: yourschool.com/school/xyz/join?cohortId=123</p>
                    </div>
                </div>

                {/* Alternative Actions */}
                <div className="mt-6 text-center">
                    <p className="text-gray-400 text-sm">
                        Are you an educator?{' '}
                        <Link href="/" className="text-blue-400 hover:text-blue-300">
                            Create a course instead
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
