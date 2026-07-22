const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = Boolean(process.env.VERCEL);
const ROOT_DIR = __dirname;
const DATA_DIR = IS_VERCEL ? path.join("/tmp", "last-stop-mail-data") : path.join(ROOT_DIR, "data");
const CATEGORIES_FILE = path.join(DATA_DIR, "categories.json");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const IMAGES_DIR = path.join(ROOT_DIR, "public", "images");

app.set("trust proxy", 1);

app.use(express.json({ limit: "1mb" }));

app.use((_req, res, next) => {
  // Never block search engines via response headers.
  if (res.getHeader("X-Robots-Tag")) {
    res.removeHeader("X-Robots-Tag");
  }
  next();
});

app.use((req, res, next) => {
  const host = (req.get("host") || "").toLowerCase();

  if (IS_VERCEL || host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    next();
    return;
  }

  // Prefer HTTPS on the *current* host only — never force a different domain.
  const proto = (req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0].trim();
  if (proto !== "https") {
    res.redirect(301, `https://${host}${req.originalUrl}`);
    return;
  }

  next();
});

function getSiteUrl(req) {
  const configured = (process.env.SITE_URL || "").trim().replace(/\/$/, "");
  if (configured) {
    return configured;
  }

  const host = req.get("host");
  if (!host) {
    return `http://localhost:${PORT}`;
  }

  const protocol = (req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0].trim();
  return `${protocol}://${host}`;
}

async function renderPublicFile(filename, siteUrl) {
  const filePath = path.join(ROOT_DIR, "public", filename);
  const content = await fs.readFile(filePath, "utf8");

  return content
    .replaceAll("__SITE_URL__", siteUrl)
    .replaceAll("__NOTIFY_EMAIL__", getNotifyEmail())
    .replaceAll("__WEB3FORMS_ACCESS_KEY__", (process.env.WEB3FORMS_ACCESS_KEY || "").trim());
}

app.get("/favicon.ico", async (_req, res, next) => {
  try {
    const iconPath = path.join(ROOT_DIR, "public", "images", "logo-mark.png");
    const icon = await fs.readFile(iconPath);
    res.type("image/png").send(icon);
  } catch (error) {
    next(error);
  }
});

app.get("/robots.txt", async (req, res, next) => {
  try {
    const body = await renderPublicFile("robots.txt", getSiteUrl(req));
    res.type("text/plain").send(body);
  } catch (error) {
    next(error);
  }
});

app.get("/sitemap.xml", async (req, res, next) => {
  try {
    const body = await renderPublicFile("sitemap.xml", getSiteUrl(req));
    res.type("application/xml").send(body);
  } catch (error) {
    next(error);
  }
});

app.get("/", async (req, res, next) => {
  try {
    const body = await renderPublicFile("index.html", getSiteUrl(req));
    res.type("html").send(body);
  } catch (error) {
    next(error);
  }
});

app.get("/privacy.html", async (req, res, next) => {
  try {
    const body = await renderPublicFile("privacy.html", getSiteUrl(req));
    res.type("html").send(body);
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(ROOT_DIR, "public")));

const defaultSubmissions = {
  availabilityChecks: [],
  reservations: [],
};

const recentEmailSends = new Map();
const processedSubmissionIds = new Map();

const ENV_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "NOTIFY_EMAIL",
  "WEB3FORMS_ACCESS_KEY",
  "SITE_URL",
];

async function resolveLogoPath() {
  const logoPath = path.join(IMAGES_DIR, "logo.png");

  try {
    await fs.access(logoPath);
    return "/images/logo.png";
  } catch (error) {
    // Fall back to the bundled SVG if logo.png is missing.
  }

  return "/images/logo.svg";
}

async function resolveHeroPostcardPath() {
  const candidates = ["hero-postcard.jpg", "hero-postcard.jpeg", "hero-postcard.png", "hero-postcard.webp"];

  for (const filename of candidates) {
    try {
      await fs.access(path.join(IMAGES_DIR, filename));
      return `/images/${filename}`;
    } catch (error) {
      // Try the next supported format.
    }
  }

  return null;
}

async function loadEnvFile() {
  if (IS_VERCEL) {
    return;
  }

  try {
    const envPath = path.join(ROOT_DIR, ".env");
    const content = await fs.readFile(envPath, "utf8");

    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        return;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (key && (ENV_KEYS.includes(key) || process.env[key] === undefined)) {
        process.env[key] = value;
      }
    });
  } catch {
    // Optional local .env file.
  }
}

