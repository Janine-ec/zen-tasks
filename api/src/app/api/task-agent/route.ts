import { NextRequest, NextResponse } from 'next/server';
import { getActiveTasks, insertTask, updateTask } from '@/lib/supabase';
import { askClaudeJson } from '@/lib/anthropic';
import { getUpcomingEvents } from '@/lib/google-calendar';
import { getTimeContext } from '@/lib/time-context';
import { TASK_AGENT_PROMPT } from '@/lib/prompts';
import type { TaskAgentRequest, TaskAgentResponse, TaskAgentApiResponse, Task } from '@/lib/types';

/**
 * POST /api/task-agent
 * Replaces n8n workflow 05 - Task Agent (Unified)
 *
 * AI-powered task management chat agent with calendar integration
 */
export async function POST(request: NextRequest) {
  try {
    const body: TaskAgentRequest = await request.json();
    const { user_id, message, history = [], mode = 'chat' } = body;

    if (!user_id || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, message' },
        { status: 400 }
      );
    }

    // 1. Fetch active tasks
    const activeTasks = await getActiveTasks(user_id);

    // 2. Fetch calendar events (gracefully degrade on failure)
    let calendarEvents;
    try {
      calendarEvents = await getUpcomingEvents(60);
    } catch (error) {
      console.error('Calendar fetch failed, continuing without:', error);
      calendarEvents = [];
    }

    // 3. Build time context
    const timeContext = getTimeContext();

    // 4. Build the AI prompt
    const systemPrompt = TASK_AGENT_PROMPT(
      mode,
      history,
      message,
      activeTasks,
      calendarEvents,
      timeContext
    );

    // 5. Call Claude AI
    const aiResponse = await askClaudeJson<TaskAgentResponse>(systemPrompt, message, {
      maxTokens: 4096,
    });

    // 6. Route based on action and perform database operations
    const { action } = aiResponse;
    let done = false;

    switch (action) {
      case 'create':
        // Insert new task(s) into Supabase
        if (aiResponse.tasks && aiResponse.tasks.length > 0) {
          for (const taskData of aiResponse.tasks) {
            await insertTask({
              user_id,
              raw_input: message,
              title: taskData.title || message,
              description: taskData.description || null,
              urgency: Math.max(1, Math.min(5, taskData.urgency || 3)),
              importance: Math.max(1, Math.min(5, taskData.importance || 3)),
              estimated_minutes: taskData.estimated_minutes || null,
              due_date: taskData.due_date || null,
              location: taskData.location || null,
              tags: taskData.tags || [],
              energy_level: taskData.energy_level || 'medium',
              can_be_split: taskData.can_be_split || false,
              recurrence: taskData.recurrence || null,
              status: 'pending',
              ai_conversation: history,
            } as Partial<Task>);
          }
        }
        done = true;
        break;

      case 'complete':
        // Mark task as completed
        if (aiResponse.task_id) {
          await updateTask(aiResponse.task_id, { status: 'completed' });
        }
        done = true;
        break;

      case 'start':
        // Mark task as in_progress and set follow-up time
        if (aiResponse.task_id) {
          const followUpMinutes = aiResponse.follow_up_minutes || 30;
          const followUpAt = new Date(Date.now() + followUpMinutes * 60 * 1000).toISOString();

          await updateTask(aiResponse.task_id, {
            status: 'in_progress',
            follow_up_at: followUpAt,
          });
        }
        done = true;
        break;

      case 'delete':
        // Mark task as deleted
        if (aiResponse.task_id) {
          await updateTask(aiResponse.task_id, { status: 'deleted' });
        }
        done = true;
        break;

      case 'snooze':
        // Set snoozed_until timestamp
        if (aiResponse.task_id && aiResponse.snoozed_until) {
          await updateTask(aiResponse.task_id, {
            snoozed_until: aiResponse.snoozed_until,
          });
        }
        done = true;
        break;

      case 'suggest':
      case 'clarify':
        // No database action needed
        done = false;
        break;

      default:
        console.warn('Unknown action:', action);
        done = false;
    }

    // 7. Return response
    const response: TaskAgentApiResponse = {
      replies: aiResponse.replies || [],
      done,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in task-agent route:', error);
    return NextResponse.json(
      {
        replies: ["I'm having trouble processing that right now. Could you try again?"],
        done: false,
      },
      { status: 500 }
    );
  }
}
