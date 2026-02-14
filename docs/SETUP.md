# Task Management App - Setup Guide

A zen task manager where you talk to an AI assistant to add and clear tasks. The AI handles all the complexity — you never have to stare at a long task list.

## Prerequisites

- A [Supabase](https://supabase.com) account (free tier works)
- [n8n](https://n8n.io) running locally or cloud (`npx n8n` or Docker)
- A Telegram account (for nudges)
- A Google account (for calendar integration)
- Node.js installed (only needed for `npx serve` to host the frontend)

---

## 1. Supabase Setup

1. Create a new project at [app.supabase.com](https://app.supabase.com)
2. Go to **SQL Editor** and run the contents of `database/schema.sql`
3. Then run `database/seed.sql` (creates a default user)
4. Note your project credentials (Settings > API):
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **service_role key** (the secret one, not `anon`)

---

## 2. Telegram Bot Setup

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`, follow the prompts, and save your **Bot Token**
3. Start a conversation with your new bot (send it any message)
4. Get your **Chat ID** by visiting:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
   Look for `"chat":{"id": 123456789}` in the response
5. Update the default user in Supabase:
   ```sql
   UPDATE users
   SET telegram_chat_id = 'YOUR_CHAT_ID'
   WHERE id = '00000000-0000-0000-0000-000000000001';
   ```

---

## 3. n8n Setup

### Start n8n

```bash
npx n8n
```

This starts n8n at `http://localhost:5678`.

### Add Credentials

Go to **Settings > Credentials** and create:

1. **Supabase** credential:
   - Host: your Supabase project URL
   - Service Role Key: your service_role key

2. **Telegram** credential:
   - Bot Token: from BotFather

3. **Google Calendar OAuth2** credential:
   - Follow n8n's [Google Calendar setup guide](https://docs.n8n.io/integrations/builtin/credentials/google/)
   - You need a Google Cloud project with Calendar API enabled

### Import Workflows

Import each workflow JSON file from `n8n-workflows/`:

1. **04-send-notification.json** (import first — other workflows reference it)
2. **01-add-task.json** — conversational task creation
3. **02-clear-task.json** — conversational task completion/deletion/suggestion
4. **02b-list-tasks.json** — simple task listing for the hamburger menu
5. **03-nudge-cron.json** — periodic smart nudges via Telegram

For each workflow:
1. Go to **Workflows > Import from File**
2. Select the JSON file
3. Open the workflow and update credential references:
   - Click each Supabase node > select your Supabase credential
   - Click the Telegram node (in workflow 04) > select your Telegram credential
   - Click the Google Calendar node (in workflow 03) > select your Google Calendar credential
4. In workflow **03**, open the "Send Notification" node and select workflow **04** as the sub-workflow

### Configure AI Agent Nodes

Workflows 01, 02, and 03 use AI Agent nodes. You need to connect an LLM:

1. Open each workflow with an "AI Agent" node
2. Click the AI Agent node
3. Under "Model", add your preferred LLM credential:
   - **OpenAI** (GPT-4, GPT-4o, etc.)
   - **Anthropic** (Claude)
   - **Or any other** supported by n8n
4. The prompts are model-agnostic — any capable LLM will work

### Configure Switch Nodes

**Workflow 02 - Clear Task** has a Switch node that routes by action:

1. Open workflow **02 - Clear Task**
2. Click the **Switch Action** node
3. Add 6 output rules matching the action field:
   - Output 0: `complete`
   - Output 1: `start`
   - Output 2: `delete`
   - Output 3: `snooze`
   - Output 4: `clarify`
   - Output 5: `suggest`

### Activate Workflows

Toggle each workflow **Active** (top-right switch). The webhook workflows (01, 02, 02b) need to be active to receive requests from the frontend.

---

## 4. Frontend Setup

### Update Config

Edit `frontend/js/config.js`:

```js
const CONFIG = {
  // If n8n is running locally:
  N8N_BASE_URL: 'http://localhost:5678/webhook',

  // If using n8n cloud:
  // N8N_BASE_URL: 'https://your-instance.app.n8n.cloud/webhook',

  ENDPOINTS: {
    ADD_TASK:    '/add-task',
    CLEAR_TASK:  '/clear-task',
    LIST_TASKS:  '/list-tasks',
  },

  USER_ID: '00000000-0000-0000-0000-000000000001',
};
```

### Serve the Frontend

```bash
npx serve frontend/
```

Open `http://localhost:3000` in your browser.

---

## 5. How It Works

### Home Screen
Two buttons: **Add a task** and **Clear a task**. A hamburger menu in the corner opens the full task list (but you shouldn't need it often).

### Adding a Task
Tap "Add a task" to open a chat. Type or voice-message your tasks. The AI will:
- Parse the task details (title, urgency, importance, duration, location, etc.)
- Ask clarifying questions if needed ("How urgent is this?" / "When is this due?")
- Confirm when the task is saved

You can mention multiple tasks at once.

### Clearing a Task
Tap "Clear a task" to open a chat. You can:
- **Complete a task**: "I finished the grocery shopping"
- **Start a task**: "I'm about to do the laundry" (AI will follow up to check)
- **Snooze a task**: "Snooze the laundry for a day" (hides it from top tasks and nudges until then)
- **Delete a task**: "Delete the dentist appointment, I cancelled it"
- **Get a suggestion**: "What should I do now?" (AI picks the best task based on urgency, importance, due dates, and available time)

### Nudges
Every 30 minutes (8am-9pm), the cron workflow checks your Google Calendar for free time, looks at your active tasks, and sends a smart suggestion via Telegram.

### Task List
Tap the hamburger menu to see all active or completed tasks. This is read-only — all actions go through the chat.

---

## 6. Troubleshooting

### "Something went wrong" in chat
- Check that n8n is running and webhooks are active
- Verify the URL in `config.js` matches your n8n instance
- Check the browser console (F12) for CORS errors
- Check n8n execution logs for workflow errors

### AI responses aren't parsing correctly
- Check n8n execution logs — look at the AI Agent node output
- The AI may not be returning valid JSON; check the prompt
- Fallback handling is built in — the raw AI text will show as a chat message

### Voice button doesn't work
- Web Speech API requires HTTPS or localhost
- Chrome has the best support; Firefox/Safari may not work
- Check browser permissions for microphone access

### No Telegram messages
- Verify bot token and chat ID are correct
- Make sure you started a conversation with the bot first
- Check n8n execution logs for workflows 03 and 04
- Ensure Google Calendar credential is connected

### CORS Issues
- Webhook nodes are configured with `allowedOrigins: "*"`
- If still having issues, set the n8n environment variable: `N8N_CORS_ALLOWED_ORIGINS=*`

---

## Architecture

- **Frontend never talks to Supabase directly.** All data flows through n8n.
- **n8n uses the service_role key**, bypassing RLS. Intentional for single-user.
- **Soft deletes only.** Tasks are never physically removed.
- **AI fallback.** If parsing fails, the AI's raw text is shown as a chat message. User input is never lost.
- **Conversational.** Both add and clear flows support multi-turn AI conversation with clarifying questions.

## What's Next

- **Multi-user auth**: Enable Supabase Auth, tighten RLS from `USING (true)` to `USING (auth.uid() = user_id)`, add login page
- **Replace n8n**: Build a Node.js/Python API with the same endpoints, update `config.js`
- **In-app notifications**: The `notifications` table with Realtime is ready. Add Supabase JS client to frontend, subscribe to changes
- **Follow-up checks**: Add a cron workflow that checks `follow_up_at` on in-progress tasks and nudges the user to confirm completion
