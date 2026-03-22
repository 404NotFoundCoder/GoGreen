/**
 * 由 public/logo-leaf.svg 產生 PWA／主畫面用 PNG（不改 SVG 檔內容）。
 * 執行：npm run generate:icons
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svg = readFileSync(join(root, "public", "logo-leaf.svg"));

const outs = [
  [192, join(root, "public", "icon-192.png")],
  [512, join(root, "public", "icon-512.png")],
  [180, join(root, "public", "apple-touch-icon.png")],
];

for (const [size, file] of outs) {
  await sharp(svg).resize(size, size).png().toFile(file);
  console.log("wrote", file.replace(root + "\\", "").replace(root + "/", ""));
}
