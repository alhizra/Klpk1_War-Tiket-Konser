const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "public", "posters", "uploads");
const MAX_BYTES = 2.5 * 1024 * 1024; // ~2.5 MB

const MIME_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Simpan poster dari data URL (base64) atau path / URL relatif yang sudah valid.
 * return path publik mis. /posters/uploads/evt-12-abc.jpg
 */
function savePosterInput(input, eventIdHint) {
  if (input == null || input === "") return null;
  const raw = String(input).trim();

  // sudah path publik
  if (raw.startsWith("/posters/")) {
    return raw.slice(0, 240);
  }
  // URL http(s) eksternal — simpan apa adanya (opsional)
  if (/^https?:\/\//i.test(raw)) {
    return raw.slice(0, 500);
  }

  const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) {
    const err = new Error("Format gambar tidak valid (pakai JPG/PNG/WebP)");
    err.status = 400;
    throw err;
  }

  const mime = m[1].toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) {
    const err = new Error("Tipe gambar tidak didukung (JPG, PNG, WebP, GIF)");
    err.status = 400;
    throw err;
  }

  const buf = Buffer.from(m[2], "base64");
  if (!buf.length || buf.length > MAX_BYTES) {
    const err = new Error("Ukuran gambar maks. 2.5 MB");
    err.status = 400;
    throw err;
  }

  ensureUploadDir();
  const id = eventIdHint != null ? String(eventIdHint) : "new";
  const name = `evt-${id}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const full = path.join(UPLOAD_DIR, name);
  fs.writeFileSync(full, buf);
  return `/posters/uploads/${name}`;
}

module.exports = { savePosterInput, ensureUploadDir };
