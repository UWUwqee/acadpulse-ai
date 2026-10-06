export type TaskType = 'assignment' | 'project' | 'quiz' | 'examination' | 'deadline';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type ResourceCategory = 'syllabus' | 'slides' | 'reviewer' | 'link' | 'past_paper';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  instructor: string;
  units: number;
  color: string;
  semester: string;
  meetingSchedule?: string;
  createdAt: string;
}

export interface AcademicTask {
  id: string;
  title: string;
  subjectId: string;
  type: TaskType;
  dueDate: string; // ISO string format
  estimatedHours: number;
  priority: TaskPriority;
  status: TaskStatus;
  subtasks: Subtask[];
  weightPercentage?: number;
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AcademicResource {
  id: string;
  title: string;
  subjectId: string;
  category: ResourceCategory;
  url?: string;
  contentSnippet?: string;
  tags: string[];
  dateAdded: string;
}

export interface WorkloadAnalysis {
  workloadScore: number;
  statusLabel: 'Optimal' | 'Manageable' | 'Heavy' | 'Overloaded';
  urgentCount: number;
  missingCount: number;
  totalPendingHours: number;
  burnoutRisk: 'Low' | 'Moderate' | 'High';
  studyRecommendations: string[];
  timeAllocationSuggestions: {
    subjectName: string;
    recommendedHours: number;
    reason: string;
  }[];
  aiInsights: string;
  generatedAt: string;
}

export interface FirebaseConnectionConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}
