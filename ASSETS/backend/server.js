const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const projectRoot = path.resolve(__dirname, "..", "..");
const pagesDir = path.join(projectRoot, "pages");
const frontendDir = path.join(projectRoot, "frontend");
const assetsDir = path.join(projectRoot, "ASSETS");
const dataDir = path.join(__dirname, "data");
const contentPath = path.join(__dirname, "content.json");
const leadsPath = path.join(dataDir, "leads.ndjson");
const reviewsPath = path.join(dataDir, "reviews.ndjson");
const ownerPath = path.join(dataDir, "owner.json");
const pageSettingsPath = path.join(dataDir, "page-settings.json");
const quoteMailboxPath = path.join(dataDir, "quote-mailbox.json");
const gmailOAuthConfigPath = path.join(dataDir, "gmail-oauth-client.json");
const gmailOAuthTokenPath = path.join(dataDir, "gmail-oauth-token.json");
const basePort = Number(process.env.PORT || 3000);
const sessionMaxAgeMs = 1000 * 60 * 60 * 12;
const sessionStore = new Map();
const gmailAuthStateStore = new Map();
const gmailScopes = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send"
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xml": "application/xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": mimeTypes[".json"],
    ...headers
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, buffer) => {
    if (error) {
      sendJson(response, 404, { error: "File not found" });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream"
    });
    response.end(buffer);
  });
}

