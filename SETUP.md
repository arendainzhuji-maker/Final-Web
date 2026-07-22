# Last Stop Mail â€” Full Setup Guide

This guide walks you through running the site on your computer, receiving form submissions by email, and publishing the site live.

---

## What you need first

1. **Node.js** installed on your computer  
   Download: https://nodejs.org/ (choose the LTS version)

2. **Your inquiry email**: `laststopmails@gmail.com`

3. **Your phone number on the site**: `(825) 993-3458` (already added â€” visitors can tap to call)

---

## Part 1: Run the site on your computer

### Step 1 â€” Open the project folder in PowerShell

Press `Windows + X`, choose **Terminal** or **PowerShell**, then run:

```powershell
cd C:\Users\zhuji\.cursor\projects\empty-window
```

### Step 2 â€” Install dependencies

If PowerShell blocks `npm`, use `npm.cmd` instead:

```powershell
npm.cmd install
```

You only need to do this once (or again after new packages are added).

### Step 3 â€” Start the server

```powershell
npm.cmd run dev
```

You should see:

```text
Last Stop Mail running on http://localhost:3000
```

### Step 4 â€” Open the website

In your browser, go to:

```text
http://localhost:3000/
```

Leave the PowerShell window open while the site is running. Closing it stops the server.

---

## Part 2: Set up email notifications (recommended)

When someone submits **Send inquiry**, the site saves the lead and emails you at **laststopmails@gmail.com**.

Delivery order (automatic):

1. **Web3Forms** (if you add a key)
2. **FormSubmit** (works with just your Yahoo address â€” default path)
3. **Yahoo SMTP** (optional fallback)

### Important first-time step (FormSubmit)

The **first** inquiry may send an **activation email** to `laststopmails@gmail.com` instead of a normal lead. Open that email and click **Activate Form** once. After that, inquiries arrive normally. Check spam if you do not see it.

### Optional â€” Web3Forms (extra reliable)

1. Go to **https://web3forms.com**
2. Enter **laststopmails@gmail.com** and get your access key
3. Add to `.env` (and to Vercel/Render env vars if live):

```env
WEB3FORMS_ACCESS_KEY=paste-your-access-key-here
```

4. Restart / redeploy

### Optional â€” Yahoo SMTP

Yahoo often fails with **550** from websites. Keep it only as a backup:

```env
SMTP_USER=laststopmails@gmail.com
SMTP_PASS=your-yahoo-app-password
NOTIFY_EMAIL=laststopmails@gmail.com
```

### Step â€” Test that email works

1. Open `http://localhost:3000/`
2. Click **Let's talk**
3. Fill out the form with test info
4. Click **Send inquiry**
5. Check Gmail inbox **and spam** for either the lead or the FormSubmit activation email

---

## Part 3: Where submissions are stored

Even if email fails, submissions are saved here:

```text
data/submissions.json
```

Open that file to see:

- `availabilityChecks` â€” inquiries from **Send Inquiry**
- `reservations` â€” requests from **Start Reservation**

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
4. Add **Environment Variables** (optional but recommended):
   - `NOTIFY_EMAIL` = `laststopmails@gmail.com`
   - `WEB3FORMS_ACCESS_KEY` = (optional, from web3forms.com)
   - `SMTP_USER` / `SMTP_PASS` = (optional Yahoo fallback)
   - `SITE_URL` = your live URL once you have a custom domain
5. Click **Deploy**
6. After deploy, test:
   - your `*.vercel.app` URL
   - `/robots.txt` and `/sitemap.xml`
   - **Send inquiry** on the form (check Gmail inbox + spam â€” first time may be FormSubmit activation)
7. Connect your custom domain in Vercel â†’ **Settings â†’ Domains**

**Note:** Inquiry emails now use FormSubmit by default (no SMTP required). Still add env vars if you use Web3Forms or Yahoo SMTP.

### Other hosting options

| Service | Best for | Notes |
|---------|----------|-------|
| **Render** | Simple Node deploy | Connect GitHub repo, `npm start` |
| **Railway** | Simple deploy | Same as Render |
| **Fly.io** | More control | Good if you outgrow free tier |

### Typical publish steps (example: Render)

1. Push your project to **GitHub** (private repo is fine)
2. Sign up at https://render.com
3. **New â†’ Web Service** â†’ connect your repo
4. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Environment variables:** add:
     - `WEB3FORMS_ACCESS_KEY=` **required on Render** (Yahoo SMTP usually fails in the cloud)
     - `NOTIFY_EMAIL=laststopmails@gmail.com`
     - `SITE_URL=` leave blank, OR set to your real live URL (Render URL or custom domain)
     - Optional SMTP fallback: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
5. Deploy â€” Render gives you a URL like `https://your-app.onrender.com`
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
2. Get a free key at **https://web3forms.com** using **laststopmails@gmail.com**.
3. Redeploy after saving the key.
4. Submit a test inquiry â€” check Gmail inbox and spam.
5. If you rely on the FormSubmit backup, the **first** inquiry sends an activation email to your Gmail inbox. Click the link once to turn it on.
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
| Your email | laststopmails@gmail.com |
| Your phone on site | (825) 993-3458 |
| Submissions backup | `data/submissions.json` |
| Email config | `.env` file |

