const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");
const frontendPagesDir = path.join(frontendDir, "pages");
const frontendCssDir = path.join(frontendDir, ".css");
const frontendJsDir = path.join(frontendDir, ".js");
const frontendImagesDir = path.join(frontendDir, "images");
const frontendAssetsDir = path.join(frontendDir, "ASSETS");
const assetsDir = path.join(rootDir, "ASSETS");
const multipageDir = path.join(rootDir, "aga_clean_services_multipage_site");
const dataDir = path.join(__dirname, "data");
const contentPath = path.join(__dirname, "content.json");
const leadsPath = path.join(dataDir, "leads.ndjson");
const basePort = Number(process.env.PORT || 3000);

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
  ".zip": "application/zip"
};

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readContent() {
  return JSON.parse(fs.readFileSync(contentPath, "utf8"));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": mimeTypes[".json"] });
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

function serveStatic(response, pathname) {
  const routes = [
    { prefix: "/pages/", baseDir: frontendPagesDir },
    { prefix: "/.css/", baseDir: frontendCssDir },
    { prefix: "/.js/", baseDir: frontendJsDir },
    { prefix: "/images/", baseDir: frontendImagesDir },
    { prefix: "/ASSETS/", baseDir: assetsDir },
    { prefix: "/frontend/ASSETS/", baseDir: frontendAssetsDir },
    { prefix: "/frontend/", baseDir: frontendDir },
    { prefix: "/multipage/", baseDir: multipageDir }
  ];

  for (const route of routes) {
    if (!pathname.startsWith(route.prefix)) {
      continue;
    }

    const relativePath = pathname.slice(route.prefix.length);
    const filePath = path.normalize(path.join(route.baseDir, relativePath));
    if (!filePath.startsWith(route.baseDir)) {
      sendJson(response, 403, { error: "Forbidden" });
      return true;
    }

    sendFile(response, filePath);
    return true;
  }

  const rootLevelFiles = new Set([
    "/Aga_Clean_Services.html",
    "/Aga_Clean_Services_v1.1.html",
    "/styles.css",
    "/styles-v1.1.css",
    "/site.js",
    "/aga_clean_services_logo.svg",
    "/AGA Clean Services logo design.png",
    "/Modern cleaning service logo design.png",
    "/README.md"
  ]);

  if (rootLevelFiles.has(pathname)) {
    sendFile(response, path.join(rootDir, pathname.slice(1)));
    return true;
  }

  return false;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      resolve(body);
    });

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
    .replace(/^-+|-+$/g, "") || "lead";
}

function makeLeadId(type, payload) {
  return `${type}-${slugify(payload.name || payload.service || "entry")}-${Date.now()}`;
}

function readLeads() {
  ensureDataDir();

  if (!fs.existsSync(leadsPath)) {
    return [];
  }

  return fs
    .readFileSync(leadsPath, "utf8")
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

function writeLeads(leads) {
  ensureDataDir();
  const output = leads.map((entry) => JSON.stringify(entry)).join("\n");
  fs.writeFileSync(leadsPath, output ? `${output}\n` : "", "utf8");
}

function appendLead(type, payload) {
  const leads = readLeads();
  const entry = {
    id: makeLeadId(type, payload),
    type,
    status: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...payload
  };
  leads.push(entry);
  writeLeads(leads);
  return entry;
}

function buildStats(leads) {
  const totalLeads = leads.length;
  const contactLeads = leads.filter((lead) => lead.type === "contact").length;
  const quoteLeads = leads.filter((lead) => lead.type === "quote").length;
  const statusCounts = leads.reduce((acc, lead) => {
    const key = lead.status || "new";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const serviceCounts = leads.reduce((acc, lead) => {
    const key = lead.service || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    totalLeads,
    contactLeads,
    quoteLeads,
    statusCounts,
    serviceCounts,
    recentLeads: leads
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 10)
  };
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      status: "healthy",
      service: "agu-clean-services-backend",
      port: basePort,
      timestamp: new Date().toISOString()
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
      services: "/pages/services.html",
      prices: "/pages/prices.html",
      about: "/pages/about.html",
      reviews: "/pages/reviews.html",
      contact: "/pages/contact.html",
      privacy: "/pages/privacy.html",
      terms: "/pages/terms.html",
      dashboard: "/pages/dashboard.html"
    });
    return true;
  }

  if (pathname === "/api/services" && request.method === "GET") {
    sendJson(response, 200, readContent().services);
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
      sendJson(response, 400, {
        ok: false,
        error: "Invalid JSON payload"
      });
    }
    return true;
  }

  if (pathname === "/api/admin/leads" && request.method === "GET") {
    sendJson(response, 200, readLeads().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    return true;
  }

  if (pathname === "/api/admin/stats" && request.method === "GET") {
    sendJson(response, 200, buildStats(readLeads()));
    return true;
  }

  if (pathname.startsWith("/api/admin/leads/") && request.method === "PATCH") {
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
        lead.status = payload.status;
      }
      lead.updatedAt = new Date().toISOString();
      writeLeads(leads);
      sendJson(response, 200, { ok: true, lead });
    } catch {
      sendJson(response, 400, { ok: false, error: "Invalid JSON payload" });
    }
    return true;
  }

  return false;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (await handleApi(request, response, pathname)) {
      return;
    }

    if (pathname === "/" || pathname === "/index.html") {
      sendFile(response, path.join(frontendPagesDir, "index.html"));
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
  server.listen(port, () => {
    console.log(`AGA Clean Services app running on http://localhost:${port}`);
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
