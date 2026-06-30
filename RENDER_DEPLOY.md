# Render deployment (free tier)

We use Render's free Web Service to keep the bot online 24/7.

## 1. Push to GitHub

```bash
cd /Users/avaneesh/expense-manager
git init
git add .
git commit -m "Initial commit: voice-first expense manager"
gh repo create expense-manager --private --source=. --push   # or use the GitHub UI
```

## 2. Create the Render service

1. Sign in at https://render.com
2. **New + → Web Service**
3. Connect your GitHub account → select `expense-manager`
4. Configure:
   - **Name**: `expense-manager-bot`
   - **Region**: Singapore (closest to India)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. **Advanced → Add Environment Variables**:
   - `TELEGRAM_BOT_TOKEN` = your token
   - `GEMINI_API_KEY` = your key
   - `GEMINI_MODEL` = `gemini-1.5-flash`
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = your service role key
   - `DEFAULT_REMINDER_HOUR` = `21`
   - `DEFAULT_REMINDER_MIN` = `0`
   - `TIMEZONE` = `Asia/Kolkata`
   - `OWNER_TELEGRAM_ID` = your id
6. Click **Create Web Service**

## 3. Wait for the first deploy (~3 min)

Watch the logs. You should see:
```
✅ Expense manager bot is up.
   Reminder timezone: Asia/Kolkata
   Default reminder: 21:00
   Gemini model:     gemini-1.5-flash
   Groq fallback:    disabled
```

## 4. Verify

- Open Telegram → your bot → `/start`
- Send `Spent 200 on Zomato`
- Bot should reply with a parsed entry

## 5. Free tier notes

- Render free tier sleeps after **15 min of no inbound HTTP traffic**. Our self-ping (in `src/index.js`) hits `RENDER_EXTERNAL_URL` every 14 minutes to keep the service awake.
- If the bot is asleep, the first message will take ~30s to wake the service. Reminders may occasionally miss their slot by a minute. This is fine for personal use.
- To remove the sleep: upgrade to the $7/mo plan (not required for now).

## 6. Update & redeploy

```bash
git add -A
git commit -m "feature: ..."
git push
```

Render auto-deploys on push to the watched branch.

## 7. Logs & debugging

- Live logs: Render dashboard → service → **Logs** tab
- Bot errors: `bot.catch` already logs to console — visible in Render logs
- DB inspection: Supabase dashboard → **Table Editor**
