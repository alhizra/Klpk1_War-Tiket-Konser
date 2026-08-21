/**
 * Isi mobile/config.js BASE_URL dari env Codespace.
 * Usage: node scripts/set-codespace-url.js
 */
const fs = require("fs");
const path = require("path");

const name = process.env.CODESPACE_NAME || "";
const domain =
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev";
const port = process.env.API_PORT || "3000";

if (!name) {
  console.error(
    "CODESPACE_NAME kosong. Jalankan di GitHub Codespaces, atau set manual di config.js"
  );
  process.exit(1);
}

const baseUrl = `https://${name}-${port}.${domain}`;
const configPath = path.join(__dirname, "..", "config.js");

const content = `// Di-generate untuk GitHub Codespaces — jangan pakai ipconfig/localhost di HP.
// Base URL API monolit (port ${port} harus Public di tab PORTS).

export const BASE_URL = "${baseUrl}";

export const PAGE_SIZE = 20;
export const RATE_LIMIT_PER_MIN = 60;
`;

fs.writeFileSync(configPath, content, "utf8");
console.log("OK config.js BASE_URL =", baseUrl);
console.log("Pastikan tab PORTS →", port, "→ Visibility: Public");
