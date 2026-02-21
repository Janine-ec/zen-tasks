// Set required environment variables before any module is imported.
// This prevents module-level env checks in lib/ from throwing during tests.
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.TELEGRAM_BOT_TOKEN = '123456:test-bot-token';
