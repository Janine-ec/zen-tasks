import { NextRequest, NextResponse } from 'next/server';
import {
  getUsers,
  getActiveTasks,
  getTodaysNudges,
  insertNudge,
  updateNudge,
} from '@/lib/supabase';
import { askClaudeJson } from '@/lib/anthropic';
import { getFreeBusy, findFreeSlots } from '@/lib/google-calendar';
import { sendNudge } from '@/lib/telegram';
import { NUDGE_MATCH_PROMPT } from '@/lib/prompts';
import type { NudgeContext, NudgeMatchResponse, CronNudgeResponse } from '@/lib/types';

/**
 * GET /api/cron/nudge
 * Replaces n8n workflows 03 (Nudge Cron) + 04 (Send Notification)
 *
 * Cron job that evaluates users and sends smart task nudges via Telegram
 */
export async function GET(request: NextRequest) {
  // Optional: Verify cron secret for security
  const cronSecret = request.headers.get('authorization');
  if (process.env.CRON_SECRET && cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let nudgesSent = 0;
  let usersProcessed = 0;
  const errors: string[] = [];

  try {
    // Fetch all users with Telegram configured
    const users = await getUsers();

    // Process each user sequentially
    for (const user of users) {
      usersProcessed++;

      try {
        // Check if user's nudges are paused
        if (user.nudge_paused_until) {
          const pausedUntil = new Date(user.nudge_paused_until);
          if (pausedUntil > new Date()) {
            console.log(`User ${user.id} nudges paused until ${pausedUntil}`);
            continue; // Skip this user
          }
        }

        // Get today's nudges for this user
        const todaysNudges = await getTodaysNudges(user.id);

        // Evaluate nudge history
        const unanswered = todaysNudges.filter((n) => n.status === 'sent' && !n.responded_at);
        const unansweredCount = unanswered.length;

        // Max 2 unanswered nudges per day
        if (unansweredCount >= 2) {
          console.log(`User ${user.id}: too many unanswered nudges`);
          continue;
        }

        // If 1 unanswered, require 60-minute gap since last nudge
        if (unansweredCount === 1 && todaysNudges.length > 0) {
          const lastNudgeTime = new Date(todaysNudges[0].created_at);
          const minutesSince = (Date.now() - lastNudgeTime.getTime()) / 60000;
          if (minutesSince < 60) {
            console.log(`User ${user.id}: too soon after last nudge`);
            continue;
          }
        }

        // If recent nudge had 'busy' sentiment, skip
        if (todaysNudges.length > 0 && todaysNudges[0].ai_sentiment === 'busy') {
          console.log(`User ${user.id}: last sentiment was busy`);
          continue;
        }

        // Build nudge context for AI
        const nudgeContext: NudgeContext = {
          todaysNudgeCount: todaysNudges.length,
          unansweredCount,
          lastNudgeMinutesAgo:
            todaysNudges.length > 0
              ? (Date.now() - new Date(todaysNudges[0].created_at).getTime()) / 60000
              : undefined,
          lastSentiment: todaysNudges[0]?.ai_sentiment,
          canSendMore: true,
        };

        // Get free slots in the next 2 hours
        const busyPeriods = await getFreeBusy(2);
        const windowEnd = new Date(Date.now() + 2 * 60 * 60 * 1000);
        const freeSlots = findFreeSlots(busyPeriods, windowEnd, 15);

        if (freeSlots.length === 0) {
          console.log(`User ${user.id}: no free slots`);
          continue;
        }

        // Fetch active tasks (excluding snoozed)
        const activeTasks = await getActiveTasks(user.id);

        if (activeTasks.length === 0) {
          console.log(`User ${user.id}: no active tasks`);
          continue;
        }

        // AI match: find best task for nearest free slot
        const systemPrompt = NUDGE_MATCH_PROMPT(freeSlots, activeTasks, nudgeContext);

        const aiMatch = await askClaudeJson<NudgeMatchResponse>(
          systemPrompt,
          'Match a task to a free slot',
          { maxTokens: 1024 }
        );

        if (!aiMatch.task_id || !aiMatch.message) {
          console.log(`User ${user.id}: AI couldn't match a task`);
          continue;
        }

        // Insert nudge record
        const nudge = await insertNudge({
          user_id: user.id,
          task_id: aiMatch.task_id,
          channel: 'telegram',
          message_text: aiMatch.message,
          calendar_slot: aiMatch.slot ?? undefined,
          status: 'sent',
        });

        // Send Telegram message
        const telegramMsgId = await sendNudge(user.telegram_chat_id!, nudge.id, aiMatch.message);

        // Store Telegram message ID for reply matching
        await updateNudge(nudge.id, { telegram_msg_id: telegramMsgId });

        nudgesSent++;
        console.log(`Sent nudge to user ${user.id}: ${aiMatch.message}`);
      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
        errors.push(`User ${user.id}: ${userError}`);
      }
    }

    const response: CronNudgeResponse = {
      nudges_sent: nudgesSent,
      users_processed: usersProcessed,
      errors: errors.length > 0 ? errors : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in cron/nudge route:', error);
    return NextResponse.json(
      { error: 'Internal server error', nudges_sent: nudgesSent, users_processed: usersProcessed },
      { status: 500 }
    );
  }
}
