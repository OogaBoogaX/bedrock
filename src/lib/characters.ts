import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DodecahedronGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  PlaneGeometry,
  QuadraticBezierCurve3,
  RedFormat,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type ColorRepresentation,
} from "three";
import { rng } from "./hash";
import type { Kind } from "./kinds";

export interface Character {
  group: Group;
  /** Optional per-frame hook for idle extras (blinking LEDs, orbiting bones). */
  update?: (t: number) => void;
}

// Three-step toon ramp shared by every material.
const ramp = (() => {
  const tex = new DataTexture(new Uint8Array([70, 160, 255]), 3, 1, RedFormat);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

const toon = (color: ColorRepresentation) => new MeshToonMaterial({ color, gradientMap: ramp });
const flat = (color: ColorRepresentation) => new MeshBasicMaterial({ color });

function mesh(geometry: Mesh["geometry"], material: Mesh["material"], x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

function edges(target: Mesh, color: ColorRepresentation, threshold = 20): LineSegments {
  const lines = new LineSegments(new EdgesGeometry(target.geometry, threshold), new LineBasicMaterial({ color }));
  lines.position.copy(target.position);
  lines.rotation.copy(target.rotation);
  lines.scale.copy(target.scale);
  return lines;
}

// Box with the avatar on the +z face and a solid colour elsewhere.
function faceBox(size: number, avatar: Texture, skin: ColorRepresentation, depth = size): Mesh {
  const side = toon(skin);
  const face = new MeshBasicMaterial({ map: avatar });
  return new Mesh(new BoxGeometry(size, size, depth), [side, side, side, side, face, side]);
}

const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)];

const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac] as const;
const FURS = [0x3b2a1a, 0x1f1f1f, 0x5a3a20, 0x2a2a3a] as const;
const GORILLAS = [0x4a4a4a, 0x5a4634, 0x3f4a5a, 0x555555] as const;
const FLOPPIES = [0x1b1b4b, 0x8b0000, 0x0b5d1e, 0x111111, 0xd94d1a, 0x5b2c83] as const;

function hat(r: () => number, y: number): Group | null {
  const roll = r();
  const g = new Group();
  g.position.y = y;
  if (roll < 0.22) {
    // party hat
    const cone = mesh(new ConeGeometry(0.28, 0.6, 12), toon(0xff3fa4), 0, 0.3);
    g.add(cone, mesh(new SphereGeometry(0.07, 8, 8), toon(0xffe135), 0, 0.62));
    return g;
  }
  if (roll < 0.4) {
    // viking helmet
    g.add(mesh(new SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x8a8a8a), 0, -0.05));
    const hornL = mesh(new ConeGeometry(0.09, 0.45, 8), toon(0xf4ecd8), -0.5, 0.15);
    hornL.rotation.z = 0.9;
    const hornR = hornL.clone();
    hornR.position.x = 0.5;
    hornR.rotation.z = -0.9;
    g.add(hornL, hornR);
    return g;
  }
  if (roll < 0.55) {
    // propeller beanie
    g.add(mesh(new SphereGeometry(0.48, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), toon(0x1f6fd1), 0, -0.05));
    g.add(mesh(new CylinderGeometry(0.03, 0.03, 0.2, 6), toon(0xffe135), 0, 0.42));
    const prop = mesh(new BoxGeometry(0.6, 0.03, 0.08), toon(0xff3b3b), 0, 0.52);
    prop.name = "prop";
    g.add(prop);
    return g;
  }
  return null;
}

