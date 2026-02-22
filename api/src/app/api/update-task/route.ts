import { NextRequest, NextResponse } from 'next/server';
import { updateTask } from '@/lib/supabase';
import type { Task } from '@/lib/types';

interface UpdateTaskRequest {
  task_id: string;
  fields: Partial<Task>;
}

/**
 * POST /api/update-task
 * Directly updates one or more fields on a task.
 * Used by the task detail screen for inline editing and status changes.
 * v2
 */
export async function POST(request: NextRequest) {
  try {
    const body: UpdateTaskRequest = await request.json();
    const { task_id, fields } = body;

    if (!task_id || !fields) {
      return NextResponse.json(
        { error: 'Missing required fields: task_id, fields' },
        { status: 400 }
      );
    }

    const task = await updateTask(task_id, fields);

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error in update-task route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
