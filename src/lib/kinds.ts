import { hash } from "./hash";

// Runs at build time (no three.js) so cards and profile pages agree on who is what.
export const KINDS = ["caveman", "gorilla", "crt", "banana", "monolith", "floppy", "clanker", "cube", "rock"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABEL: Record<Kind, string> = {
  caveman: "caveman with club",
  gorilla: "gorilla, VR headset pushed up",
  crt: "CRT monitor, 800×600",
  banana: "banana with a sticker",
  monolith: "monolith, 1:4:9",
  floppy: "3.5″ floppy, 1.44 MB",
  clanker: "clanker on treads",
  cube: "spinning cube (classic)",
  rock: "pet rock (main branch)",
};

// Hand-made assets override the procedural character. Files live in public/models,
// pre-baked with `gltf-transform optimize --compress meshopt --texture-compress webp`.
export interface CustomModel {
  url: string;
  label: string;
}
export const MODELS: Record<string, CustomModel> = {
  "w-s-bitcoin": { url: "/models/w-s-bitcoin.glb", label: "grumpy apple, hand-modeled" },
  MrHodlX: { url: "/models/mrhodlx.glb", label: "hooded gas mask, hand-modeled" },
  timechainb: { url: "/models/timechainb.glb", label: "winged guardian, hand-modeled" },
  ottorockx: { url: "/models/ottorockx.glb", label: "Otto Rocket, thumbs up, hand-modeled" },
  dplusplus1024: { url: "/models/dplusplus1024.glb", label: "full body, hand-modeled" },
  "2140data": { url: "/models/2140data.glb", label: "bust with red eyes, hand-modeled" },
  "itme-brain": { url: "/models/itme-brain.glb", label: "full body, shades on, hand-modeled" },
  portlandhodl: { url: "/models/portlandhodl.glb", label: "hand-modeled" },
  Rob1Ham: { url: "/models/rob1ham.glb", label: "full body, hand-modeled" },
  "rules-without-rulers": { url: "/models/rules-without-rulers.glb", label: "chained bust, hand-modeled" },
  SaniExp: { url: "/models/saniexp.glb", label: "astronaut, hand-modeled" },
};

// Deterministic per login, with a collision pass so a small roster stays varied.
// Members with a hand-made model don't consume a kind (they only need one as a load fallback).
export function assignKinds(logins: string[]): Map<string, Kind> {
  const out = new Map<string, Kind>();
  const taken = new Set<Kind>();
  for (const login of logins) {
    if (MODELS[login]) continue;
    const start = hash(login.toLowerCase()) % KINDS.length;
    let kind = KINDS[start];
    if (taken.size < KINDS.length) {
      for (let i = 0; i < KINDS.length; i++) {
        const candidate = KINDS[(start + i) % KINDS.length];
        if (!taken.has(candidate)) {
          kind = candidate;
          break;
        }
      }
    }
    taken.add(kind);
    out.set(login, kind);
  }
  return out;
}