function caveman(avatar: Texture, r: () => number): Character {
  const g = new Group();
  const skin = pick(r, SKINS);
  const fur = pick(r, FURS);

  g.add(faceBox(0.9, avatar, skin).translateY(0.85));
  g.add(mesh(new BoxGeometry(1.02, 0.34, 1.02), toon(fur), 0, 1.36));
  for (let i = 0; i < 4; i++) {
    g.add(mesh(new BoxGeometry(0.2, 0.28, 0.2), toon(fur), -0.35 + i * 0.23, 1.6, (r() - 0.5) * 0.5));
  }
  g.add(mesh(new CylinderGeometry(0.16, 0.16, 0.2, 8), toon(skin), 0, 0.32));
  g.add(mesh(new CylinderGeometry(0.34, 0.44, 0.8, 8), toon(skin), 0, -0.15));
  g.add(mesh(new CylinderGeometry(0.47, 0.52, 0.34, 8), toon(0x7a4b1e), 0, -0.45));

  const armL = mesh(new CylinderGeometry(0.11, 0.11, 0.72, 8), toon(skin), -0.52, -0.1);
  armL.rotation.z = 0.15;
  const armR = mesh(new CylinderGeometry(0.11, 0.11, 0.72, 8), toon(skin), 0.58, 0.2);
  armR.rotation.z = -1.1;
  g.add(armL, armR);

  const club = new Group();
  club.position.set(0.95, 0.35, 0.05);
  club.rotation.z = -0.35;
  club.add(mesh(new CylinderGeometry(0.05, 0.13, 0.95, 8), toon(0x5a3a1a), 0, 0.3));
  club.add(mesh(new SphereGeometry(0.16, 8, 8), toon(0x5a3a1a), 0, 0.78));
  g.add(club);

  for (const x of [-0.18, 0.18]) {
    g.add(mesh(new CylinderGeometry(0.13, 0.13, 0.55, 8), toon(skin), x, -0.88));
    g.add(mesh(new BoxGeometry(0.3, 0.12, 0.42), toon(skin), x, -1.17, 0.05));
  }
  const cap = hat(r, 1.75);
  if (cap) g.add(cap);

  g.scale.setScalar(0.78);
  g.position.y = -0.15;
  return {
    group: g,
    update: (t) => {
      club.rotation.z = -0.35 + Math.sin(t * 2.2) * 0.08;
      const prop = cap?.getObjectByName("prop");
      if (prop) prop.rotation.y = t * 6;
    },
  };
}

function gorilla(avatar: Texture, r: () => number): Character {
  const g = new Group();
  const fur = pick(r, GORILLAS);
  const skin = pick(r, SKINS);

  const body = mesh(new SphereGeometry(0.78, 14, 10), toon(fur), 0, -0.25);
  body.scale.set(1, 1.08, 0.9);
  const belly = mesh(new SphereGeometry(0.5, 12, 8), toon(0x6f6f6f), 0, -0.32, 0.38);
  belly.scale.set(1, 1.1, 0.55);
  g.add(body, belly);

  g.add(faceBox(0.85, avatar, skin).translateY(0.72));
  g.add(mesh(new BoxGeometry(0.98, 0.5, 0.98), toon(fur), 0, 1.06));
  g.add(mesh(new BoxGeometry(0.45, 0.2, 0.3), toon(fur), 0, 0.2, 0.32));

  // VR headset pushed up on the forehead, so the face still shows
  const headset = new Group();
  headset.position.set(0, 1.18, 0.38);
  headset.rotation.x = -0.45;
  headset.add(mesh(new BoxGeometry(0.95, 0.36, 0.28), toon(0xf2f2f2)));
  headset.add(mesh(new BoxGeometry(0.85, 0.22, 0.05), flat(0x1c1c1c), 0, 0, 0.15));
  const strap = mesh(new TorusGeometry(0.54, 0.045, 8, 24), toon(0x222222), 0, 0, -0.42);
  strap.rotation.x = Math.PI / 2;
  headset.add(strap);
  g.add(headset);

  for (const s of [-1, 1]) {
    const arm = mesh(new CylinderGeometry(0.17, 0.21, 1.35, 8), toon(fur), s * 0.88, -0.42);
    arm.rotation.z = s * -0.18;
    g.add(arm, mesh(new SphereGeometry(0.24, 8, 8), toon(fur), s * 1.0, -1.06));
    g.add(mesh(new CylinderGeometry(0.18, 0.2, 0.42, 8), toon(fur), s * 0.32, -1.0));
  }
  const cap = hat(r, 1.35);
  if (cap) g.add(cap);

  g.scale.setScalar(0.8);
  g.position.y = -0.05;
  return {
    group: g,
    update: (t) => {
      headset.rotation.x = -0.45 + Math.sin(t * 1.6) * 0.05;
      const prop = cap?.getObjectByName("prop");
      if (prop) prop.rotation.y = t * 6;
    },
  };
}

