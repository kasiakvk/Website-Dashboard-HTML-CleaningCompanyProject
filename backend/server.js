const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");
const multipageDir = path.join(rootDir, "aga_clean_services_multipage_site");
const dataDir = path.join(__dirname, "data");
const contentPath = path.join(__dirname, "content.json");
const enquiryLogPath = path.join(dataDir, "enquiries.ndjson");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
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
    { prefix: "/frontend/", baseDir: frontendDir },
    { prefix: "/multipage/", baseDir: multipageDir }
  ];

  for (const route of routes) {
    if (pathname.startsWith(route.prefix)) {
      const relativePath = pathname.slice(route.prefix.length);
      const filePath = path.normalize(path.join(route.baseDir, relativePath));
      if (!filePath.startsWith(route.baseDir)) {
        sendJson(response, 403, { error: "Forbidden" });
        return true;
      }
      sendFile(response, filePath);
      return true;
    }
  }

  const rootLevelFiles = new Set([
    "/Aga_Clean_Services.html",
    "/Aga_Clean_Services_v1.1.html",
    "/styles.css",
    "/styles-v1.1.css",
    "/site.js",
    "/aga_clean_services_logo.svg",
    "/Modern cleaning service logo design.png",
    "/README.md"
  ]);

  if (rootLevelFiles.has(pathname)) {
    sendFile(response, path.join(rootDir, pathname.slice(1)));
    return true;
  }

  return false;
}

function handleApi(request, response, pathname) {
  if (pathname === "/api/content" && request.method === "GET") {
    sendJson(response, 200, readContent());
    return true;
  }

  if (pathname === "/api/pages" && request.method === "GET") {
    const payload = {
      dashboard: "/",
      frontend: "/frontend/index.html",
      singlePage: "/Aga_Clean_Services.html",
      singlePageWarm: "/Aga_Clean_Services_v1.1.html",
      multipage: "/multipage/index.html"
    };
    sendJson(response, 200, payload);
    return true;
  }

  if (pathname === "/api/contact" && request.method === "POST") {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        ensureDataDir();
        const entry = {
          createdAt: new Date().toISOString(),
          ...payload
        };
        fs.appendFileSync(enquiryLogPath, JSON.stringify(entry) + "\n", "utf8");
        sendJson(response, 200, {
          ok: true,
          message: "Enquiry saved locally",
          enquiry: entry
        });
      } catch (error) {
        sendJson(response, 400, {
          ok: false,
          error: "Invalid JSON payload"
        });
      }
    });

    return true;
  }

  return false;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (handleApi(request, response, pathname)) {
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    sendFile(response, path.join(frontendDir, "index.html"));
    return;
  }

  if (serveStatic(response, pathname)) {
    return;
  }

  sendJson(response, 404, { error: "Route not found" });
});

server.listen(port, () => {
  console.log(`AGA Clean Services app running on http://localhost:${port}`);
});
