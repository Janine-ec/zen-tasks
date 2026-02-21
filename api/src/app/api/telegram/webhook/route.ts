import { NextRequest, NextResponse } from 'next/server';
import { updateNudge, updateUser, findRecentUnrespondedNudge } from '@/lib/supabase';
import { askClaudeJson } from '@/lib/anthropic';
import { sendMessage, answerCallbackQuery } from '@/lib/telegram';
import { SENTIMENT_ANALYSIS_PROMPT } from '@/lib/prompts';
import type { SentimentAnalysisResponse } from '@/lib/types';

/**
 * POST /api/telegram/webhook
 * Replaces n8n workflow 06 - Telegram Response Handler
 *
 * Handles Telegram updates: button callbacks and text message replies
 */
export async function POST(request: NextRequest) {
  try {
    const update = await request.json();

    // Route 1: Callback query (button press)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return NextResponse.json({ ok: true });
    }

    // Route 2: Text message (free-text reply)
    if (update.message && update.message.text) {
      await handleTextMessage(update.message);
      return NextResponse.json({ ok: true });
    }

    // Ignore other update types
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in telegram webhook:', error);
    // Always return 200 to Telegram to acknowledge receipt
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

/**
 * Handle button callback (e.g., "On it!", "Snooze 1h", "Busy today")
 */
async function handleCallbackQuery(callbackQuery: any) {
  const data = callbackQuery.data; // e.g., "on_it:nudge_id", "snooze_1h:nudge_id"
  const chatId = String(callbackQuery.message.chat.id);
  const callbackId = callbackQuery.id;

  // Parse callback_data
  const colonIndex = data.indexOf(':');
  if (colonIndex === -1) {
    console.error('Invalid callback_data format:', data);
    return;
  }

  const action = data.substring(0, colonIndex);
  const nudgeId = data.substring(colonIndex + 1);

  let sentiment: string;
  let status: string;
  let pauseUntil: string | null = null;
  let ackMessage: string;

  switch (action) {
    case 'on_it':
      sentiment = 'positive';
      status = 'accepted';
      ackMessage = "Awesome, you've got this! 💪";
      break;

    case 'snooze_1h':
      sentiment = 'neutral';
      status = 'dismissed';
      ackMessage = "No worries, I'll check back in an hour ⏰";
      break;

    case 'busy_today':
      sentiment = 'busy';
      status = 'dismissed';
      // Pause until 9pm today (or tomorrow if already past 9pm)
      const today9pm = new Date();
      today9pm.setHours(21, 0, 0, 0);
      if (today9pm <= new Date()) {
        today9pm.setDate(today9pm.getDate() + 1);
      }
      pauseUntil = today9pm.toISOString();
      ackMessage = "Got it! I'll leave you alone for the rest of today 😌";
      break;

    default:
      console.warn('Unknown callback action:', action);
      return;
  }

  // Update nudge record
  await updateNudge(nudgeId, {
    status: status as any,
    responded_at: new Date().toISOString(),
    ai_sentiment: sentiment,
  });

  // If pause needed, update user
  if (pauseUntil) {
    // Find user by chat_id (need to query users table)
    // Note: We're updating by telegram_chat_id since we have that from callback
    const { supabase } = await import('@/lib/supabase');
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_chat_id', chatId)
      .limit(1);

    if (users && users.length > 0) {
      await updateUser(users[0].id, { nudge_paused_until: pauseUntil });
    }
  }

  // Answer callback query
  await answerCallbackQuery(callbackId);

  // Send acknowledgment message
  await sendMessage(chatId, ackMessage);
}

/**
 * Handle free-text message reply
 */
async function handleTextMessage(message: any) {
  const chatId = String(message.chat.id);
  const text = message.text || '';
  const _replyToMsgId = message.reply_to_message?.message_id
    ? String(message.reply_to_message.message_id)
    : null;

  // Find the most recent unresponded nudge for this user
  // We need to find user_id from telegram_chat_id first
  const { supabase } = await import('@/lib/supabase');
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .limit(1);

  if (!users || users.length === 0) {
    console.log('No user found for chat_id:', chatId);
    return;
  }

  const userId = users[0].id;

  // Find recent unresponded nudge
  const nudge = await findRecentUnrespondedNudge(userId);

  if (!nudge) {
    console.log('No unresponded nudge found for user:', userId);
    return; // Ignore message
  }

  // Call Claude for sentiment analysis
  const systemPrompt = SENTIMENT_ANALYSIS_PROMPT(text);
  const aiResult = await askClaudeJson<SentimentAnalysisResponse>(systemPrompt, text, {
    maxTokens: 512,
  });

  // Update nudge with response
  await updateNudge(nudge.id, {
    responded_at: new Date().toISOString(),
    response_text: text,
    ai_sentiment: aiResult.sentiment,
  });

  // If pause suggested, update user
  if (aiResult.pause_hours > 0) {
    const pauseUntil = new Date(Date.now() + aiResult.pause_hours * 3600000).toISOString();
    await updateUser(userId, { nudge_paused_until: pauseUntil });
  }

  // Send acknowledgment
  await sendMessage(chatId, aiResult.brief_ack);
}