function crt(avatar: Texture, r: () => number): Character {
  const g = new Group();
  const beige = pick(r, [0xd8d0b8, 0xcfc6ad, 0xe6e0cc] as const);
  const dark = 0xb9b09a;

  const shell = mesh(new BoxGeometry(1.7, 1.4, 1.1), toon(beige), 0, 0.42);
  g.add(shell, edges(shell, 0x8a8268));
  g.add(mesh(new BoxGeometry(1.25, 1.05, 0.55), toon(dark), 0, 0.42, -0.78));
  g.add(mesh(new BoxGeometry(1.5, 1.2, 0.06), toon(dark), 0, 0.45, 0.56));
  g.add(mesh(new PlaneGeometry(1.3, 1.0), flat(0x0a0a0a), 0, 0.47, 0.6));
  const screen = mesh(new PlaneGeometry(0.92, 0.92), new MeshBasicMaterial({ map: avatar }), 0, 0.47, 0.605);
  g.add(screen);
  const led = mesh(new BoxGeometry(0.07, 0.07, 0.03), flat(0x39ff14), 0.62, -0.12, 0.6);
  g.add(led);
  g.add(mesh(new BoxGeometry(0.12, 0.06, 0.03), toon(dark), 0.42, -0.12, 0.6));
  g.add(mesh(new BoxGeometry(0.12, 0.06, 0.03), toon(dark), 0.26, -0.12, 0.6));

  g.add(mesh(new CylinderGeometry(0.28, 0.34, 0.22, 10), toon(dark), 0, -0.4));
  const base = mesh(new BoxGeometry(1.15, 0.12, 0.85), toon(beige), 0, -0.57);
  g.add(base, edges(base, 0x8a8268));

  const keys = mesh(new BoxGeometry(1.5, 0.09, 0.5), toon(beige), 0, -0.6, 0.95);
  g.add(keys, edges(keys, 0x8a8268));
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 10; col++) {
      g.add(mesh(new BoxGeometry(0.1, 0.03, 0.1), toon(dark), -0.65 + col * 0.145, -0.54, 0.76 + row * 0.14));
    }
  }

  g.scale.setScalar(0.92);
  g.position.y = -0.02;
  return {
    group: g,
    update: (t) => {
      (led.material as MeshBasicMaterial).color.setHex(Math.sin(t * 3) > 0.8 ? 0x0f5f0a : 0x39ff14);
    },
  };
}

