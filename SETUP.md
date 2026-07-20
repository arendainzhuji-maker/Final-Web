# Last Stop Mail — Full Setup Guide

This guide walks you through running the site on your computer, receiving form submissions by email, and publishing the site live.

---

## What you need first

1. **Node.js** installed on your computer  
   Download: https://nodejs.org/ (choose the LTS version)

2. **Your Yahoo email**: `arendainzhuji@yahoo.com`

3. **Your phone number on the site**: `(825) 993-3458` (already added — visitors can tap to call)

---

## Part 1: Run the site on your computer

### Step 1 — Open the project folder in PowerShell

Press `Windows + X`, choose **Terminal** or **PowerShell**, then run:

```powershell
cd C:\Users\zhuji\.cursor\projects\empty-window
```

### Step 2 — Install dependencies

If PowerShell blocks `npm`, use `npm.cmd` instead:

```powershell
npm.cmd install
```

You only need to do this once (or again after new packages are added).

### Step 3 — Start the server

```powershell
npm.cmd run dev
```

You should see:

```text
Last Stop Mail running on http://localhost:3000
```

### Step 4 — Open the website

In your browser, go to:

```text
http://localhost:3000/
```

Leave the PowerShell window open while the site is running. Closing it stops the server.

---

## Part 2: Set up email notifications (recommended)

Yahoo SMTP often fails with **550 Mailbox unavailable** when sending from a website. The reliable fix is **Web3Forms** — it forwards form submissions straight to your Yahoo inbox.

When someone submits **Send Inquiry** or **Start Reservation**, the site saves the lead and emails you at **arendainzhuji@yahoo.com**.

### Option A — Web3Forms (recommended, ~2 minutes)

1. Go to **https://web3forms.com**
2. Enter your email: **arendainzhuji@yahoo.com**
3. Click to get your **Access Key** (check your Yahoo inbox for the key)
4. Open your `.env` file in the project folder
5. Add this line (paste your key after the `=`):

```env
WEB3FORMS_ACCESS_KEY=paste-your-access-key-here
```

6. Restart the server:

```powershell
npm.cmd run dev
```

You should see:

```text
Email delivery: Web3Forms -> arendainzhuji@yahoo.com
```

7. Test by submitting **Send Inquiry** on the site — check your Yahoo inbox for the lead email.

### Option B — Yahoo SMTP (often unreliable)

If you see `550 Request failed; Mailbox unavailable`, Yahoo is blocking the send. Use Web3Forms instead (Option A).

Yahoo app password setup (only if you want to try SMTP anyway):

1. Yahoo Account Security → **Generate app password**
2. Add to `.env`:

```env
SMTP_USER=arendainzhuji@yahoo.com
SMTP_PASS=your-yahoo-app-password
NOTIFY_EMAIL=arendainzhuji@yahoo.com
```

**Note:** If your Yahoo address ends in `@yahoo.ca` instead of `@yahoo.com`, use that exact address everywhere in `.env`.

### Step — Test that email works

1. Open `http://localhost:3000/`
2. Click **Let's talk**
3. Fill out the form with test info
4. Click **Send inquiry**
5. Check your Yahoo inbox (and spam folder) for the inquiry email

---

## Part 3: Where submissions are stored

Even if email fails, submissions are saved here:

```text
data/submissions.json
```

Open that file to see:

- `availabilityChecks` — inquiries from **Send Inquiry**
- `reservations` — requests from **Start Reservation**

Each entry includes business name, contact name, email, phone, category, plan, and notes.

---

## Part 4: Publish the site live (go public)

This site runs on **Node.js**. It works on **Vercel** (recommended if you already use it) or any Node host.

### Deploy on Vercel (recommended)

1. Push your project to **GitHub**
2. Sign up at https://vercel.com and **Import** your GitHub repo
3. Vercel should auto-detect the project. Leave defaults:
   - **Framework Preset:** Other
   - **Build Command:** (leave empty)
   - **Output Directory:** (leave empty)
4. Add **Environment Variables**:
   - `WEB3FORMS_ACCESS_KEY` = your key from https://web3forms.com
   - `NOTIFY_EMAIL` = `arendainzhuji@yahoo.com`
   - `SITE_URL` = leave blank, or your custom domain after it is connected
5. Click **Deploy**
6. After deploy, test:
   - your `*.vercel.app` URL
   - `/robots.txt` and `/sitemap.xml`
   - **Send inquiry** on the form (check Yahoo inbox + spam)
7. Connect your custom domain in Vercel → **Settings → Domains**

**Note:** Inquiry emails are sent via Web3Forms (browser + server). Yahoo SMTP does not work reliably on Vercel.

### Other hosting options

| Service | Best for | Notes |
|---------|----------|-------|
| **Render** | Simple Node deploy | Connect GitHub repo, `npm start` |
| **Railway** | Simple deploy | Same as Render |
| **Fly.io** | More control | Good if you outgrow free tier |

### Typical publish steps (example: Render)

1. Push your project to **GitHub** (private repo is fine)
2. Sign up at https://render.com
3. **New → Web Service** → connect your repo
4. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Environment variables:** add:
     - `WEB3FORMS_ACCESS_KEY=` **required on Render** (Yahoo SMTP usually fails in the cloud)
     - `NOTIFY_EMAIL=arendainzhuji@yahoo.com`
     - `SITE_URL=` leave blank, OR set to your real live URL (Render URL or custom domain)
     - Optional SMTP fallback: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
5. Deploy — Render gives you a URL like `https://your-app.onrender.com`
6. Connect your own domain in Render (Custom Domains) and update DNS at your registrar
7. After it is live, open these and confirm they work:
   - your Render URL or custom domain homepage
   - `/robots.txt` (must say `Allow: /`, not `Disallow: /`)
   - `/sitemap.xml`
8. Test the **Let's talk** form and confirm the email arrives

**Important:** Do not set `SITE_URL` to an old domain you are not using. That can redirect visitors away from your new site.

---

## Troubleshooting

### `npm` is blocked in PowerShell

Use `npm.cmd` instead of `npm`, or run once:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Forms work but no email arrives

1. **On Render:** add `WEB3FORMS_ACCESS_KEY` in Environment variables (Yahoo SMTP usually does not work in the cloud).
2. Get a free key at **https://web3forms.com** using **arendainzhuji@yahoo.com**.
3. Redeploy after saving the key.
4. Submit a test inquiry — check Yahoo inbox and spam.
5. If you rely on the FormSubmit backup, the **first** inquiry sends an activation email to your Yahoo inbox. Click the link once to turn it on.
6. Look at Render logs for `Lead email sent via Web3Forms`.

### Site won't open

- Make sure the server is running (`npm.cmd run dev`)
- Use `http://localhost:3000/` not the HTML file directly

### PowerShell execution policy error

Always use:

```powershell
npm.cmd install
npm.cmd run dev
```

---

## Quick reference

| Item | Value |
|------|-------|
| Local site | http://localhost:3000/ |
| Your email | arendainzhuji@yahoo.com |
| Your phone on site | (825) 993-3458 |
| Submissions backup | `data/submissions.json` |
| Email config | `.env` file |
