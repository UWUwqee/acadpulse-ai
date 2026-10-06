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

export interface PublicProfile {
  uid: string;
  nickname: string;
  photoBase64: string;
  updatedAt: string;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt?: unknown;
}

export interface Friendship {
  id: string;
  participants: string[];
  status: 'accepted';
  requestId: string;
}

export interface ChatConversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageSender: string;
  updatedAt?: unknown;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  text: string;
  createdAt?: unknown;
  reactions?: Record<string, string>;
}

export interface MessageReaction {
  id: string;
  uid: string;
  emoji: string;
}

export interface CourseGrade {
  subjectId: string;
  currentGrade: number;
  gradedWeight: number;
  targetGrade: number;
  updatedAt: string;
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