function banana(avatar: Texture, r: () => number): Character {
  const g = new Group();
  const curve = new QuadraticBezierCurve3(new Vector3(-1.0, 0.6, 0), new Vector3(0, -1.1, 0), new Vector3(1.0, 0.6, 0));
  const fruit = mesh(new TubeGeometry(curve, 28, 0.27, 12, false), toon(pick(r, [0xffe135, 0xffd400, 0xf5c400] as const)));
  g.add(fruit);
  for (const t of [0, 1]) {
    const p = curve.getPoint(t);
    const tip = mesh(new ConeGeometry(0.26, 0.4, 10), toon(0x5a3a00), p.x, p.y, p.z);
    tip.lookAt(curve.getPoint(t === 0 ? 0.08 : 0.92));
    tip.rotateX(-Math.PI / 2);
    g.add(tip);
  }
  // seam lines
  for (const s of [-1, 1]) {
    const seam = new Mesh(new TubeGeometry(curve, 28, 0.015, 4, false), toon(0xb58a00));
    seam.position.set(0, 0.03 * s, 0.27 * s);
    g.add(seam);
  }
  // sticker
  const sticker = new Group();
  const mid = curve.getPoint(0.5);
  sticker.position.set(mid.x, mid.y + 0.05, 0.3);
  sticker.add(mesh(new CircleGeometry(0.38, 32), flat(0x1a4fbf), 0, 0, -0.005));
  sticker.add(mesh(new CircleGeometry(0.33, 32), new MeshBasicMaterial({ map: avatar })));
  g.add(sticker);

  g.scale.setScalar(0.95);
  g.position.y = -0.1;
  g.rotation.z = -0.15;
  return {
    group: g,
    update: (t) => {
      g.position.y = -0.1 + Math.sin(t * 1.8) * 0.05;
    },
  };
}

function monolith(avatar: Texture, r: () => number): Character {
  const g = new Group();
  const slab = mesh(new BoxGeometry(0.9, 2.05, 0.22), toon(0x161616));
  g.add(slab, edges(slab, 0xb0b0b0));
  g.add(mesh(new PlaneGeometry(0.7, 0.7), new MeshBasicMaterial({ map: avatar }), 0, 0.5, 0.111));
  const glyph = mesh(new PlaneGeometry(0.5, 0.06), flat(0xffe135), 0, -0.2, 0.111);
  g.add(glyph, mesh(new PlaneGeometry(0.3, 0.06), flat(0xffe135), -0.1, -0.35, 0.111));

  // the bone from the movie, orbiting
  const bone = new Group();
  const shaft = mesh(new CylinderGeometry(0.05, 0.05, 0.5, 6), toon(0xf4ecd8));
  shaft.rotation.z = Math.PI / 2;
  bone.add(shaft);
  for (const x of [-0.25, 0.25]) {
    bone.add(mesh(new SphereGeometry(0.08, 6, 6), toon(0xf4ecd8), x, 0.06));
    bone.add(mesh(new SphereGeometry(0.08, 6, 6), toon(0xf4ecd8), x, -0.06));
  }
  g.add(bone);
  const phase = r() * Math.PI * 2;

  g.scale.setScalar(0.9);
  return {
    group: g,
    update: (t) => {
      const a = t * 1.1 + phase;
      bone.position.set(Math.cos(a) * 1.05, Math.sin(t * 0.9) * 0.5, Math.sin(a) * 1.05);
      bone.rotation.set(t, t * 1.3, 0);
    },
  };
}

function floppy(avatar: Texture, r: () => number): Character {
  const g = new Group();
  const shell = pick(r, FLOPPIES);
  const body = mesh(new BoxGeometry(1.8, 1.8, 0.14), toon(shell));
  g.add(body, edges(body, 0x9a9a9a));
  g.add(mesh(new BoxGeometry(0.9, 0.55, 0.03), toon(0xb8b8b8), 0.12, 0.6, 0.075));
  g.add(mesh(new BoxGeometry(0.22, 0.4, 0.04), flat(0x111111), -0.05, 0.6, 0.08));
  g.add(mesh(new BoxGeometry(1.35, 0.9, 0.03), toon(0xf7f7f0), 0, -0.38, 0.075));
  g.add(mesh(new PlaneGeometry(0.72, 0.72), new MeshBasicMaterial({ map: avatar }), -0.27, -0.38, 0.095));
  for (let i = 0; i < 3; i++) {
    g.add(mesh(new PlaneGeometry(0.45 - i * 0.08, 0.05), flat(0x8a8a8a), 0.32 - i * 0.04, -0.2 - i * 0.18, 0.095));
  }
  g.add(mesh(new BoxGeometry(0.12, 0.12, 0.05), flat(0x111111), -0.75, -0.75, -0.06));
  const hub = mesh(new CircleGeometry(0.32, 24), toon(0xa0a0a0), 0.1, 0.1, -0.071);
  hub.rotation.y = Math.PI;
  g.add(hub, mesh(new BoxGeometry(0.12, 0.3, 0.02), flat(0x333333), 0.1, 0.1, -0.075).rotateY(Math.PI));

  g.scale.setScalar(0.95);
  return { group: g };
}

