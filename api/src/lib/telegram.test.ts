import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage, sendNudge } from './telegram';

// Mock global fetch so no real HTTP calls are made.
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockTelegramSuccess(result: unknown) {
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ ok: true, result }),
  });
}

function mockTelegramError(description: string) {
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ ok: false, description }),
  });
}

describe('sendMessage', () => {
  it('returns the result from Telegram on success', async () => {
    mockTelegramSuccess({ message_id: 42 });
    const result = await sendMessage('chat-123', 'Hello');
    expect(result).toEqual({ message_id: 42 });
  });

  it('calls the correct Telegram endpoint', async () => {
    mockTelegramSuccess({ message_id: 1 });
    await sendMessage('chat-123', 'Hello');
    const [url] = mockFetch.mock.calls[0] as [string, unknown];
    expect(url).toContain('/sendMessage');
    expect(url).toContain('123456:test-bot-token');
  });

  it('uses Markdown parse mode by default', async () => {
    mockTelegramSuccess({ message_id: 1 });
    await sendMessage('chat-123', 'Hello');
    const [, options] = mockFetch.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(options.body);
    expect(body.parse_mode).toBe('Markdown');
  });

  it('throws when Telegram returns ok: false', async () => {
    mockTelegramError('Bot was blocked by the user');
    await expect(sendMessage('chat-123', 'Hello')).rejects.toThrow('Bot was blocked by the user');
  });
});

describe('sendNudge', () => {
  it('returns the message_id as a string', async () => {
    mockTelegramSuccess({ message_id: 99 });
    const result = await sendNudge('chat-123', 'nudge-abc', 'Time to work!');
    expect(result).toBe('99');
  });

  it('includes the nudge ID in the callback_data for each button', async () => {
    mockTelegramSuccess({ message_id: 1 });
    await sendNudge('chat-123', 'nudge-abc', 'Time to work!');
    const [, options] = mockFetch.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(options.body);
    const allButtons = body.reply_markup.inline_keyboard.flat() as Array<{
      callback_data: string;
    }>;
    expect(allButtons.every((b) => b.callback_data.includes('nudge-abc'))).toBe(true);
  });

  it('keyboard has the three expected actions', async () => {
    mockTelegramSuccess({ message_id: 1 });
    await sendNudge('chat-123', 'nudge-abc', 'Time to work!');
    const [, options] = mockFetch.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(options.body);
    const allButtons = body.reply_markup.inline_keyboard.flat() as Array<{ text: string }>;
    const texts = allButtons.map((b) => b.text);
    expect(texts).toContain('On it!');
    expect(texts).toContain('Snooze 1h');
    expect(texts).toContain('Busy today');
  });
});
