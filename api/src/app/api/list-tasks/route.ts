import { NextRequest, NextResponse } from 'next/server';
import { getActiveTasks } from '@/lib/supabase';
import type { ListTasksRequest, TaskStatus } from '@/lib/types';

/**
 * POST /api/list-tasks
 * Replaces n8n workflow 02b - List Tasks
 *
 * Returns a flat array of tasks filtered by user_id and status
 */
export async function POST(request: NextRequest) {
  try {
    const body: ListTasksRequest = await request.json();
    const { user_id, status } = body;

    if (!user_id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, status' },
        { status: 400 }
      );
    }

    // Fetch tasks from Supabase
    const tasks = await getActiveTasks(user_id, [status as TaskStatus]);

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error in list-tasks route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