function parseCookies(request) {
  return String(request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separator = part.indexOf("=");
      if (separator === -1) {
        return acc;
      }
      const key = decodeURIComponent(part.slice(0, separator).trim());
      const value = decodeURIComponent(part.slice(separator + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const candidate = crypto.scryptSync(String(password), salt, 64).toString("hex");
  const left = Buffer.from(candidate, "hex");
  const right = Buffer.from(expectedHash, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function nowIso() {
  return new Date().toISOString();
}

function createDefaultOwnerRecord() {
  const passwordSeed = process.env.AGU_OWNER_PASSWORD || "AGUAdmin!2026";
  const password = createPasswordHash(passwordSeed);
  const now = nowIso();

  return {
    id: "owner-1",
    role: "owner",
    fullName: "Agnieszka Kalina vel Kalinowska",
    displayName: "Agnieszka",
    businessName: "AGU Clean Services",
    tradingName: "AGU Clean Services",
    email: "agucleanservices@gmail.com",
    phone: "07448738971",
    website: "www.agucleanservices.co.uk",
    primaryCity: "Gateshead",
    serviceAreas: ["Gateshead", "Newcastle", "Chester-le-Street", "Durham"],
    workingHours: "Monday-Saturday 8:00-18:00, flexible by arrangement",
    legalFooter: "AGU Clean Services is a trading name of Agnieszka Kalina vel Kalinowska.",
    passwordHash: password.hash,
    passwordSalt: password.salt,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null
  };
}

function ensureOwnerAccount() {
  ensureDataDir();
  if (!fs.existsSync(ownerPath)) {
    fs.writeFileSync(ownerPath, JSON.stringify(createDefaultOwnerRecord(), null, 2), "utf8");
  }
}

function createDefaultPageSettings() {
  return {
    pages: [
      {
        id: "home",
        label: "Home",
        file: "index.html",
        route: "/",
        navLabel: "Home",
        published: true,
        metaTitle: "AGU CLEANING SERVICES | Home Cleaning Newcastle",
        metaDescription: "AGU CLEANING SERVICES offers reliable domestic and commercial cleaning in Newcastle, Gateshead, Chester-le-Street and Durham.",
        heroTitle: "Professional cleaning with a calm, polished finish.",
        heroLead: "AGU CLEANING SERVICES helps homes, offices and rental properties stay clean, presentable and ready for everyday life across Newcastle, Gateshead, Chester-le-Street and Durham."
      },
      {
        id: "about",
        label: "About Us",
        file: "about.html",
        route: "/about.html",
        navLabel: "About Us",
        published: true,
        metaTitle: "About | AGU CLEANING SERVICES",
        metaDescription: "Learn more about AGU Clean Services, our values and our local cleaning offer.",
        heroTitle: "About AGU Clean Services",
        heroLead: "Local, trusted and professional cleaning in Newcastle and beyond."
      },
      {
        id: "services",
        label: "Services",
        file: "services.html",
        route: "/services.html",
        navLabel: "Services",
        published: true,
        metaTitle: "Services | AGU CLEANING SERVICES",
        metaDescription: "View domestic, deep, tenancy, Airbnb and commercial cleaning services from AGU Clean Services.",
        heroTitle: "Clear services for homes, rentals and small businesses.",
        heroLead: "The offer is structured to be easy to understand at a glance and strong enough for both private clients and property-related work."
      },
      {
        id: "pricing",
        label: "Pricing",
        file: "prices.html",
        route: "/prices.html",
        navLabel: "Pricing",
        published: true,
        metaTitle: "Pricing | AGU CLEANING SERVICES",
        metaDescription: "Starting prices and quote information for AGU Clean Services.",
        heroTitle: "Simple starting prices with flexible quoting.",
        heroLead: "Public rates build trust quickly. Final quotes still depend on property size, condition, frequency and scope of work."
      },
      {
        id: "areas",
        label: "Areas We Cover",
        file: "areas.html",
        route: "/areas.html",
        navLabel: "Areas We Cover",
        published: true,
        metaTitle: "Areas We Cover | AGU CLEANING SERVICES",
        metaDescription: "Areas covered by AGU Clean Services for domestic, deep, tenancy and office cleaning.",
        heroTitle: "Cleaning services across Gateshead and nearby areas",
        heroLead: "AGU Clean Services supports homes, rental properties and small business spaces with dependable cleaning and flexible booking."
      },
      {
        id: "testimonials",
        label: "Testimonials",
        file: "reviews.html",
        route: "/reviews.html",
        navLabel: "Testimonials",
        published: true,
        metaTitle: "Testimonials | AGU CLEANING SERVICES",
        metaDescription: "Client feedback and testimonials for AGU Clean Services.",
        heroTitle: "What clients say about AGU Clean Services",
        heroLead: "Friendly, reliable service and strong results are the standards we want every booking to reflect."
      },
      {
        id: "contact",
        label: "Contact Us",
        file: "contact.html",
        route: "/contact.html",
        navLabel: "Contact Us",
        published: true,
        metaTitle: "Contact | AGU CLEANING SERVICES",
        metaDescription: "Contact AGU CLEANING SERVICES for a free quote by call, WhatsApp or contact form.",
        heroTitle: "Contact AGU Clean Services",
        heroLead: "Get a free quote by phone, WhatsApp or contact form. We aim to respond quickly and clearly."
      },
      {
        id: "privacy",
        label: "Privacy Policy",
        file: "privacy.html",
        route: "/privacy.html",
        navLabel: "Privacy Policy",
        published: true,
        metaTitle: "Privacy Policy | AGU CLEANING SERVICES",
        metaDescription: "Privacy policy for AGU Clean Services covering website enquiries and client data.",
        heroTitle: "Privacy Policy",
        heroLead: "This page explains how AGU Clean Services handles website enquiries and basic client data."
      },
      {
        id: "terms",
        label: "Terms & Conditions",
        file: "terms.html",
        route: "/terms.html",
        navLabel: "Terms & Conditions",
        published: true,
        metaTitle: "Terms & Conditions | AGU CLEANING SERVICES",
        metaDescription: "Terms and conditions for AGU Clean Services bookings and cleaning work.",
        heroTitle: "Terms and Conditions",
        heroLead: "These terms outline the basic booking and service conditions for AGU Clean Services."
      }
    ]
  };
}

function ensurePageSettingsFile() {
  ensureDataDir();
  if (!fs.existsSync(pageSettingsPath)) {
    fs.writeFileSync(pageSettingsPath, JSON.stringify(createDefaultPageSettings(), null, 2), "utf8");
  }
}

function readJsonFileIfExists(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function createDefaultQuoteMailbox() {
  const owner = readOwner();
  return {
    gmailAccount: owner.email || "agucleanservices@gmail.com",
    provider: "gmail-compose",
    updatedAt: nowIso(),
    outbox: []
  };
}

function ensureQuoteMailboxFile() {
  ensureDataDir();
  if (!fs.existsSync(quoteMailboxPath)) {
    fs.writeFileSync(quoteMailboxPath, JSON.stringify(createDefaultQuoteMailbox(), null, 2), "utf8");
  }
}

function readOwner() {
  ensureOwnerAccount();
  return JSON.parse(fs.readFileSync(ownerPath, "utf8"));
}

function writeOwner(owner) {
  ensureDataDir();
  fs.writeFileSync(ownerPath, JSON.stringify(owner, null, 2), "utf8");
}

function readPageSettings() {
  ensurePageSettingsFile();
  return JSON.parse(fs.readFileSync(pageSettingsPath, "utf8"));
}

function writePageSettings(settings) {
  ensureDataDir();
  fs.writeFileSync(pageSettingsPath, JSON.stringify(settings, null, 2), "utf8");
}

function readQuoteMailbox() {
  ensureQuoteMailboxFile();
  return JSON.parse(fs.readFileSync(quoteMailboxPath, "utf8"));
}

function writeQuoteMailbox(mailbox) {
  ensureDataDir();
  fs.writeFileSync(quoteMailboxPath, JSON.stringify(mailbox, null, 2), "utf8");
}

function getGmailOAuthConfig() {
  const fileConfig = readJsonFileIfExists(gmailOAuthConfigPath, {}) || {};
  const clientId = String(process.env.GOOGLE_CLIENT_ID || fileConfig.clientId || "").trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || fileConfig.clientSecret || "").trim();
  const redirectUri = String(
    process.env.GOOGLE_REDIRECT_URI ||
    fileConfig.redirectUri ||
    `http://localhost:${basePort}/api/admin/gmail/callback`
  ).trim();

  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret && redirectUri)
  };
}

function readGmailOAuthToken() {
  return readJsonFileIfExists(gmailOAuthTokenPath, null);
}

function writeGmailOAuthToken(token) {
  ensureDataDir();
  fs.writeFileSync(gmailOAuthTokenPath, JSON.stringify(token, null, 2), "utf8");
}

function clearGmailOAuthToken() {
  if (fs.existsSync(gmailOAuthTokenPath)) {
    fs.unlinkSync(gmailOAuthTokenPath);
  }
}

function getPublicOwnerProfile(owner = readOwner()) {
  return {
    id: owner.id,
    role: owner.role,
    fullName: owner.fullName,
    displayName: owner.displayName,
    businessName: owner.businessName,
    tradingName: owner.tradingName,
    email: owner.email,
    phone: owner.phone,
    website: owner.website,
    primaryCity: owner.primaryCity,
    serviceAreas: owner.serviceAreas,
    workingHours: owner.workingHours,
    legalFooter: owner.legalFooter,
    createdAt: owner.createdAt,
    updatedAt: owner.updatedAt,
    lastLoginAt: owner.lastLoginAt
  };
}

function createSession(owner) {
  const token = crypto.randomBytes(24).toString("hex");
  const session = {
    token,
    ownerId: owner.id,
    createdAt: nowIso(),
    expiresAt: Date.now() + sessionMaxAgeMs
  };
  sessionStore.set(token, session);
  return session;
}

function getSession(request) {
  const cookies = parseCookies(request);
  const token = cookies["agu_admin_session"];
  if (!token) {
    return null;
  }

  const session = sessionStore.get(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessionStore.delete(token);
    return null;
  }

  return session;
}

function clearExpiredSessions() {
  for (const [token, session] of sessionStore.entries()) {
    if (session.expiresAt <= Date.now()) {
      sessionStore.delete(token);
    }
  }

  for (const [state, entry] of gmailAuthStateStore.entries()) {
    if (Date.now() - Number(entry.createdAt || 0) > 1000 * 60 * 15) {
      gmailAuthStateStore.delete(state);
    }
  }
}

function makeSessionCookie(token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  return `agu_admin_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}`;
}

function makeExpiredSessionCookie() {
  return "agu_admin_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0";
}

function requireAdmin(request, response) {
  const session = getSession(request);
  if (!session) {
    sendJson(response, 401, {
      ok: false,
      error: "Authentication required"
    });
    return null;
  }

  return session;
}

function readContent() {
  return JSON.parse(fs.readFileSync(contentPath, "utf8"));
}

function writeContent(content) {
  fs.writeFileSync(contentPath, JSON.stringify(content, null, 2), "utf8");
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function parseJsonBody(body) {
  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "entry";
}

function makeLeadId(type, payload) {
  return `${type}-${slugify(payload.name || payload.service || "entry")}-${Date.now()}`;
}

function makeReviewId(payload) {
  return `review-${slugify(payload.name || payload.email || "review")}-${Date.now()}`;
}

function makeOutboxId(payload) {
  return `quote-mail-${slugify(payload.customerName || payload.recipientEmail || "draft")}-${Date.now()}`;
}

function readEntries(filePath) {
  ensureDataDir();

  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function writeEntries(filePath, entries) {
  ensureDataDir();
  const output = entries.map((entry) => JSON.stringify(entry)).join("\n");
  fs.writeFileSync(filePath, output ? `${output}\n` : "", "utf8");
}

function readLeads() {
  return readEntries(leadsPath);
}

function writeLeads(leads) {
  writeEntries(leadsPath, leads);
}

function appendLead(type, payload) {
  const leads = readLeads();
  const timestamp = nowIso();
  const entry = {
    id: makeLeadId(type, payload),
    type,
    source: payload.source || (type === "quote" ? "quote-form" : "contact-form"),
    status: "new",
    priority: payload.priority || "medium",
    notes: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...payload
  };
  leads.push(entry);
  writeLeads(leads);
  return entry;
}

function readReviews() {
  return readEntries(reviewsPath);
}

function writeReviews(reviews) {
  writeEntries(reviewsPath, reviews);
}

function appendReview(payload) {
  const reviews = readReviews();
  const timestamp = nowIso();
  const normalizedRating = Math.min(Math.max(Number(payload.rating || 0), 1), 5) || 1;
  const entry = {
    id: makeReviewId(payload),
    status: "pending",
    published: false,
    response: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...payload,
    rating: normalizedRating
  };
  reviews.push(entry);
  writeReviews(reviews);
  return entry;
}

function sortByNewest(items) {
  return items.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function buildStats(leads, reviews) {
  const statusCounts = leads.reduce((acc, lead) => {
    const key = lead.status || "new";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const priorityCounts = leads.reduce((acc, lead) => {
    const key = lead.priority || "medium";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const serviceCounts = leads.reduce((acc, lead) => {
    const key = lead.service || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const quoteLeads = leads.filter((lead) => lead.type === "quote");
  const contactLeads = leads.filter((lead) => lead.type === "contact");

  return {
    totalLeads: leads.length,
    contactLeads: contactLeads.length,
    quoteLeads: quoteLeads.length,
    totalReviews: reviews.length,
    pendingReviews: reviews.filter((review) => review.status === "pending").length,
    reviewedReviews: reviews.filter((review) => review.status === "reviewed").length,
    publishedReviews: reviews.filter((review) => review.published).length,
    statusCounts,
    priorityCounts,
    serviceCounts,
    recentLeads: sortByNewest(leads).slice(0, 10),
    recentReviews: sortByNewest(reviews).slice(0, 10)
  };
}

function normalizeServiceEntries(items) {
  return Array.isArray(items)
    ? items
        .map((item) => ({
          title: String(item && item.title ? item.title : "").trim(),
          description: String(item && item.description ? item.description : "").trim()
        }))
        .filter((item) => item.title || item.description)
    : [];
}

function normalizePricingEntries(items) {
  return Array.isArray(items)
    ? items
        .map((item) => ({
          service: String(item && item.service ? item.service : "").trim(),
          price: String(item && item.price ? item.price : "").trim()
        }))
        .filter((item) => item.service || item.price)
    : [];
}

function normalizeLinks(items) {
  return Array.isArray(items)
    ? items
        .map((item) => ({
          label: String(item && item.label ? item.label : "").trim(),
          href: String(item && item.href ? item.href : "").trim()
        }))
        .filter((item) => item.label || item.href)
    : [];
}

function normalizePageSettingsPayload(payload) {
  const pages = Array.isArray(payload && payload.pages) ? payload.pages : [];
  return {
    pages: pages.map((page) => ({
      id: String(page.id || "").trim(),
      label: String(page.label || "").trim(),
      file: String(page.file || "").trim(),
      route: String(page.route || "").trim(),
      navLabel: String(page.navLabel || "").trim(),
      published: Boolean(page.published),
      metaTitle: String(page.metaTitle || "").trim(),
      metaDescription: String(page.metaDescription || "").trim(),
      heroTitle: String(page.heroTitle || "").trim(),
      heroLead: String(page.heroLead || "").trim()
    })).filter((page) => page.id && page.file)
  };
}

function normalizeOutboxEntry(payload, current = {}) {
  const status = String(payload.status || current.status || "draft").trim() || "draft";
  const next = {
    id: current.id || makeOutboxId(payload),
    leadId: String(payload.leadId || current.leadId || "").trim(),
    customerName: String(payload.customerName || current.customerName || "").trim(),
    recipientEmail: String(payload.recipientEmail || current.recipientEmail || "").trim(),
    subject: String(payload.subject || current.subject || "").trim(),
    message: String(payload.message || current.message || "").trim(),
    service: String(payload.service || current.service || "").trim(),
    phone: String(payload.phone || current.phone || "").trim(),
    internalNotes: String(payload.internalNotes || current.internalNotes || "").trim(),
    status,
    gmailAccount: String(payload.gmailAccount || current.gmailAccount || "").trim(),
    updatedAt: nowIso(),
    createdAt: current.createdAt || nowIso(),
    sentAt: current.sentAt || null
  };

  if (status === "sent" && !next.sentAt) {
    next.sentAt = nowIso();
  }

  if (status !== "sent" && payload.status && current.sentAt && payload.status !== "sent") {
    next.sentAt = null;
  }

  return next;
}

function getQuoteMailboxPayload() {
  const mailbox = readQuoteMailbox();
  const inbox = sortByNewest(readLeads().filter((lead) => lead.type === "quote"));
  const outbox = sortByNewest(Array.isArray(mailbox.outbox) ? mailbox.outbox : []);
  return {
    gmail: {
      provider: mailbox.provider || "gmail-compose",
      account: mailbox.gmailAccount || readOwner().email || "agucleanservices@gmail.com",
      mode: "browser-compose",
      connected: true
    },
    inbox,
    outbox
  };
}

function encodeBase64Url(value) {
  return Buffer.from(String(value || ""), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function parseHeaderMap(headers) {
  return Array.isArray(headers)
    ? headers.reduce((acc, header) => {
        const name = String(header.name || "").toLowerCase();
        if (name) {
          acc[name] = String(header.value || "");
        }
        return acc;
      }, {})
    : {};
}

function collectBodyText(part) {
  if (!part) {
    return "";
  }

  if (part.body && part.body.data && String(part.mimeType || "").startsWith("text/plain")) {
    return decodeBase64Url(part.body.data);
  }

  if (Array.isArray(part.parts)) {
    for (const child of part.parts) {
      const value = collectBodyText(child);
      if (value) {
        return value;
      }
    }
  }

  if (part.body && part.body.data && String(part.mimeType || "").startsWith("text/html")) {
    return decodeBase64Url(part.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return "";
}

function normalizeGmailMessage(message) {
  const headers = parseHeaderMap(message.payload && message.payload.headers);
  return {
    id: message.id,
    threadId: message.threadId,
    labelIds: Array.isArray(message.labelIds) ? message.labelIds : [],
    snippet: message.snippet || "",
    historyId: message.historyId || "",
    internalDate: message.internalDate ? Number(message.internalDate) : 0,
    from: headers.from || "",
    to: headers.to || "",
    subject: headers.subject || "",
    date: headers.date || "",
    bodyText: collectBodyText(message.payload || {}),
    rawHeaders: headers
  };
}

function getGmailStatusPayload() {
  const config = getGmailOAuthConfig();
  const token = readGmailOAuthToken();
  return {
    configured: config.configured,
    connected: Boolean(token && token.refreshToken),
    redirectUri: config.redirectUri,
    scopes: gmailScopes,
    emailAddress: token && token.emailAddress ? token.emailAddress : "",
    tokenExpiryDate: token && token.expiryDate ? token.expiryDate : null
  };
}

function createGmailAuthUrl(ownerId) {
  const config = getGmailOAuthConfig();
  if (!config.configured) {
    throw new Error("Gmail OAuth is not configured");
  }

  const state = crypto.randomBytes(24).toString("hex");
  gmailAuthStateStore.set(state, {
    ownerId,
    createdAt: Date.now()
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: gmailScopes.join(" "),
    state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeGoogleOAuthCode(code) {
  const config = getGmailOAuthConfig();
  const body = new URLSearchParams({
    code: String(code || ""),
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || "Google token exchange failed");
  }

  return payload;
}

async function refreshGoogleOAuthToken(refreshToken) {
  const config = getGmailOAuthConfig();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: String(refreshToken || ""),
    grant_type: "refresh_token"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || "Google token refresh failed");
  }

  return payload;
}

async function getValidGmailAccessToken() {
  const token = readGmailOAuthToken();
  if (!token || !token.refreshToken) {
    throw new Error("Gmail account is not connected");
  }

  const now = Date.now();
  if (token.accessToken && token.expiryDate && now < Number(token.expiryDate) - 60 * 1000) {
    return token;
  }

  const refreshed = await refreshGoogleOAuthToken(token.refreshToken);
  const nextToken = {
    ...token,
    accessToken: refreshed.access_token,
    expiryDate: now + (Number(refreshed.expires_in || 3600) * 1000),
    scope: refreshed.scope || token.scope,
    tokenType: refreshed.token_type || token.tokenType || "Bearer",
    updatedAt: nowIso()
  };
  writeGmailOAuthToken(nextToken);
  return nextToken;
}

async function gmailApiRequest(pathname, options = {}) {
  const token = await getValidGmailAccessToken();
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${pathname}`, {
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      ...(options.headers || {})
    },
    method: options.method || "GET",
    body: options.body
  });

  const contentType = String(response.headers.get("content-type") || "");
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const detail = payload && typeof payload === "object"
      ? payload.error?.message || payload.error_description || payload.error
      : payload;
    throw new Error(detail || "Gmail API request failed");
  }

  return payload;
}

async function fetchGmailProfileAndPersistEmail() {
  const profile = await gmailApiRequest("profile");
  const token = readGmailOAuthToken();
  if (token) {
    token.emailAddress = profile.emailAddress || token.emailAddress || "";
    token.updatedAt = nowIso();
    writeGmailOAuthToken(token);
  }
  return profile;
}

async function listGmailMessages({ label = "INBOX", query = "", maxResults = 15 } = {}) {
  const params = new URLSearchParams({
    maxResults: String(Math.max(1, Math.min(50, Number(maxResults) || 15)))
  });
  if (label) {
    params.append("labelIds", label);
  }
  if (query) {
    params.set("q", String(query));
  }

  const listPayload = await gmailApiRequest(`messages?${params.toString()}`);
  const messageRefs = Array.isArray(listPayload.messages) ? listPayload.messages : [];
  const messages = [];
  for (const ref of messageRefs) {
    const detail = await gmailApiRequest(`messages/${encodeURIComponent(ref.id)}?format=full`);
    messages.push(normalizeGmailMessage(detail));
  }
  return messages.sort((a, b) => Number(b.internalDate || 0) - Number(a.internalDate || 0));
}

async function getGmailMessageById(messageId) {
  const payload = await gmailApiRequest(`messages/${encodeURIComponent(messageId)}?format=full`);
  return normalizeGmailMessage(payload);
}

function buildRawEmail({ to, subject, message, from, replyTo }) {
  const lines = [];
  if (from) {
    lines.push(`From: ${from}`);
  }
  lines.push(`To: ${to}`);
  if (replyTo) {
    lines.push(`Reply-To: ${replyTo}`);
  }
  lines.push(`Subject: ${subject}`);
  lines.push("MIME-Version: 1.0");
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push("");
  lines.push(message);
  return encodeBase64Url(lines.join("\r\n"));
}

async function sendGmailMessage({ to, subject, message, threadId, replyTo }) {
  const token = await getValidGmailAccessToken();
  const profileEmail = token.emailAddress || "";
  const payload = {
    raw: buildRawEmail({ to, subject, message, from: profileEmail, replyTo })
  };
  if (threadId) {
    payload.threadId = threadId;
  }

  const response = await gmailApiRequest("messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!token.emailAddress) {
    await fetchGmailProfileAndPersistEmail();
  }

  return response;
}

function sanitizePath(baseDir, relativePath) {
  const filePath = path.normalize(path.join(baseDir, relativePath));
  return filePath.startsWith(baseDir) ? filePath : null;
}

function serveStatic(response, pathname) {
  const staticRoutes = [
    { prefix: "/frontend/", baseDir: frontendDir },
    { prefix: "/ASSETS/", baseDir: assetsDir },
    { prefix: "/pages/", baseDir: pagesDir }
  ];

  for (const route of staticRoutes) {
    if (!pathname.startsWith(route.prefix)) {
      continue;
    }

    const relativePath = pathname.slice(route.prefix.length);
    const filePath = sanitizePath(route.baseDir, relativePath);

    if (!filePath) {
      sendJson(response, 403, { error: "Forbidden" });
      return true;
    }

    sendFile(response, filePath);
    return true;
  }

  const rootFiles = new Set([
    "/index.html",
    "/robots.txt",
    "/sitemap.xml",
    "/google8ddd51217d689627.html",
    "/styles.css",
    "/styles-v1.1.css",
    "/site.js",
    "/README.md"
  ]);

  if (rootFiles.has(pathname)) {
    sendFile(response, path.join(projectRoot, pathname.slice(1)));
    return true;
  }

  if (pathname.endsWith(".html")) {
    const filePath = sanitizePath(pagesDir, pathname.replace(/^\/+/, ""));
    if (filePath && fs.existsSync(filePath)) {
      sendFile(response, filePath);
      return true;
    }
  }

  return false;
}

async function handleApi(request, response, pathname, url) {
  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      status: "healthy",
      service: "agu-clean-services-backend",
      port: basePort,
      timestamp: nowIso()
    });
    return true;
  }

  if (pathname === "/api/content" && request.method === "GET") {
    sendJson(response, 200, readContent());
    return true;
  }

  if (pathname === "/api/pages" && request.method === "GET") {
    sendJson(response, 200, {
      home: "/",
      about: "/about.html",
      services: "/services.html",
      prices: "/prices.html",
      areas: "/areas.html",
      reviews: "/reviews.html",
      contact: "/contact.html",
      privacy: "/privacy.html",
      terms: "/terms.html",
      dashboard: "/ADMIN/dashboard.html",
      adminQuotes: "/ADMIN/quotes.html"
    });
    return true;
  }

  if (pathname === "/api/services" && request.method === "GET") {
    sendJson(response, 200, readContent().services || []);
    return true;
  }

  if ((pathname === "/api/contact" || pathname === "/api/quote") && request.method === "POST") {
    try {
      const payload = parseJsonBody(await readRequestBody(request));
      const leadType = pathname.endsWith("/quote") ? "quote" : "contact";
      const entry = appendLead(leadType, payload);
      sendJson(response, 200, {
        ok: true,
        message: leadType === "quote" ? "Quote request saved locally" : "Enquiry saved locally",
        lead: entry
      });
    } catch {
      sendJson(response, 400, { ok: false, error: "Invalid JSON payload" });
    }
    return true;
  }

  if (pathname === "/api/review" && request.method === "POST") {
    try {
      const payload = parseJsonBody(await readRequestBody(request));
      const review = appendReview(payload);
      sendJson(response, 200, {
        ok: true,
        message: "Review saved locally",
        review
      });
    } catch {
      sendJson(response, 400, { ok: false, error: "Invalid JSON payload" });
    }
    return true;
  }

  if (pathname === "/api/admin/gmail/status" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, {
      ok: true,
      gmail: getGmailStatusPayload()
    });
    return true;
  }

  if (pathname === "/api/admin/gmail/connect" && request.method === "GET") {
    const session = requireAdmin(request, response);
    if (!session) {
      return true;
    }

    try {
      const authUrl = createGmailAuthUrl(session.ownerId);
      response.writeHead(302, { Location: authUrl });
      response.end();
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (pathname === "/api/admin/gmail/callback" && request.method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      response.writeHead(302, { Location: `/ADMIN/quotes.html?gmail_error=${encodeURIComponent(error)}` });
      response.end();
      return true;
    }

    const stateEntry = state ? gmailAuthStateStore.get(state) : null;
    if (!code || !stateEntry) {
      response.writeHead(302, { Location: "/ADMIN/quotes.html?gmail_error=invalid_callback" });
      response.end();
      return true;
    }

    gmailAuthStateStore.delete(state);

    try {
      const tokenPayload = await exchangeGoogleOAuthCode(code);
      const token = {
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token || "",
        expiryDate: Date.now() + (Number(tokenPayload.expires_in || 3600) * 1000),
        scope: tokenPayload.scope || gmailScopes.join(" "),
        tokenType: tokenPayload.token_type || "Bearer",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        emailAddress: ""
      };
      writeGmailOAuthToken(token);
      await fetchGmailProfileAndPersistEmail();
      response.writeHead(302, { Location: "/ADMIN/quotes.html?gmail_connected=1" });
      response.end();
    } catch (exchangeError) {
      response.writeHead(302, { Location: `/ADMIN/quotes.html?gmail_error=${encodeURIComponent(exchangeError.message)}` });
      response.end();
    }
    return true;
  }

  if (pathname === "/api/admin/gmail/disconnect" && request.method === "POST") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    clearGmailOAuthToken();
    sendJson(response, 200, { ok: true, disconnected: true });
    return true;
  }

  if (pathname === "/api/admin/gmail/messages" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    try {
      const label = String(url.searchParams.get("label") || "INBOX").trim();
      const query = String(url.searchParams.get("q") || "").trim();
      const maxResults = Number(url.searchParams.get("maxResults") || 15);
      const messages = await listGmailMessages({ label, query, maxResults });
      sendJson(response, 200, { ok: true, label, query, messages });
    } catch (gmailError) {
      sendJson(response, 400, { ok: false, error: gmailError.message });
    }
    return true;
  }

  if (pathname.startsWith("/api/admin/gmail/messages/") && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    try {
      const messageId = pathname.slice("/api/admin/gmail/messages/".length);
      const message = await getGmailMessageById(messageId);
      sendJson(response, 200, { ok: true, message });
    } catch (gmailError) {
      sendJson(response, 400, { ok: false, error: gmailError.message });
    }
    return true;
  }

  if (pathname === "/api/admin/gmail/send" && request.method === "POST") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    try {
      const payload = parseJsonBody(await readRequestBody(request));
      const to = String(payload.to || "").trim();
      const subject = String(payload.subject || "").trim();
      const message = String(payload.message || "").trim();
      const replyTo = String(payload.replyTo || "").trim();
      const threadId = String(payload.threadId || "").trim();

      if (!to || !subject || !message) {
        sendJson(response, 400, { ok: false, error: "To, subject and message are required" });
        return true;
      }

      const sent = await sendGmailMessage({ to, subject, message, threadId, replyTo });
      sendJson(response, 200, { ok: true, sent });
    } catch (gmailError) {
      sendJson(response, 400, { ok: false, error: gmailError.message });
    }
    return true;
  }

  if (pathname === "/api/admin/login" && request.method === "POST") {
    try {
      const payload = parseJsonBody(await readRequestBody(request));
      const owner = readOwner();
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");

      const emailMatches = email && email === String(owner.email || "").trim().toLowerCase();
      const passwordMatches = verifyPassword(password, owner.passwordSalt, owner.passwordHash);

      if (!emailMatches || !passwordMatches) {
        sendJson(response, 401, {
          ok: false,
          error: "Invalid owner credentials"
        });
        return true;
      }

      const session = createSession(owner);
      owner.lastLoginAt = nowIso();
      owner.updatedAt = nowIso();
      writeOwner(owner);

      sendJson(response, 200, {
        ok: true,
        message: "Owner login successful",
        owner: getPublicOwnerProfile(owner)
      }, {
        "Set-Cookie": makeSessionCookie(session.token, session.expiresAt)
      });
    } catch {
      sendJson(response, 400, { ok: false, error: "Invalid JSON payload" });
    }
    return true;
  }

  if (pathname === "/api/admin/logout" && request.method === "POST") {
    const session = getSession(request);
    if (session) {
      sessionStore.delete(session.token);
    }

    sendJson(response, 200, {
      ok: true,
      message: "Logged out"
    }, {
      "Set-Cookie": makeExpiredSessionCookie()
    });
    return true;
  }

  if (pathname === "/api/admin/session" && request.method === "GET") {
    const session = requireAdmin(request, response);
    if (!session) {
      return true;
    }

    sendJson(response, 200, {
      ok: true,
      authenticated: true,
      owner: getPublicOwnerProfile()
    });
    return true;
  }

  if (pathname === "/api/admin/profile" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, {
      ok: true,
      owner: getPublicOwnerProfile()
    });
    return true;
  }

  if (pathname === "/api/admin/profile" && request.method === "PATCH") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    try {
      const payload = parseJsonBody(await readRequestBody(request));
      const owner = readOwner();

      owner.fullName = String(payload.fullName || owner.fullName).trim() || owner.fullName;
      owner.displayName = String(payload.displayName || owner.displayName).trim() || owner.displayName;
      owner.email = String(payload.email || owner.email).trim() || owner.email;
      owner.phone = String(payload.phone || owner.phone).trim() || owner.phone;
      owner.website = String(payload.website || owner.website).trim() || owner.website;

      if (payload.currentPassword && payload.newPassword) {
        if (!verifyPassword(payload.currentPassword, owner.passwordSalt, owner.passwordHash)) {
          sendJson(response, 400, { ok: false, error: "Current password is incorrect" });
          return true;
        }

        if (String(payload.newPassword).length < 8) {
          sendJson(response, 400, { ok: false, error: "New password must be at least 8 characters" });
          return true;
        }

        const password = createPasswordHash(payload.newPassword);
        owner.passwordSalt = password.salt;
        owner.passwordHash = password.hash;
      }

      owner.updatedAt = nowIso();
      writeOwner(owner);

      sendJson(response, 200, {
        ok: true,
        owner: getPublicOwnerProfile(owner)
      });
    } catch {
      sendJson(response, 400, { ok: false, error: "Invalid JSON payload" });
    }
    return true;
  }

  if (pathname === "/api/admin/business" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    const owner = readOwner();
    sendJson(response, 200, {
      ok: true,
      business: {
        businessName: owner.businessName,
        tradingName: owner.tradingName,
        primaryCity: owner.primaryCity,
        serviceAreas: owner.serviceAreas,
        workingHours: owner.workingHours,
        legalFooter: owner.legalFooter
      }
    });
    return true;
  }

  if (pathname === "/api/admin/business" && request.method === "PATCH") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    try {
      const payload = parseJsonBody(await readRequestBody(request));
      const owner = readOwner();

      owner.businessName = String(payload.businessName || owner.businessName).trim() || owner.businessName;
      owner.tradingName = String(payload.tradingName || owner.tradingName).trim() || owner.tradingName;
      owner.primaryCity = String(payload.primaryCity || owner.primaryCity).trim() || owner.primaryCity;
      owner.workingHours = String(payload.workingHours || owner.workingHours).trim() || owner.workingHours;
      owner.legalFooter = String(payload.legalFooter || owner.legalFooter).trim() || owner.legalFooter;

      if (Array.isArray(payload.serviceAreas)) {
        owner.serviceAreas = payload.serviceAreas
          .map((item) => String(item || "").trim())
          .filter(Boolean);
      }

      owner.updatedAt = nowIso();
      writeOwner(owner);

      sendJson(response, 200, {
        ok: true,
        business: {
          businessName: owner.businessName,
          tradingName: owner.tradingName,
          primaryCity: owner.primaryCity,
          serviceAreas: owner.serviceAreas,
          workingHours: owner.workingHours,
          legalFooter: owner.legalFooter
        }
      });
    } catch {
      sendJson(response, 400, { ok: false, error: "Invalid JSON payload" });
    }
    return true;
  }

  if (pathname === "/api/admin/content" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, {
      ok: true,
      content: readContent()
    });
    return true;
  }

  if (pathname === "/api/admin/content" && request.method === "PATCH") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    try {
      const payload = parseJsonBody(await readRequestBody(request));
      const content = readContent();

      if (payload.brand) {
        content.brand = {
          ...content.brand,
          name: String(payload.brand.name || content.brand.name || "").trim(),
          tagline: String(payload.brand.tagline || content.brand.tagline || "").trim(),
          phone: String(payload.brand.phone || content.brand.phone || "").trim(),
          whatsapp: String(payload.brand.whatsapp || content.brand.whatsapp || "").trim(),
          email: String(payload.brand.email || content.brand.email || "").trim(),
          website: String(payload.brand.website || content.brand.website || "").trim(),
          areas: Array.isArray(payload.brand.areas)
            ? payload.brand.areas.map((item) => String(item || "").trim()).filter(Boolean)
            : content.brand.areas
        };
      }

      if (payload.services) {
        content.services = normalizeServiceEntries(payload.services);
      }

      if (payload.pricing) {
        content.pricing = normalizePricingEntries(payload.pricing);
      }

      if (payload.launchPlan) {
        content.launchPlan = Array.isArray(payload.launchPlan)
          ? payload.launchPlan.map((item) => String(item || "").trim()).filter(Boolean)
          : content.launchPlan;
      }

      if (payload.links) {
        content.links = normalizeLinks(payload.links);
      }

      writeContent(content);
      sendJson(response, 200, { ok: true, content });
    } catch {
      sendJson(response, 400, { ok: false, error: "Invalid JSON payload" });
    }
    return true;
  }

  if (pathname === "/api/admin/page-settings" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, {
      ok: true,
      pageSettings: readPageSettings()
    });
    return true;
  }

  if (pathname === "/api/admin/page-settings" && request.method === "PUT") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    try {
      const payload = parseJsonBody(await readRequestBody(request));
      const settings = normalizePageSettingsPayload(payload);
      writePageSettings(settings);
      sendJson(response, 200, { ok: true, pageSettings: settings });
    } catch {
      sendJson(response, 400, { ok: false, error: "Invalid JSON payload" });
    }
    return true;
  }

  if (pathname === "/api/admin/stats" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, buildStats(readLeads(), readReviews()));
    return true;
  }

  if (pathname === "/api/admin/leads" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, sortByNewest(readLeads()));
    return true;
  }

  if (pathname === "/api/admin/quotes" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, sortByNewest(readLeads().filter((lead) => lead.type === "quote")));
    return true;
  }

  if (pathname === "/api/admin/quote-mailbox" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, {
      ok: true,
      ...getQuoteMailboxPayload()
    });
    return true;
  }

  if (pathname === "/api/admin/quote-mailbox/outbox" && request.method === "POST") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    try {
      const payload = parseJsonBody(await readRequestBody(request));
      const mailbox = readQuoteMailbox();
      const entry = normalizeOutboxEntry({
        ...payload,
        gmailAccount: payload.gmailAccount || mailbox.gmailAccount || readOwner().email
      });

      mailbox.gmailAccount = String(payload.gmailAccount || mailbox.gmailAccount || readOwner().email || "").trim();
      mailbox.updatedAt = nowIso();
      mailbox.outbox = Array.isArray(mailbox.outbox) ? mailbox.outbox : [];
      mailbox.outbox.push(entry);
      writeQuoteMailbox(mailbox);

      sendJson(response, 200, { ok: true, entry });
    } catch {
      sendJson(response, 400, { ok: false, error: "Invalid JSON payload" });
    }
    return true;
  }

  if (pathname.startsWith("/api/admin/quote-mailbox/outbox/") && request.method === "PATCH") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    const entryId = pathname.slice("/api/admin/quote-mailbox/outbox/".length);

    try {
      const payload = parseJsonBody(await readRequestBody(request));
      const mailbox = readQuoteMailbox();
      const outbox = Array.isArray(mailbox.outbox) ? mailbox.outbox : [];
      const entry = outbox.find((item) => item.id === entryId);

      if (!entry) {
        sendJson(response, 404, { ok: false, error: "Outbox item not found" });
        return true;
      }

      const nextEntry = normalizeOutboxEntry(payload, entry);
      Object.assign(entry, nextEntry);
      mailbox.gmailAccount = String(payload.gmailAccount || mailbox.gmailAccount || readOwner().email || "").trim();
      mailbox.updatedAt = nowIso();
      writeQuoteMailbox(mailbox);

      if (entry.leadId && payload.syncLeadStatus) {
        const leads = readLeads();
        const lead = leads.find((item) => item.id === entry.leadId);
        if (lead) {
          lead.status = String(payload.syncLeadStatus).trim() || lead.status;
          lead.updatedAt = nowIso();
          writeLeads(leads);
        }
      }

      sendJson(response, 200, { ok: true, entry });
    } catch {
      sendJson(response, 400, { ok: false, error: "Invalid JSON payload" });
    }
    return true;
  }

  if (pathname.startsWith("/api/admin/quote-mailbox/outbox/") && request.method === "DELETE") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    const entryId = pathname.slice("/api/admin/quote-mailbox/outbox/".length);
    const mailbox = readQuoteMailbox();
    const outbox = Array.isArray(mailbox.outbox) ? mailbox.outbox : [];
    const index = outbox.findIndex((item) => item.id === entryId);

    if (index === -1) {
      sendJson(response, 404, { ok: false, error: "Outbox item not found" });
      return true;
    }

    const [removed] = outbox.splice(index, 1);
    mailbox.outbox = outbox;
    mailbox.updatedAt = nowIso();
    writeQuoteMailbox(mailbox);
    sendJson(response, 200, { ok: true, entry: removed });
    return true;
  }

  if (pathname === "/api/admin/contacts" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, sortByNewest(readLeads().filter((lead) => lead.type === "contact")));
    return true;
  }

  if (pathname.startsWith("/api/admin/leads/") && request.method === "PATCH") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    const leadId = pathname.slice("/api/admin/leads/".length);
    const leads = readLeads();
    const lead = leads.find((item) => item.id === leadId);

    if (!lead) {
      sendJson(response, 404, { ok: false, error: "Lead not found" });
      return true;
    }

    try {
      const payload = parseJsonBody(await readRequestBody(request));

      if (payload.status) {
        lead.status = String(payload.status);
      }
      if (payload.priority) {
        lead.priority = String(payload.priority);
      }
      if (typeof payload.notes === "string") {
        lead.notes = payload.notes;
      }

      lead.updatedAt = nowIso();
      writeLeads(leads);
      sendJson(response, 200, { ok: true, lead });
    } catch {
      sendJson(response, 400, { ok: false, error: "Invalid JSON payload" });
    }
    return true;
  }

  if (pathname === "/api/admin/reviews" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, sortByNewest(readReviews()));
    return true;
  }

  if (pathname.startsWith("/api/admin/reviews/") && request.method === "PATCH") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    const reviewId = pathname.slice("/api/admin/reviews/".length);
    const reviews = readReviews();
    const review = reviews.find((item) => item.id === reviewId);

    if (!review) {
      sendJson(response, 404, { ok: false, error: "Review not found" });
      return true;
    }

    try {
      const payload = parseJsonBody(await readRequestBody(request));

      if (payload.status) {
        review.status = String(payload.status);
      }
      if (typeof payload.published === "boolean") {
        review.published = payload.published;
      }
      if (typeof payload.response === "string") {
        review.response = payload.response;
      }

      review.updatedAt = nowIso();
      writeReviews(reviews);
      sendJson(response, 200, { ok: true, review });
    } catch {
      sendJson(response, 400, { ok: false, error: "Invalid JSON payload" });
    }
    return true;
  }

  if (pathname.startsWith("/api/admin/reviews/") && request.method === "DELETE") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    const reviewId = pathname.slice("/api/admin/reviews/".length);
    const reviews = readReviews();
    const index = reviews.findIndex((item) => item.id === reviewId);

    if (index === -1) {
      sendJson(response, 404, { ok: false, error: "Review not found" });
      return true;
    }

    const [removed] = reviews.splice(index, 1);
    writeReviews(reviews);
    sendJson(response, 200, { ok: true, review: removed });
    return true;
  }

  return false;
}

const server = http.createServer(async (request, response) => {
  clearExpiredSessions();
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (await handleApi(request, response, pathname, url)) {
      return;
    }

    if (pathname === "/" || pathname === "/index.html") {
      sendFile(response, path.join(pagesDir, "index.html"));
      return;
    }

    if (serveStatic(response, pathname)) {
      return;
    }

    sendJson(response, 404, { error: "Route not found" });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: "Internal server error",
      detail: error.message
    });
  }
});

function startServer(port) {
  ensureDataDir();
  ensureOwnerAccount();
  ensurePageSettingsFile();
  ensureQuoteMailboxFile();
  server.listen(port, () => {
    console.log(`AGU Clean Services app running on http://localhost:${port}`);
  });
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    const nextPort = error.port ? error.port + 1 : basePort + 1;
    console.log(`Port ${error.port || basePort} is busy. Retrying on http://localhost:${nextPort}`);
    setTimeout(() => startServer(nextPort), 150);
    return;
  }

  throw error;
});

startServer(basePort);
