const express = require("express");
const config = require("./config");
const routes = require("./routes");
const { seedQuota } = require("./seed");
const db = require("./db");
const { redis } = require("./redis");

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));
app.use(routes);

app.use((err, _req, res, _next) => {
  console.error("[unhandled]", err);
  res.status(500).json({ error: "internal error" });
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
  await seedQuota(config.defaultEventId);
  app.listen(config.port, "0.0.0.0", () => {
    console.log(
      `[api] listening :${config.port} instance=${config.instanceId}`
    );
  });
}

start().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
