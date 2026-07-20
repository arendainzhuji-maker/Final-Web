# Last Stop Mail

Full-stack landing page for a shared local direct-mail advertising campaign in Edmonton.

## Quick start (Windows)

```powershell
cd C:\Users\zhuji\.cursor\projects\empty-window
npm.cmd install
npm.cmd run dev
```

Open http://localhost:3000/

**Full setup guide (email, testing, publishing):** see [SETUP.md](./SETUP.md)

## Features

- Responsive marketing site
- **Send Inquiry** form with email notifications
- **Start Reservation** modal with email notifications
- Click-to-call: **(825) 993-3458**
- Privacy page at `/privacy.html`
- JSON backup of all submissions

## Contact on the site

- Phone: [(825) 993-3458](tel:+18259933458)
- Email: arendainzhuji@yahoo.com

## Email setup (short version)

1. Get a free key at https://web3forms.com (use `arendainzhuji@yahoo.com`)
2. Add `WEB3FORMS_ACCESS_KEY` to `.env` locally and to **Vercel → Environment Variables** when live
3. Restart the server / redeploy

Details: [SETUP.md](./SETUP.md)

## Deploy on Vercel

Push to GitHub, import the repo in Vercel, add `WEB3FORMS_ACCESS_KEY` and `NOTIFY_EMAIL`, then deploy. See [SETUP.md](./SETUP.md).

## Data storage

- `data/submissions.json` — all form submissions
- `data/categories.json` — category suggestions for the form
