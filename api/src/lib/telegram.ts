const TELEGRAM_API_BASE = 'https://api.telegram.org';

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  throw new Error('Missing TELEGRAM_BOT_TOKEN environment variable');
}

interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

interface SendMessageOptions {
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: {
    inline_keyboard: InlineKeyboardButton[][];
  };
}

/**
 * Send a message to a Telegram chat
 */
export async function sendMessage(
  chatId: string | number,
  text: string,
  options?: SendMessageOptions
): Promise<any> {
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;

  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: options?.parse_mode || 'Markdown',
  };

  if (options?.reply_markup) {
    body.reply_markup = options.reply_markup;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram sendMessage error:', data);
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return data.result;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw error;
  }
}

/**
 * Answer a callback query (button press)
 */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/answerCallbackQuery`;

  const body: any = {
    callback_query_id: callbackQueryId,
  };

  if (text) {
    body.text = text;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram answerCallbackQuery error:', data);
      throw new Error(`Telegram API error: ${data.description}`);
    }
  } catch (error) {
    console.error('Error answering callback query:', error);
    throw error;
  }
}

/**
 * Send a nudge message with action buttons
 * Returns the message_id for tracking replies
 */
export async function sendNudge(
  chatId: string | number,
  nudgeId: string,
  messageText: string
): Promise<string> {
  const keyboard = {
    inline_keyboard: [
      [
        { text: 'On it!', callback_data: `on_it:${nudgeId}` },
        { text: 'Snooze 1h', callback_data: `snooze_1h:${nudgeId}` },
      ],
      [{ text: 'Busy today', callback_data: `busy_today:${nudgeId}` }],
    ],
  };

  const result = await sendMessage(chatId, messageText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });

  return result.message_id.toString();
}
