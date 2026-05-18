// Baixa o modelo do MediaPipe e copia o runtime wasm para public/,
// para que tudo funcione offline (PWA) sem depender de CDN externo.
// Também gera ícones PNG placeholder se ainda não existirem.
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { cp, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";
const modelDir = join(pub, "models");
const modelPath = join(modelDir, "selfie_multiclass_256x256.tflite");

const wasmSrc = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const wasmDest = join(pub, "wasm");

const iconDir = join(pub, "icons");

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

async function download(url, dest) {
  if (existsSync(dest)) {
    console.log(`✓ já existe: ${dest}`);
    return;
  }
  console.log(`↓ baixando ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await new Promise((resolve, reject) => {
    const ws = createWriteStream(dest);
    ws.on("finish", resolve);
    ws.on("error", reject);
    ws.end(buf);
  });
  console.log(`✓ salvo: ${dest} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

// ---- Gerador mínimo de PNG (RGBA, sem filtro) para ícones placeholder ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function makePng(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (1 + size * 4));
  const inset = Math.floor(size * 0.28);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filtro: none
    for (let x = 0; x < size; x++) {
      const o = rowStart + 1 + x * 4;
      const hole =
        x > inset && x < size - inset && y > inset && y < size - inset;
      // fundo escuro com um "recorte" claro no centro (alusão ao buraco do provador)
      raw[o] = hole ? 245 : 17;
      raw[o + 1] = hole ? 245 : 17;
      raw[o + 2] = hole ? 245 : 17;
      raw[o + 3] = 255;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function main() {
  ensureDir(modelDir);
  ensureDir(iconDir);
  await download(MODEL_URL, modelPath);

  if (existsSync(wasmSrc)) {
    await cp(wasmSrc, wasmDest, { recursive: true });
    console.log(`✓ wasm copiado para ${wasmDest}`);
  } else {
    console.warn(
      `! wasm não encontrado em ${wasmSrc} (rode 'npm install' primeiro)`,
    );
  }

  for (const s of [192, 512]) {
    const p = join(iconDir, `icon-${s}.png`);
    if (!existsSync(p)) {
      await writeFile(p, makePng(s));
      console.log(`✓ ícone gerado: ${p}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