function getNotifyEmail() {
  return (process.env.NOTIFY_EMAIL || "laststopmails@gmail.com").trim().toLowerCase();
}

function pruneRecentEntries(store, maxAgeMs) {
  const now = Date.now();

  for (const [key, timestamp] of store.entries()) {
    if (now - timestamp > maxAgeMs) {
      store.delete(key);
    }
  }
}

function shouldSkipDuplicateEmail(subject, fields) {
  const dedupeKey = [
    subject,
    fields.Email,
    fields["Contact name"],
    fields.Category || "",
    fields.Plan || fields.Service || "",
    fields.Offer || "",
  ]
    .join("|")
    .toLowerCase();

  const now = Date.now();
  const lastSent = recentEmailSends.get(dedupeKey);

  if (lastSent && now - lastSent < 30000) {
    console.log("Skipping duplicate email send for:", dedupeKey);
    return true;
  }

  recentEmailSends.set(dedupeKey, now);
  pruneRecentEntries(recentEmailSends, 60000);
  return false;
}

function rememberSubmission(submissionId) {
  if (!submissionId) {
    return;
  }

  processedSubmissionIds.set(submissionId, Date.now());
  pruneRecentEntries(processedSubmissionIds, 300000);
}

function isProcessedSubmission(submissionId) {
  if (!submissionId) {
    return false;
  }

  pruneRecentEntries(processedSubmissionIds, 300000);
  return processedSubmissionIds.has(submissionId);
}

async function sendViaWeb3Forms(subject, fields, text) {
  const accessKey = (process.env.WEB3FORMS_ACCESS_KEY || "").trim();

  if (!accessKey) {
    return false;
  }

  const response = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      access_key: accessKey,
      subject: `[Last Stop Mail] ${subject}`,
      from_name: "Last Stop Mail Website",
      name: fields["Contact name"] || "Website visitor",
      email: fields.Email || getNotifyEmail(),
      replyto: fields.Email || getNotifyEmail(),
      phone: fields.Phone || "",
      message: text,
      botcheck: false,
      business_name: fields["Business name"] || "",
      service: fields.Service || fields.Plan || "",
      notes: fields.Notes || "",
    }),
  });

  const raw = await response.text();
  let result = {};

  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error(
      `Web3Forms returned non-JSON (${response.status}). Often means domain lock or invalid key.`
    );
  }

  if (!response.ok || !result.success) {
    throw new Error(result.message || `Web3Forms request failed (${response.status})`);
  }

  console.log("Lead email sent via Web3Forms to", getNotifyEmail());
  return true;
}