function clanker(avatar: Texture, r: () => number): Character {
  const g = new Group();
  const metal = pick(r, [0xbfc4cc, 0x9aa3ad, 0xd6d9de] as const);
  const dark = 0x4b525b;

  const head = mesh(new BoxGeometry(0.95, 0.9, 0.8), toon(metal), 0, 0.85);
  g.add(head, edges(head, dark));
  g.add(mesh(new BoxGeometry(0.8, 0.78, 0.03), flat(0x0a0a0a), 0, 0.85, 0.41));
  g.add(mesh(new PlaneGeometry(0.7, 0.7), new MeshBasicMaterial({ map: avatar }), 0, 0.85, 0.43));
  g.add(mesh(new CylinderGeometry(0.03, 0.03, 0.4, 6), toon(dark), 0, 1.5));
  const bulb = mesh(new SphereGeometry(0.09, 8, 8), flat(0xff3b3b), 0, 1.72);
  g.add(bulb);
  g.add(mesh(new BoxGeometry(0.2, 0.25, 0.4), toon(dark), -0.55, 0.85), mesh(new BoxGeometry(0.2, 0.25, 0.4), toon(dark), 0.55, 0.85));

  const torso = mesh(new BoxGeometry(1.15, 0.95, 0.75), toon(metal), 0, -0.15);
  g.add(torso, edges(torso, dark));
  g.add(mesh(new BoxGeometry(0.6, 0.35, 0.03), toon(dark), 0, -0.05, 0.38));
  [0xff3b3b, 0xffe135, 0x39ff14].forEach((c, i) => g.add(mesh(new BoxGeometry(0.1, 0.1, 0.04), flat(c), -0.18 + i * 0.18, -0.05, 0.4)));
  g.add(mesh(new BoxGeometry(0.55, 0.12, 0.04), flat(0x111111), 0, -0.4, 0.38));

  for (const s of [-1, 1]) {
    const arm = mesh(new CylinderGeometry(0.09, 0.09, 0.8, 8), toon(dark), s * 0.72, -0.2);
    arm.rotation.z = s * 0.25;
    g.add(arm);
    const claw = new Group();
    claw.position.set(s * 0.82, -0.62, 0);
    claw.add(mesh(new BoxGeometry(0.08, 0.22, 0.08), toon(metal), -0.07, -0.08), mesh(new BoxGeometry(0.08, 0.22, 0.08), toon(metal), 0.07, -0.08));
    g.add(claw);
  }

  const treads = mesh(new BoxGeometry(1.35, 0.36, 0.8), toon(0x2a2a2a), 0, -0.86);
  g.add(treads, edges(treads, 0x666666));
  for (const s of [-1, 1]) {
    for (const x of [-0.4, 0, 0.4]) {
      const wheel = mesh(new CylinderGeometry(0.13, 0.13, 0.06, 10), toon(0x777777), x, -0.86, s * 0.42);
      wheel.rotation.x = Math.PI / 2;
      g.add(wheel);
    }
  }
  const cap = hat(r, 1.3);
  if (cap) {
    cap.position.y = 1.3;
    g.add(cap);
  }

  g.scale.setScalar(0.8);
  g.position.y = -0.1;
  return {
    group: g,
    update: (t) => {
      (bulb.material as MeshBasicMaterial).color.setHex(Math.sin(t * 4) > 0 ? 0xff3b3b : 0x5a1010);
      const prop = cap?.getObjectByName("prop");
      if (prop) prop.rotation.y = t * 6;
    },
  };
}

