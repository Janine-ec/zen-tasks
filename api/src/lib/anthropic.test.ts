import { describe, expect, it } from 'vitest';
import { parseJsonResponse } from './anthropic';

// parseJsonResponse is pure logic with no external dependencies — ideal for unit tests.
// askClaude / askClaudeJson make real API calls and are tested via integration tests.

describe('parseJsonResponse', () => {
  it('parses a plain JSON object', () => {
    expect(parseJsonResponse('{"action":"create","done":true}')).toEqual({
      action: 'create',
      done: true,
    });
  });

  it('parses a plain JSON array', () => {
    expect(parseJsonResponse('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('strips ```json ... ``` fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(parseJsonResponse(input)).toEqual({ key: 'value' });
  });

  it('strips ``` ... ``` fences without language tag', () => {
    const input = '```\n{"key": "value"}\n```';
    expect(parseJsonResponse(input)).toEqual({ key: 'value' });
  });

  it('handles leading and trailing whitespace', () => {
    expect(parseJsonResponse('  {"key": "value"}  ')).toEqual({ key: 'value' });
  });

  it('preserves nested objects', () => {
    const input = '{"task": {"title": "Buy milk", "urgency": 3}}';
    expect(parseJsonResponse(input)).toEqual({ task: { title: 'Buy milk', urgency: 3 } });
  });

  it('parses arrays inside fences', () => {
    const input = '```json\n[{"id": 1}, {"id": 2}]\n```';
    expect(parseJsonResponse(input)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseJsonResponse('not json at all')).toThrow('Failed to parse JSON');
  });

  it('throws on malformed JSON inside fences', () => {
    expect(() => parseJsonResponse('```json\n{bad json}\n```')).toThrow('Failed to parse JSON');
  });
});
