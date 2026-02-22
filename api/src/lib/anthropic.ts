import Anthropic from '@anthropic-ai/sdk';

// Initialize Claude client
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

if (!anthropicApiKey) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

export const anthropic = new Anthropic({
  apiKey: anthropicApiKey,
});

interface AskClaudeOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Call Claude with a system prompt and user message
 * Returns the text content of Claude's response
 */
export async function askClaude(
  systemPrompt: string,
  userMessage: string,
  options: AskClaudeOptions = {}
): Promise<string> {
  const { maxTokens = 1024, temperature = 1.0 } = options;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    // Extract text from response
    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('\n');

    return textContent;
  } catch (error) {
    console.error('Error calling Claude:', error);
    throw error;
  }
}

/**
 * Parse JSON response from Claude, stripping markdown code fences if present
 */
export function parseJsonResponse<T = any>(text: string): T {
  // Remove markdown code fences if present
  let cleaned = text.trim();

  // Strip ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error('Error parsing JSON response:', text);
    throw new Error(`Failed to parse JSON: ${error}`);
  }
}

/**
 * Convenience function: ask Claude and parse JSON response
 */
export async function askClaudeJson<T = any>(
  systemPrompt: string,
  userMessage: string,
  options?: AskClaudeOptions
): Promise<T> {
  const response = await askClaude(systemPrompt, userMessage, options);
  return parseJsonResponse<T>(response);
}
