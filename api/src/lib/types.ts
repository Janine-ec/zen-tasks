// Database enums
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type NudgeChannel = 'telegram' | 'in_app' | 'email';
export type NudgeStatus = 'sent' | 'accepted' | 'dismissed' | 'expired';

// Database tables
export interface User {
  id: string;
  display_name: string;
  email?: string;
  telegram_chat_id?: string;
  timezone: string;
  nudge_paused_until?: string; // ISO timestamp
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  raw_input: string;
  title: string;
  description?: string;
  urgency: number; // 1-5
  importance: number; // 1-5
  due_date?: string; // ISO timestamp
  estimated_minutes?: number;
  energy_level: EnergyLevel;
  can_be_split: boolean;
  recurrence?: string;
  location?: string;
  depends_on?: string; // task ID
  tags: string[];
  status: TaskStatus;
  snoozed_until?: string; // ISO timestamp
  follow_up_at?: string; // ISO timestamp
  ai_conversation: any[]; // JSONB array
  created_at: string;
  updated_at: string;
}

export interface Nudge {
  id: string;
  user_id: string;
  task_id: string;
  channel: NudgeChannel;
  message_text: string;
  calendar_slot?: CalendarSlot;
  status: NudgeStatus;
  responded_at?: string; // ISO timestamp
  response_text?: string;
  ai_sentiment?: string; // positive/neutral/busy/dismissive
  telegram_msg_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  nudge_id?: string;
  title: string;
  body?: string;
  read: boolean;
  created_at: string;
  updated_at: string;
}

// Business logic types
export interface CalendarSlot {
  start: string; // ISO timestamp
  end: string; // ISO timestamp
  duration_minutes?: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string; // ISO timestamp
  end: string; // ISO timestamp
  location?: string;
}

export interface TimeContext {
  currentTime: string; // ISO timestamp
  timeOfDay: 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string; // Monday, Tuesday, etc.
  isWeekend: boolean;
  isBusinessHours: boolean;
}

export interface NudgeContext {
  todaysNudgeCount: number;
  unansweredCount: number;
  lastNudgeMinutesAgo?: number;
  lastSentiment?: string;
  canSendMore: boolean;
  reason?: string;
}

// AI response types (task-agent actions)
export type TaskAgentAction =
  | 'create'
  | 'complete'
  | 'start'
  | 'delete'
  | 'snooze'
  | 'suggest'
  | 'clarify';

export interface TaskAgentResponse {
  action: TaskAgentAction;
  reply?: string;
  replies?: string[];
  done: boolean;
  confidence?: number;
  tasks?: Partial<Task>[]; // For 'create' action
  task_id?: string; // For complete/start/delete/snooze actions
  snoozed_until?: string; // For 'snooze' action
  follow_up_minutes?: number; // For 'start' action
}

// AI response types (nudge matching)
export interface NudgeMatchResponse {
  task_id: string | null;
  slot: CalendarSlot | null;
  message: string | null;
  reason?: string;
}

// AI response types (sentiment analysis)
export interface SentimentAnalysisResponse {
  sentiment: 'positive' | 'neutral' | 'busy' | 'dismissive';
  pause_hours?: number;
  brief_ack: string;
}

// API request/response types
export interface ListTasksRequest {
  user_id: string;
  status: TaskStatus;
}

export interface TaskAgentRequest {
  user_id: string;
  message: string;
  history?: any[];
  mode?: 'chat' | 'quick';
}

export interface TaskAgentApiResponse {
  replies: string[];
  done: boolean;
}

export interface CronNudgeResponse {
  nudges_sent: number;
  users_processed: number;
  errors?: string[];
}