function cube(avatar: Texture): Character {
  const g = new Group();
  const face = new MeshBasicMaterial({ map: avatar });
  const box = new Mesh(new BoxGeometry(1.35, 1.35, 1.35), face);
  const outline = edges(box, 0xffe135);
  g.add(box, outline);
  const orbit = mesh(new DodecahedronGeometry(0.16, 0), toon(0xffe135));
  g.add(orbit);
  return {
    group: g,
    update: (t) => {
      box.rotation.x = Math.sin(t * 0.7) * 0.5;
      outline.rotation.x = box.rotation.x;
      orbit.position.set(Math.cos(t * 1.5) * 1.25, Math.sin(t * 2.1) * 0.4, Math.sin(t * 1.5) * 1.25);
      orbit.rotation.set(t, t, 0);
    },
  };
}

function rock(avatar: Texture, r: () => number): Character {
  const g = new Group();
  const stone = pick(r, [0x8a8a8a, 0x7c7468, 0x6f7a80] as const);
  const boulder = mesh(new DodecahedronGeometry(1, 0), toon(stone), 0, -0.1);
  boulder.scale.set(1.15, 0.9, 1);
  boulder.rotation.set(0.2, r() * Math.PI, 0.1);
  g.add(boulder, edges(boulder, 0x3a3a3a, 10));
  for (let i = 0; i < 3; i++) {
    const moss = mesh(new SphereGeometry(0.22 + r() * 0.1, 8, 6), toon(0x4f8f2f), -0.5 + r() * 1.0, 0.55 + r() * 0.15, -0.3 + r() * 0.6);
    moss.scale.y = 0.45;
    g.add(moss);
  }
  // googly eyes
  for (const s of [-1, 1]) {
    g.add(mesh(new SphereGeometry(0.17, 10, 10), flat(0xffffff), s * 0.28, 0.42, 0.78));
    g.add(mesh(new SphereGeometry(0.08, 8, 8), flat(0x000000), s * 0.28 + s * 0.03, 0.4, 0.93));
  }
  // name tag sticker
  const tag = new Group();
  tag.position.set(0, -0.25, 1.08);
  tag.rotation.x = -0.15;
  tag.add(mesh(new PlaneGeometry(0.95, 0.72), flat(0xfafafa), 0, 0, -0.005));
  tag.add(mesh(new PlaneGeometry(0.95, 0.16), flat(0xd12a2a), 0, 0.28, -0.002));
  tag.add(mesh(new PlaneGeometry(0.5, 0.5), new MeshBasicMaterial({ map: avatar }), 0, -0.08));
  g.add(tag);
  g.scale.setScalar(0.95);
  return {
    group: g,
    update: (t) => {
      g.position.y = Math.abs(Math.sin(t * 2.4)) * 0.06;
    },
  };
}

const BUILDERS: Record<Kind, (avatar: Texture, r: () => number) => Character> = {
  caveman,
  gorilla,
  crt,
  banana,
  monolith,
  floppy,
  clanker,
  cube: (avatar) => cube(avatar),
  rock,
};

export function buildCharacter(kind: Kind, seed: number, avatar: Texture): Character {
  return BUILDERS[kind](avatar, rng(seed));
}

const loader = new TextureLoader();
loader.crossOrigin = "anonymous";

// Avatar texture; falls back to a drawn initial if GitHub is unreachable.
export function loadAvatar(url: string, fallbackText: string): Promise<Texture> {
  const { promise, resolve } = Promise.withResolvers<Texture>();
  loader.load(
    url,
    (tex) => {
      tex.colorSpace = SRGBColorSpace;
      resolve(tex);
    },
    undefined,
    () => resolve(initialTexture(fallbackText)),
  );
  return promise;
}

function initialTexture(text: string): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffe135";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#000";
  ctx.font = "bold 150px 'Comic Sans MS', 'Comic Neue', cursive";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.slice(0, 1).toUpperCase(), 128, 140);
  const tex = new Texture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
