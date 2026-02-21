import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted ensures these variables are available inside the vi.mock factory below,
// which is hoisted above all imports by Vitest.
const { mockChain, setMockResult } = vi.hoisted(() => {
  let currentResult: { data: unknown; error: unknown } = { data: null, error: null };

  // Build a chainable mock that resolves to currentResult when awaited.
  // All query-builder methods return the chain itself; single() and direct
  // awaits both resolve to the current mocked result.
  const chain: Record<string, unknown> = {};
  const chainMethods = [
    'from',
    'select',
    'insert',
    'update',
    'eq',
    'in',
    'or',
    'is',
    'not',
    'gte',
    'order',
    'limit',
  ];
  for (const m of chainMethods) {
    (chain as Record<string, unknown>)[m] = vi.fn(() => chain);
  }

  // .single() is used by insertTask / updateTask etc.
  chain.single = vi.fn(() => Promise.resolve(currentResult));

  // Make the chain directly awaitable (for queries that don't call .single()).
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(currentResult).then(resolve, reject);

  return {
    mockChain: chain,
    setMockResult: (result: { data: unknown; error: unknown }) => {
      currentResult = result;
    },
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockChain,
}));

import { findRecentUnrespondedNudge, getActiveTasks, insertTask } from './supabase';
import type { Task, Nudge } from './types';

const userId = '00000000-0000-0000-0000-000000000001';

const fakeTask: Task = {
  id: 'task-1',
  user_id: userId,
  raw_input: 'Buy milk',
  title: 'Buy milk',
  urgency: 3,
  importance: 3,
  energy_level: 'low',
  can_be_split: false,
  tags: [],
  status: 'pending',
  ai_conversation: [],
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
};

const fakeNudge: Nudge = {
  id: 'nudge-1',
  user_id: userId,
  task_id: 'task-1',
  channel: 'telegram',
  message_text: 'Time to work on Buy milk',
  status: 'sent',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  // Re-wire chain methods after clearAllMocks resets call history
  // (implementations are preserved, but we reset result to a safe default)
  setMockResult({ data: null, error: null });
});

describe('getActiveTasks', () => {
  it('returns tasks on success', async () => {
    setMockResult({ data: [fakeTask], error: null });
    const tasks = await getActiveTasks(userId);
    expect(tasks).toEqual([fakeTask]);
  });

  it('throws when Supabase returns an error', async () => {
    setMockResult({ data: null, error: { message: 'DB error', code: '500' } });
    await expect(getActiveTasks(userId)).rejects.toMatchObject({ message: 'DB error' });
  });
});

describe('insertTask', () => {
  it('returns the inserted task on success', async () => {
    setMockResult({ data: fakeTask, error: null });
    const result = await insertTask({ title: 'Buy milk', user_id: userId });
    expect(result).toEqual(fakeTask);
  });

  it('throws when Supabase returns an error', async () => {
    setMockResult({ data: null, error: { message: 'Insert failed', code: '500' } });
    await expect(insertTask({ title: 'Buy milk', user_id: userId })).rejects.toMatchObject({
      message: 'Insert failed',
    });
  });
});

describe('findRecentUnrespondedNudge', () => {
  it('returns null when there are no unresponded nudges', async () => {
    setMockResult({ data: [], error: null });
    const result = await findRecentUnrespondedNudge(userId);
    expect(result).toBeNull();
  });

  it('returns null when data is null', async () => {
    setMockResult({ data: null, error: null });
    const result = await findRecentUnrespondedNudge(userId);
    expect(result).toBeNull();
  });

  it('returns the first nudge when one exists', async () => {
    setMockResult({ data: [fakeNudge], error: null });
    const result = await findRecentUnrespondedNudge(userId);
    expect(result).toEqual(fakeNudge);
  });

  it('throws when Supabase returns an error', async () => {
    setMockResult({ data: null, error: { message: 'Query failed', code: '500' } });
    await expect(findRecentUnrespondedNudge(userId)).rejects.toMatchObject({
      message: 'Query failed',
    });
  });
});