async function sendViaFormSubmit(subject, fields, text) {
  const notifyEmail = getNotifyEmail();
  const endpoint = `https://formsubmit.co/ajax/${encodeURIComponent(notifyEmail)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      _subject: `[Last Stop Mail] ${subject}`,
      _template: "table",
      _captcha: "false",
      name: fields["Contact name"] || "Website visitor",
      email: fields.Email || notifyEmail,
      phone: fields.Phone || "",
      business_name: fields["Business name"] || "",
      service: fields.Service || fields.Plan || fields.Category || "",
      notes: fields.Notes || "",
      message: text,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === "false" || result.success === false) {
    throw new Error(result.message || "FormSubmit request failed");
  }

  console.log("Lead email sent via FormSubmit to", notifyEmail);
  return true;
}

async function sendViaYahoo(subject, text) {
  const smtpUser = (process.env.SMTP_USER || "").trim();
  const smtpPass = (process.env.SMTP_PASS || "").trim();
  const notifyEmail = getNotifyEmail();

  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP is not configured");
  }

  const mailOptions = {
    from: smtpUser,
    to: notifyEmail,
    subject: `[Last Stop Mail] ${subject}`,
    text,
  };

  const transportConfigs = [
    { port: 587, secure: false, requireTLS: true },
    { port: 465, secure: true, requireTLS: false },
  ];

  let lastError;

  for (const config of transportConfigs) {
    try {
      const transporter = createYahooTransporter(config.port, config.secure, config.requireTLS);
      const info = await transporter.sendMail(mailOptions);
      console.log(`Lead email sent via Yahoo SMTP on port ${config.port}:`, info.messageId);
      return true;
    } catch (error) {
      lastError = error;
      console.error(`Yahoo SMTP failed on port ${config.port}:`, error.message);
    }
  }

  throw lastError || new Error("Yahoo SMTP failed");
}

async function sendLeadEmail(subject, fields) {
  if (shouldSkipDuplicateEmail(subject, fields)) {
    return { sent: true, method: "dedupe" };
  }

  const { text } = buildEmailBodies(fields);
  const errors = [];
  const smtpUser = (process.env.SMTP_USER || "").trim();
  const smtpPass = (process.env.SMTP_PASS || "").trim();

  // Prefer providers that work on cloud hosts. Yahoo SMTP often fails with 550.
  if (process.env.WEB3FORMS_ACCESS_KEY) {
    try {
      await sendViaWeb3Forms(subject, fields, text);
      return { sent: true, method: "web3forms" };
    } catch (error) {
      errors.push(`Web3Forms: ${error.message}`);
      console.error("Web3Forms failed:", error.message);
    }
  }

  try {
    await sendViaFormSubmit(subject, fields, text);
    return { sent: true, method: "formsubmit" };
  } catch (error) {
    errors.push(`FormSubmit: ${error.message}`);
    console.error("FormSubmit failed:", error.message);
  }

  if (smtpUser && smtpPass) {
    try {
      await sendViaYahoo(subject, text);
      return { sent: true, method: "yahoo" };
    } catch (error) {
      errors.push(`Yahoo SMTP: ${error.message}`);
      console.error("Yahoo SMTP failed:", error.message);
    }
  }

  if (!smtpUser && !smtpPass && !process.env.WEB3FORMS_ACCESS_KEY) {
    errors.push("Configure WEB3FORMS_ACCESS_KEY or SMTP_USER/SMTP_PASS for email delivery.");
  }

  throw new Error(errors.join(" | ") || "Email delivery failed");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatPlanLabel(plan) {
  if (plan === "community") {
    return "Community postcard campaign (5,000 homes)";
  }

  if (plan === "double") {
    return "Printing & postage";
  }

  if (plan === "custom") {
    return "Not sure / custom project";
  }

  return "Direct mail campaign";
}

function buildEmailBodies(fields) {
  const text = Object.entries(fields)
    .map(([label, value]) => `${label}: ${value || "—"}`)
    .join("\n");

  const htmlRows = Object.entries(fields)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">${escapeHtml(label)}</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(value || "—")}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#2F343A;">
      <h2 style="color:#1F5E3B;">New Last Stop Mail Lead</h2>
      <table style="border-collapse:collapse;width:100%;max-width:640px;">${htmlRows}</table>
    </div>
  `;

  return { text, html };
}

function createYahooTransporter(port, secure, requireTLS = false) {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.mail.yahoo.com",
    port,
    secure,
    requireTLS,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      minVersion: "TLSv1.2",
    },
  });
}

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(CATEGORIES_FILE);
  } catch {
    await writeJson(CATEGORIES_FILE, []);
  }

  try {
    await fs.access(SUBMISSIONS_FILE);
  } catch {
    await writeJson(SUBMISSIONS_FILE, defaultSubmissions);
  }
}

