import { readFileSync, writeFileSync } from "node:fs";

const source = process.argv[2];
if (!source) throw new Error("usage: node scripts/build-star-catalog.mjs /path/to/bsc5-short.json");

const catalog = JSON.parse(readFileSync(source, "utf8"));
const stars = catalog
  .map((star) => {
    const ra = /^(\d+)h\s+(\d+)m\s+([\d.]+)s$/.exec(star.RA ?? "");
    const dec = /^([+-])(\d+)°\s+(\d+)′\s+(\d+)″$/.exec(star.Dec ?? "");
    const mag = Number(star.V);
    const kelvin = Number(star.K);
    if (!ra || !dec || !Number.isFinite(mag) || mag > 6) return null;
    const hours = Number(ra[1]) + Number(ra[2]) / 60 + Number(ra[3]) / 3600;
    const sign = dec[1] === "-" ? -1 : 1;
    const degrees = sign * (Number(dec[2]) + Number(dec[3]) / 60 + Number(dec[4]) / 3600);
    return { hours, degrees, mag, kelvin: Number.isFinite(kelvin) ? kelvin : 6500 };
  })
  .filter(Boolean);

// Six bytes per star: uint16 RA, int16 Dec, uint8 magnitude, uint8 log temperature.
const bytes = Buffer.alloc(stars.length * 6);
const minLogK = Math.log(2500);
const logKRange = Math.log(30000) - minLogK;
stars.forEach((star, i) => {
  const offset = i * 6;
  bytes.writeUInt16LE(Math.round((star.hours / 24) * 65535), offset);
  bytes.writeInt16LE(Math.round((star.degrees / 90) * 32767), offset + 2);
  bytes.writeUInt8(Math.round((Math.max(-1.5, Math.min(6, star.mag)) + 1.5) * 34), offset + 4);
  const temperature = Math.max(2500, Math.min(30000, star.kelvin));
  bytes.writeUInt8(Math.round(((Math.log(temperature) - minLogK) / logKRange) * 255), offset + 5);
});

const output = `// Generated from the Yale Bright Star Catalog 5th Edition (J2000), magnitude <= 6.0.\n// Source conversion: https://github.com/brettonw/YaleBrightStarCatalog (MIT).\nexport const STAR_RECORD_BYTES = 6;\nexport const STAR_CATALOG_COUNT = ${stars.length};\nexport const STAR_CATALOG_B64 = \"${bytes.toString("base64")}\";\n`;
writeFileSync(new URL("../src/data/bright-stars.ts", import.meta.url), output);
console.log(`wrote ${stars.length} stars (${bytes.length} packed bytes)`);
