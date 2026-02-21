# Zen Tasks — Setup Guide

A zen task manager where you talk to an AI assistant to add and manage tasks. The AI handles all the complexity — you never have to stare at a long task list.

## Prerequisites

- A [Supabase](https://supabase.com) account (free tier works)
- A [Vercel](https://vercel.com) account (free tier works)
- A Telegram account (for nudges)
- A Google account (for calendar integration)
- Node.js 20+ installed

---

## 1. Supabase Setup

1. Create a new project at [app.supabase.com](https://app.supabase.com)
2. Go to **SQL Editor** and run the contents of `database/schema.sql`
3. Then run `database/seed.sql` (creates the default user)
4. Note your project credentials (**Settings > API**):
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **service_role key** (the secret one — not `anon`)

---

## 2. Telegram Bot Setup

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`, follow the prompts, and save your **Bot Token**
3. Start a conversation with your new bot (send it any message)
4. Get your **Chat ID** — search for [@userinfobot](https://t.me/userinfobot) in Telegram and send it any message. It replies with your ID.
5. Update the default user in Supabase SQL Editor:
   ```sql
   UPDATE users
   SET telegram_chat_id = 'YOUR_CHAT_ID'
   WHERE id = '00000000-0000-0000-0000-000000000001';
   ```

---

## 3. Google Calendar OAuth2 Setup

The API needs read access to your Google Calendar to find free slots for nudges and resolve date references in tasks.

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the **Google Calendar API** (APIs & Services > Library)
4. Create OAuth 2.0 credentials (APIs & Services > Credentials > Create Credentials > OAuth client ID):
   - Application type: **Web application**
   - Authorised redirect URIs: add `https://developers.google.com/oauthplayground`
5. Note your **Client ID** and **Client Secret**
6. Get a refresh token via [OAuth Playground](https://developers.google.com/oauthplayground):
   - Click the gear icon (top right) > tick **Use your own OAuth credentials**
   - Enter your Client ID and Client Secret
   - In Step 1, find and select **Google Calendar API v3** > `https://www.googleapis.com/auth/calendar.readonly`
   - Click **Authorise APIs** and sign in with your Google account
   - In Step 2, click **Exchange authorisation code for tokens**
   - Copy the **Refresh token**

---

## 4. API Setup (Vercel)

### Environment Variables

Create `api/.env.local` for local development:

```bash
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TELEGRAM_BOT_TOKEN=123456:ABC...
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REFRESH_TOKEN=1//...
CRON_SECRET=any-random-string-you-choose
```

### Local Development

```bash
cd api
npm install
npm run dev
```

The API runs at `http://localhost:3000`.

### Deploy to Vercel

1. Push the repo to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
   - Set **Root Directory** to `api`
3. Add all the environment variables from `.env.local` in **Settings > Environment Variables**
4. Deploy — Vercel gives you a URL like `https://your-project.vercel.app`

### Configure the Telegram Webhook

Once deployed, register the webhook so Telegram sends button presses and replies to your API:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-project.vercel.app/api/telegram/webhook"
```

### Configure the Nudge Cron

In `api/vercel.json`, the cron is already configured to run every 30 minutes. Vercel calls `GET /api/cron/nudge` with an `Authorization: Bearer <CRON_SECRET>` header. No extra setup needed after deploy.

---

## 5. Frontend Setup

The frontend is a static Vanilla JS app hosted on GitHub Pages. It's already configured to point at the production API.

To run it locally against a local API:

Edit `frontend/js/config.js`:
```js
const CONFIG = {
  API_BASE_URL: 'http://localhost:3000/api',  // local
  USER_ID: '00000000-0000-0000-0000-000000000001',
};
```

Then serve it:
```bash
npx serve frontend/
```

Open `http://localhost:3000` (or whichever port `serve` picks).

---

## 6. How It Works

### Home Screen
Two buttons: **Add a task** and **Clear a task**. A hamburger menu opens the full task list (but you shouldn't need it often).

### Adding a Task
Tap "Add a task" to open a chat. Type or voice-message your tasks. The AI will:
- Parse task details (title, urgency, importance, duration, location, etc.)
- Check your Google Calendar to resolve relative dates ("after Sophie's wedding")
- Ask clarifying questions if needed
- Confirm when the task is saved

You can add multiple tasks in one message.

### Clearing a Task
Tap "Clear a task". You can:
- **Complete**: "I finished the grocery shopping"
- **Start**: "I'm about to do the laundry" (AI will follow up later)
- **Snooze**: "Snooze the laundry for a day"
- **Delete**: "Delete the dentist appointment, I cancelled it"
- **Get a suggestion**: "What should I do now?" (AI picks the best task given your free time)

### Nudges
Every 30 minutes (8am–9pm), the cron checks your Google Calendar for free slots, picks the best matching task, and sends a suggestion via Telegram with three buttons: **On it!**, **Snooze 1h**, **Busy today**.

---

## 7. Troubleshooting

### "Something went wrong" in the chat
- Check that the API is deployed and responding at `/api/task-agent`
- Check Vercel function logs for errors
- Check the browser console (F12) for CORS errors

### AI responses aren't parsing correctly
- Check Vercel logs — look for JSON parse errors
- The raw AI text is shown as a chat message as a fallback — user input is never lost

### Voice button doesn't work
- Web Speech API requires HTTPS or localhost
- Chrome has the best support; Firefox/Safari may not work
- Check browser permissions for microphone access

### No Telegram nudges arriving
- Verify the webhook is set: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- Check that `TELEGRAM_BOT_TOKEN` and the user's `telegram_chat_id` in Supabase are correct
- Make sure you started a conversation with the bot (send it any message)
- Check Vercel cron logs in the dashboard

### CORS errors
- CORS is handled in `api/src/lib/middleware.ts` — allowed origins are set to `*` by default

---

## Architecture Notes

- **Frontend never talks to Supabase directly.** All data flows through the Next.js API.
- **The API uses the service_role key**, bypassing RLS. Intentional for single-user.
- **Soft deletes only.** Tasks are never physically removed — `status` is set to `'deleted'`.
- **AI fallback.** If JSON parsing fails, the raw AI text is shown as a chat message.
- **Conversational.** Both add and clear flows support multi-turn AI conversation.

---

## What's Next

- **Follow-up checks**: Add a cron that checks `follow_up_at` on in-progress tasks and nudges for completion confirmation
- **In-app notifications**: The `notifications` table + Supabase Realtime is ready — add Supabase JS client to frontend
- **Multi-user auth**: Enable Supabase Auth, tighten RLS from `USING (true)` to `USING (auth.uid() = user_id)`, add a login page