async function readJson(filePath, fallback) {
  try {
    const file = await fs.readFile(filePath, "utf8");
    return JSON.parse(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJson(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    if (IS_VERCEL) {
      console.warn("Submission storage unavailable on Vercel (email delivery still works):", error.message);
      return;
    }

    throw error;
  }
}

function normalizeCategory(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeText(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

function sanitizeEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 200);
}

function sanitizePhone(value) {
  return String(value || "")
    .trim()
    .replace(/[^\d+()\-.\s]/g, "")
    .slice(0, 40);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPlan(plan) {
  return ["community", "standard", "double", "custom"].includes(plan);
}

function summarizeCategory(category) {
  return {
    slug: category.slug,
    label: category.label,
    status: category.status,
    highlight: category.highlight,
    description: category.description,
    displayStatus:
      category.status === "available"
        ? "Available"
        : category.status === "limited"
          ? "Limited"
          : "Booked",
  };
}

app.get("/api/logo-path", async (_req, res) => {
  const src = await resolveLogoPath();
  res.json({ src });
});

app.get("/api/hero-postcard", async (_req, res) => {
  const src = await resolveHeroPostcardPath();
  res.json({ src });
});

app.get("/api/categories", async (req, res) => {
  const categories = await readJson(CATEGORIES_FILE, []);
  const query = sanitizeText(req.query.query || req.query.category || "", 80);

  if (!query) {
    res.json({
      categories: categories.map(summarizeCategory),
    });
    return;
  }

  const normalizedQuery = normalizeCategory(query);
  const category = categories.find((item) => item.slug === normalizedQuery);

  if (!category) {
    res.status(404).json({
      message: "We do not have that category in our preset list yet, but you can still send a custom inquiry.",
      query,
      category: null,
    });
    return;
  }

  res.json({
    query,
    category: summarizeCategory(category),
  });
});

app.post("/api/availability-check", async (req, res) => {
  const submissions = await readJson(SUBMISSIONS_FILE, defaultSubmissions);
  const categories = await readJson(CATEGORIES_FILE, []);

  const payload = {
    companyName: sanitizeText(req.body.companyName, 120),
    contactName: sanitizeText(req.body.contactName, 120),
    email: sanitizeEmail(req.body.email),
    phone: sanitizePhone(req.body.phone),
    category: sanitizeText(req.body.category, 80),
    plan: sanitizeText(req.body.plan, 30).toLowerCase(),
    notes: sanitizeText(req.body.notes, 800),
  };

  if (!payload.companyName || !payload.contactName || !payload.email || !payload.category || !payload.plan) {
    res.status(400).json({ message: "Please complete the required fields." });
    return;
  }

  if (!isValidEmail(payload.email)) {
    res.status(400).json({ message: "Please enter a valid email address." });
    return;
  }

  if (!isValidPlan(payload.plan)) {
    res.status(400).json({ message: "Please choose a valid plan." });
    return;
  }

  const submissionId = sanitizeText(req.body.submissionId, 80);

  if (submissionId && isProcessedSubmission(submissionId)) {
    res.json({
      success: true,
      emailSent: true,
      contactName: payload.contactName,
      category: payload.category,
      planLabel: formatPlanLabel(payload.plan),
    });
    return;
  }

  rememberSubmission(submissionId);

  const category = categories.find((item) => item.slug === normalizeCategory(payload.category));
  const entry = {
    id: `check_${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...payload,
    matchedCategory: category ? summarizeCategory(category) : null,
  };

  submissions.availabilityChecks.unshift(entry);
  await writeJson(SUBMISSIONS_FILE, submissions);

  let emailResult = { sent: false, method: null };

  try {
    emailResult = await sendLeadEmail(
      "New Inquiry",
      {
        Type: "Category availability inquiry",
        "Business name": payload.companyName,
        "Contact name": payload.contactName,
        Email: payload.email,
        Phone: payload.phone || "Not provided",
        Category: payload.category,
        Plan: formatPlanLabel(payload.plan),
        Notes: payload.notes || "None",
        "Submitted at": entry.createdAt,
      }
    );
  } catch (error) {
    console.error("Failed to send inquiry email:", error.message);
  }

  res.json({
    success: true,
    emailSent: emailResult.sent,
    contactName: payload.contactName,
    category: payload.category,
    planLabel: formatPlanLabel(payload.plan),
    message: emailResult.sent
      ? `Thanks, ${payload.contactName}. Zhuji will personally follow up about your mailing needs.`
      : `Thanks, ${payload.contactName}. Your inquiry was saved, but email delivery failed. Please call (825) 993-3458.`,
  });
});

app.post("/api/reservations", async (req, res) => {
  const submissions = await readJson(SUBMISSIONS_FILE, defaultSubmissions);

  const payload = {
    companyName: sanitizeText(req.body.companyName, 120),
    contactName: sanitizeText(req.body.contactName, 120),
    email: sanitizeEmail(req.body.email),
    phone: sanitizePhone(req.body.phone),
    plan: sanitizeText(req.body.plan || "standard", 30).toLowerCase(),
    notes: sanitizeText(req.body.notes, 1000),
  };

  if (!payload.companyName || !payload.contactName || !payload.email || !payload.phone) {
    res.status(400).json({ message: "Please complete all required fields." });
    return;
  }

  if (!isValidEmail(payload.email)) {
    res.status(400).json({ message: "Please enter a valid email address." });
    return;
  }

  if (!isValidPlan(payload.plan)) {
    res.status(400).json({ message: "Please choose a valid service option." });
    return;
  }

  const submissionId = sanitizeText(req.body.submissionId, 80);

  if (submissionId && isProcessedSubmission(submissionId)) {
    res.status(201).json({
      message: `Thanks, ${payload.contactName}. Zhuji will personally follow up about your mailing needs.`,
      emailSent: true,
      reservation: {
        companyName: payload.companyName,
        plan: payload.plan,
      },
    });
    return;
  }

  rememberSubmission(submissionId);

  const reservation = {
    id: `res_${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...payload,
  };

  let emailResult = { sent: false, method: null };

  try {
    emailResult = await sendLeadEmail(
      "New Reservation Request",
      {
        Type: "Quote inquiry",
        "Business name": payload.companyName,
        "Contact name": payload.contactName,
        Email: payload.email,
        Phone: payload.phone,
        Service: formatPlanLabel(payload.plan),
        Notes: payload.notes || "None",
        "Submitted at": reservation.createdAt,
      }
    );
  } catch (error) {
    console.error("Failed to send reservation email:", error.message);
  }

  try {
    submissions.reservations.unshift(reservation);
    await writeJson(SUBMISSIONS_FILE, submissions);
  } catch (error) {
    console.warn("Could not persist reservation locally:", error.message);
  }

  const successMessage = emailResult.sent
    ? `Thanks, ${payload.contactName}. Zhuji will personally follow up about your mailing needs.`
    : `Thanks, ${payload.contactName}. Your inquiry was saved, but email delivery failed. Please call (825) 993-3458.`;

  res.status(201).json({
    message: successMessage,
    emailSent: emailResult.sent,
    emailMethod: emailResult.method || null,
    reservation: {
      id: reservation.id,
      companyName: reservation.companyName,
      plan: reservation.plan,
      createdAt: reservation.createdAt,
    },
  });
});

app.get("/api/email-status", (_req, res) => {
  const notifyEmail = getNotifyEmail();
  const hasWeb3Forms = Boolean((process.env.WEB3FORMS_ACCESS_KEY || "").trim());
  const hasSmtp = Boolean((process.env.SMTP_USER || "").trim() && (process.env.SMTP_PASS || "").trim());

  res.json({
    ok: true,
    notifyEmail,
    web3formsConfigured: hasWeb3Forms,
    smtpConfigured: hasSmtp,
    hint: hasWeb3Forms
      ? "Web3Forms emails go to the inbox you used when creating the access key (check spam)."
      : "WEB3FORMS_ACCESS_KEY is missing on this host. Add it in Vercel Environment Variables, then Redeploy.",
  });
});

app.get("*", async (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }

  if (path.extname(req.path)) {
    res.status(404).type("text/plain").send(`File not found: ${req.path}`);
    return;
  }

  try {
    const body = await renderPublicFile("index.html", getSiteUrl(req));
    res.type("html").send(body);
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server." });
});

function logStartupInfo() {
  resolveLogoPath()
    .then((logoPath) => resolveHeroPostcardPath().then((heroPostcardPath) => ({ logoPath, heroPostcardPath })))
    .then(({ logoPath, heroPostcardPath }) => {
      console.log(`Last Stop Mail running on http://localhost:${PORT}`);
      console.log(`Site logo: ${logoPath}`);
      console.log(`Hero postcard: ${heroPostcardPath || "missing (add public/images/hero-postcard.jpg)"}`);

      if (process.env.WEB3FORMS_ACCESS_KEY) {
        console.log("Email delivery: Web3Forms (+ FormSubmit / Yahoo fallback) ->", getNotifyEmail());
      } else {
        console.log("Email delivery: FormSubmit (+ Yahoo fallback if SMTP set) ->", getNotifyEmail());
        console.warn("First FormSubmit inquiry may send an activation email — open it once in Yahoo.");
      }
    })
    .catch((error) => {
      console.error("Startup info failed:", error);
    });
}

function prepareApp() {
  return ensureDataFiles()
    .then(async () => {
      await loadEnvFile();
    })
    .catch((error) => {
      console.error("Failed to prepare app:", error);
      throw error;
    });
}

function getApp() {
  return app;
}

prepareApp().catch((error) => {
  console.error("Failed to prepare app:", error);
});

module.exports = app;
module.exports.app = app;
module.exports.getApp = getApp;
module.exports.prepareApp = prepareApp;

if (!IS_VERCEL && require.main === module) {
  prepareApp()
    .then(() => {
      logStartupInfo();
      app.listen(PORT);
    })
    .catch((error) => {
      console.error("Failed to start server:", error);
      process.exit(1);
    });
}
