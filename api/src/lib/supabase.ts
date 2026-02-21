import { createClient } from '@supabase/supabase-js';
import type { Task, User, Nudge, TaskStatus } from './types';

// Initialize Supabase client with service role key (server-side only)
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Get active tasks for a user, ordered by priority
 * Excludes snoozed tasks (snoozed_until > now)
 */
export async function getActiveTasks(
  userId: string,
  statuses: TaskStatus[] = ['pending', 'in_progress']
): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .in('status', statuses)
    .or('snoozed_until.is.null,snoozed_until.lt.' + new Date().toISOString())
    .order('urgency', { ascending: false })
    .order('importance', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching active tasks:', error);
    throw error;
  }

  return data as Task[];
}

/**
 * Insert a new task
 */
export async function insertTask(task: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase.from('tasks').insert(task).select().single();

  if (error) {
    console.error('Error inserting task:', error);
    throw error;
  }

  return data as Task;
}

/**
 * Update an existing task
 */
export async function updateTask(id: string, fields: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating task:', error);
    throw error;
  }

  return data as Task;
}

/**
 * Insert a new nudge
 */
export async function insertNudge(nudge: Partial<Nudge>): Promise<Nudge> {
  const { data, error } = await supabase.from('nudges').insert(nudge).select().single();

  if (error) {
    console.error('Error inserting nudge:', error);
    throw error;
  }

  return data as Nudge;
}

/**
 * Update an existing nudge
 */
export async function updateNudge(id: string, fields: Partial<Nudge>): Promise<Nudge> {
  const { data, error } = await supabase
    .from('nudges')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating nudge:', error);
    throw error;
  }

  return data as Nudge;
}

/**
 * Update a user
 */
export async function updateUser(id: string, fields: Partial<User>): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating user:', error);
    throw error;
  }

  return data as User;
}

/**
 * Get all nudges created today for a user
 */
export async function getTodaysNudges(userId: string): Promise<Nudge[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('nudges')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching todays nudges:', error);
    throw error;
  }

  return data as Nudge[];
}

/**
 * Get all users with telegram_chat_id set (for cron job)
 */
export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .not('telegram_chat_id', 'is', null);

  if (error) {
    console.error('Error fetching users:', error);
    throw error;
  }

  return data as User[];
}

/**
 * Find the most recent unresponded nudge for a user
 * Used by telegram webhook to match text replies to nudges
 */
export async function findRecentUnrespondedNudge(userId?: string): Promise<Nudge | null> {
  let query = supabase
    .from('nudges')
    .select('*')
    .eq('status', 'sent')
    .is('responded_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error finding recent unresponded nudge:', error);
    throw error;
  }

  return data && data.length > 0 ? (data[0] as Nudge) : null;
}
