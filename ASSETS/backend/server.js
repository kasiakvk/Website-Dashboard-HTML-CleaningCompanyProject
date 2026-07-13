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
const basePort = Number(process.env.PORT || 3000);
const sessionMaxAgeMs = 1000 * 60 * 60 * 12;
const sessionStore = new Map();

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

function readOwner() {
  ensureOwnerAccount();
  return JSON.parse(fs.readFileSync(ownerPath, "utf8"));
}

function writeOwner(owner) {
  ensureDataDir();
  fs.writeFileSync(ownerPath, JSON.stringify(owner, null, 2), "utf8");
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

async function handleApi(request, response, pathname) {
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
      dashboard: "/dashboard.html"
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
    if (await handleApi(request, response, pathname)) {
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
