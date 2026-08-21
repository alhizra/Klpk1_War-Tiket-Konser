const path = require("path");
const express = require("express");
const config = require("./config");
const routes = require("./routes");
const { seedQuota } = require("./seed");
const db = require("./db");
const { redis } = require("./redis");

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));

// CORS — Expo Go / web / HP di LAN
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-reset-token, x-request-id"
  );
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

// Web Jumat (static) + API di /api/*
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));
app.use("/api", routes);
// kompatibel path lama tanpa prefix /api
app.use(routes);
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ error: "JSON body tidak valid" });
  }
  console.error("[unhandled]", err);
  return res.status(500).json({ error: "internal error" });
});

async function waitReady(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      await db.query("SELECT 1");
      await redis.ping();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("DB/Redis belum siap");
}

async function start() {
  await waitReady();
  await db.ensureOrderColumns();
  await seedQuota(config.defaultEventId);
  app.listen(config.port, "0.0.0.0", () => {
    console.log(
      `[api] listening :${config.port} instance=${config.instanceId} payment=${process.env.PAYMENT_PROVIDER || "mock"}`
    );
  });
}

start().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
