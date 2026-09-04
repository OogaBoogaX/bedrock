// Renders the link-preview cards under src/pages/og/ to PNGs in public/og/.
// Run after `pnpm tribe:sync` or after touching a card. Needs Google Chrome installed.
//   pnpm og
import { spawn, spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import tribe from "../src/data/tribe.json" with { type: "json" };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4410;
const WIDTH = 1200;
const HEIGHT = 630;
const SCALE = 2;

const cards = [
  { route: "og", file: "home.png" },
  { route: "og/manifesto", file: "manifesto.png" },
  ...tribe.members.map((m) => ({ route: `og/tribe/${m.login.toLowerCase()}`, file: `tribe/${m.login.toLowerCase()}.png` })),
];

const build = spawnSync("pnpm", ["exec", "astro", "build"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const preview = spawn("pnpm", ["exec", "astro", "preview", "--host", "127.0.0.1", "--port", String(PORT)], { cwd: root, stdio: "ignore" });
const stop = () => preview.kill();
process.on("exit", stop);

const origin = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(`${origin}/og/`)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 200));
}

await mkdir(resolve(root, "public/og/tribe"), { recursive: true });
const browser = await puppeteer.launch({
  channel: "chrome",
  headless: true,
  args: ["--hide-scrollbars", "--force-device-scale-factor=1"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });
  for (const { route, file } of cards) {
    await page.goto(`${origin}/${route}/`, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    const path = resolve(root, "public/og", file);
    await page.screenshot({ path, type: "png", clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
    console.log(`public/og/${file}`);
  }
} finally {
  await browser.close();
  stop();
}
