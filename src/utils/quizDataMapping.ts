// Assessment Mode Data Mapping Utilities
// Handles conversion between frontend (camelCase) and backend (snake_case) formats

export interface FrontendQuizData {
  id?: string;
  title: string;
  questions: any[];
  scheduled_publish_at?: string | null;
  status?: string;
  assessmentMode: boolean;
  durationMinutes: number;
  integrityMonitoring: boolean;
  attemptsAllowed: number;
  shuffleQuestions: boolean;
  showResults: boolean;
  passingScore: number;
}

export interface BackendQuizData {
  id?: number;
  title: string;
  questions: any[];
  scheduled_publish_at?: string | null;
  status?: string;
  assessment_mode: boolean;
  duration_minutes: number;
  integrity_monitoring: boolean;
  attempts_allowed: number;
  shuffle_questions: boolean;
  show_results: boolean;
  passing_score_percentage: number;
}

/**
 * Maps frontend quiz data (camelCase) to backend format (snake_case)
 */
export const mapQuizDataForAPI = (frontendData: FrontendQuizData): BackendQuizData => {
  return {
    title: frontendData.title,
    questions: frontendData.questions,
    scheduled_publish_at: frontendData.scheduled_publish_at,
    status: frontendData.status,
    // Map frontend camelCase to backend snake_case
    assessment_mode: frontendData.assessmentMode,
    duration_minutes: frontendData.durationMinutes,
    integrity_monitoring: frontendData.integrityMonitoring,
    attempts_allowed: frontendData.attemptsAllowed,
    shuffle_questions: frontendData.shuffleQuestions,
    show_results: frontendData.showResults,
    passing_score_percentage: frontendData.passingScore
  };
};

/**
 * Maps backend quiz data (snake_case) to frontend format (camelCase)
 */
export const mapQuizDataFromAPI = (backendData: BackendQuizData): FrontendQuizData => {
  return {
    id: backendData.id?.toString(),
    title: backendData.title,
    questions: backendData.questions || [],
    scheduled_publish_at: backendData.scheduled_publish_at,
    status: backendData.status,
    // Map backend snake_case to frontend camelCase
    assessmentMode: backendData.assessment_mode || false,
    durationMinutes: backendData.duration_minutes || 60,
    integrityMonitoring: backendData.integrity_monitoring || false,
    attemptsAllowed: backendData.attempts_allowed || 1,
    shuffleQuestions: backendData.shuffle_questions || false,
    showResults: backendData.show_results !== undefined ? backendData.show_results : true,
    passingScore: backendData.passing_score_percentage || 60
  };
};

/**
 * Utility to handle quiz save operations with proper data mapping
 */
export const saveQuizWithMapping = async (
  quizData: FrontendQuizData, 
  taskId: string,
  isPublished: boolean = false
): Promise<FrontendQuizData> => {
  try {
    const apiPayload = mapQuizDataForAPI(quizData);
    const endpoint = isPublished ? 'PUT' : 'POST';
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${taskId}/quiz`, {
      method: endpoint,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiPayload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Failed to save quiz: ${response.status}`);
    }

    const savedQuiz = await response.json();
    
    // Map backend response back to frontend format
    return mapQuizDataFromAPI(savedQuiz);
  } catch (error) {
    console.error('Error saving quiz:', error);
    throw error;
  }
};

/**
 * Utility to handle quiz fetch operations with proper data mapping
 */
export const fetchQuizWithMapping = async (taskId: string): Promise<FrontendQuizData | null> => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/tasks/${taskId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch quiz: ${response.status}`);
    }

    const backendData = await response.json();
    return mapQuizDataFromAPI(backendData);
  } catch (error) {
    console.error('Error fetching quiz:', error);
    throw error;
  }
};

/**
 * Debug utility to log data transformations
 */
export const debugDataMapping = (frontendData: FrontendQuizData) => {
  const backendData = mapQuizDataForAPI(frontendData);
  const roundTrip = mapQuizDataFromAPI(backendData);
  
  console.group('🔄 Quiz Data Mapping Debug');
  console.log('Frontend (camelCase):', frontendData);
  console.log('Backend (snake_case):', backendData);
  console.log('Round Trip:', roundTrip);
  console.groupEnd();
};
