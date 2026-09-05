import { STAR_CATALOG_B64, STAR_CATALOG_COUNT, STAR_RECORD_BYTES } from "@/data/bright-stars";

interface Star {
  x: number;
  y: number;
  z: number;
  radius: number;
  alpha: number;
  color: string;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  age: number;
  life: number;
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const AUTO_ROTATION_PERIOD = 30 * 60;
const PRECESSION_PERIOD = 4 * 60 * 60;
const AUTO_ROTATION_SPEED = TAU / AUTO_ROTATION_PERIOD;
const PRECESSION_SPEED = TAU / PRECESSION_PERIOD;
const PRECESSION_AMPLITUDE = 78 * DEG;
const SKY_POSITION_KEY = "ooga-booga:sky-position";
const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

function readSkyPosition(): { yaw: number; pitch: number } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SKY_POSITION_KEY) ?? "null");
    if (Number.isFinite(saved?.yaw) && Number.isFinite(saved?.pitch)) {
      return { yaw: wrapAngle(saved.yaw), pitch: wrapAngle(saved.pitch) };
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }
  return null;
}

function temperatureColor(kelvin: number): string {
  if (kelvin < 3500) return "#ffc38b";
  if (kelvin < 5000) return "#ffe6bd";
  if (kelvin < 7500) return "#fffdf4";
  if (kelvin < 12000) return "#dce9ff";
  return "#aec8ff";
}

function decodeCatalog(): Star[] {
  const raw = atob(STAR_CATALOG_B64);
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const stars: Star[] = [];
  const minLogK = Math.log(2500);
  const logKRange = Math.log(30000) - minLogK;

  for (let i = 0; i < STAR_CATALOG_COUNT; i++) {
    const offset = i * STAR_RECORD_BYTES;
    const ra = (view.getUint16(offset, true) / 65535) * TAU;
    const dec = (view.getInt16(offset + 2, true) / 32767) * 90 * DEG;
    const magnitude = view.getUint8(offset + 4) / 34 - 1.5;
    const kelvin = Math.exp(minLogK + (view.getUint8(offset + 5) / 255) * logKRange);
    const cosDec = Math.cos(dec);
    const strength = Math.max(0, Math.min(1, (6.15 - magnitude) / 7.65));
    stars.push({
      x: cosDec * Math.cos(ra),
      y: Math.sin(dec),
      z: cosDec * Math.sin(ra),
      radius: 0.56 + Math.pow(strength, 1.5) * 2.15,
      alpha: 0.42 + Math.pow(strength, 1.15) * 0.58,
      color: temperatureColor(kelvin),
    });
  }
  return stars;
}

function siderealAngle(now: number): number {
  const julianDate = now / 86400000 + 2440587.5;
  const degrees = 280.46061837 + 360.98564736629 * (julianDate - 2451545);
  return ((degrees % 360) + 360) % 360 * DEG;
}

export function initStarfield(): () => void {
  const canvas = document.createElement("canvas");
  canvas.className = "starfield-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return () => canvas.remove();

  const stars = decodeCatalog();
  const meteors: Meteor[] = [];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let last = performance.now();
  let lastDraw = 0;
  let nextMeteor = last + 3000 + Math.random() * 6000;
  const savedSkyPosition = readSkyPosition();
  let skyYaw = savedSkyPosition?.yaw ?? 0;
  let skyPitch = savedSkyPosition?.pitch ?? 0;
  let yawVelocity = 0;
  let pitchVelocity = 0;
  let skyPositionDirty = false;
  let lastPositionSave = 0;
  let pointerId = -1;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragX = 0;
  let dragY = 0;
  let dragTime = 0;
  let skyDragging = false;
  let skyMoved = false;

  const persistSkyPosition = (now = performance.now()) => {
    if (!skyPositionDirty) return;
    try {
      localStorage.setItem(SKY_POSITION_KEY, JSON.stringify({ yaw: wrapAngle(skyYaw), pitch: wrapAngle(skyPitch) }));
    } catch {
      // The rotating sky remains usable when local storage is unavailable.
    }
    skyPositionDirty = false;
    lastPositionSave = now;
  };

  const resize = () => {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio, 1.75);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSky();
  };

  const spawnMeteor = () => {
    const direction = Math.random() < 0.72 ? 1 : -1;
    const speed = 620 + Math.random() * 420;
    const slope = 0.28 + Math.random() * 0.34;
    meteors.push({
      x: direction > 0 ? -80 : width + 80,
      y: height * (0.05 + Math.random() * 0.58),
      vx: speed * direction,
      vy: speed * slope,
      length: 90 + Math.random() * 150,
      age: 0,
      life: (width + 260) / speed,
    });
  };

  const drawSky = () => {
    ctx.clearRect(0, 0, width, height);
    const wallTime = Date.now() * 0.001;
    const autoRotation = reduced ? 0 : (wallTime % AUTO_ROTATION_PERIOD) * AUTO_ROTATION_SPEED;
    const precession = reduced ? 0 : Math.sin((wallTime % PRECESSION_PERIOD) * PRECESSION_SPEED) * PRECESSION_AMPLITUDE;
    const centerRa = siderealAngle(Date.now()) + autoRotation + skyYaw;
    const centerDec = 18 * DEG + precession + skyPitch;
    const cosRa = Math.cos(centerRa);
    const sinRa = Math.sin(centerRa);
    const cosDec = Math.cos(centerDec);
    const sinDec = Math.sin(centerDec);
    const focal = Math.max(width * 0.31, height * 0.44);
    for (const star of stars) {
      const right = -sinRa * star.x + cosRa * star.z;
      const forward = cosDec * (cosRa * star.x + sinRa * star.z) + sinDec * star.y;
      if (forward < 0.32) continue;
      const up = -sinDec * (cosRa * star.x + sinRa * star.z) + cosDec * star.y;
      const sx = width * 0.5 + (right / forward) * focal;
      const sy = height * 0.5 - (up / forward) * focal;
      if (sx < -4 || sx > width + 4 || sy < -4 || sy > height + 4) continue;
      const brightness = Math.max(0, Math.min(1, (star.radius - 0.95) / 1.0));
      const radius = star.radius * (0.86 + Math.min(0.3, 1 / forward) * 0.18);
      if (star.radius > 1.35) {
        const glowRadius = radius * 2.6;
        const glow = ctx.createRadialGradient(sx, sy, radius * 0.55, sx, sy, glowRadius);
        glow.addColorStop(0, star.color);
        glow.addColorStop(0.22, star.color);
        glow.addColorStop(1, "transparent");
        ctx.globalAlpha = star.alpha * (0.07 + brightness * 0.04);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, glowRadius, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, TAU);
      ctx.fill();
      if (star.radius > 1.55) {
        ctx.globalAlpha = star.alpha * (0.12 + brightness * 0.06);
        ctx.fillRect(sx - radius * 2, sy - 0.25, radius * 4, 0.5);
        ctx.fillRect(sx - 0.25, sy - radius * 2, 0.5, radius * 4);
      }
    }
    ctx.globalAlpha = 1;
  };

  const drawMeteors = (dt: number, now: number) => {
    if (now >= nextMeteor) {
      spawnMeteor();
      nextMeteor = now + 7000 + Math.random() * 15000;
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const meteor = meteors[i];
      meteor.age += dt;
      meteor.x += meteor.vx * dt;
      meteor.y += meteor.vy * dt;
      if (meteor.age >= meteor.life) {
        meteors.splice(i, 1);
        continue;
      }
      const speed = Math.hypot(meteor.vx, meteor.vy);
      const ux = meteor.vx / speed;
      const uy = meteor.vy / speed;
      const fade = Math.sin((meteor.age / meteor.life) * Math.PI);
      const tailX = meteor.x - ux * meteor.length;
      const tailY = meteor.y - uy * meteor.length;
      const gradient = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
      gradient.addColorStop(0, "rgba(180,215,255,0)");
      gradient.addColorStop(0.72, `rgba(220,235,255,${0.34 * fade})`);
      gradient.addColorStop(1, `rgba(255,255,255,${0.95 * fade})`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.2 + fade * 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(meteor.x, meteor.y);
      ctx.stroke();
    }
  };

  const frame = (now: number) => {
    if (now - lastDraw < 32) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    lastDraw = now;
    if (!skyDragging) {
      skyYaw += yawVelocity * dt;
      skyPitch += pitchVelocity * dt;
      if (Math.abs(yawVelocity) > 0.0001 || Math.abs(pitchVelocity) > 0.0001) skyPositionDirty = true;
      const inertia = Math.exp(-dt * 2.8);
      yawVelocity *= inertia;
      pitchVelocity *= inertia;
      if (Math.abs(skyYaw) > TAU * 4) skyYaw = wrapAngle(skyYaw);
      if (Math.abs(skyPitch) > TAU * 4) skyPitch = wrapAngle(skyPitch);
      if (skyPositionDirty && now - lastPositionSave > 500) persistSkyPosition(now);
    }
    drawSky();
    if (!reduced) drawMeteors(dt, now);
    if (!reduced && !document.hidden) raf = requestAnimationFrame(frame);
  };

  const onVisibility = () => {
    cancelAnimationFrame(raf);
    if (document.hidden) {
      persistSkyPosition();
    } else if (!reduced) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  const blocksSkyDrag = (target: EventTarget | null) =>
    target instanceof Element
    && Boolean(target.closest("a, button, input, textarea, select, [data-viewport], [data-draggable-marquee], .win, [contenteditable='true']"));

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || pointerId !== -1 || blocksSkyDrag(event.target)) return;
    pointerId = event.pointerId;
    dragStartX = dragX = event.clientX;
    dragStartY = dragY = event.clientY;
    dragTime = event.timeStamp;
    skyDragging = true;
    skyMoved = false;
    yawVelocity = 0;
    pitchVelocity = 0;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!skyDragging || event.pointerId !== pointerId) return;
    if (!skyMoved && Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY) < 5) return;
    skyMoved = true;
    const dx = event.clientX - dragX;
    const dy = event.clientY - dragY;
    const dt = Math.max(8, event.timeStamp - dragTime) / 1000;
    const yawDelta = -dx * 0.0042;
    const pitchDelta = dy * 0.0036;
    skyYaw += yawDelta;
    skyPitch += pitchDelta;
    skyPositionDirty = true;
    yawVelocity = yawDelta / dt;
    pitchVelocity = pitchDelta / dt;
    dragX = event.clientX;
    dragY = event.clientY;
    dragTime = event.timeStamp;
    document.documentElement.classList.add("sky-dragging");
    event.preventDefault();
    if (reduced) drawSky();
  };

  const endSkyDrag = (event: PointerEvent) => {
    if (!skyDragging || event.pointerId !== pointerId) return;
    skyDragging = false;
    pointerId = -1;
    document.documentElement.classList.remove("sky-dragging");
    if (!skyMoved || reduced) {
      yawVelocity = 0;
      pitchVelocity = 0;
    }
    persistSkyPosition(event.timeStamp);
  };

  const onPageHide = () => persistSkyPosition();

  resize();
  addEventListener("resize", resize);
  addEventListener("pointerdown", onPointerDown);
  addEventListener("pointermove", onPointerMove, { passive: false });
  addEventListener("pointerup", endSkyDrag);
  addEventListener("pointercancel", endSkyDrag);
  addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onVisibility);
  if (!reduced) raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("resize", resize);
    removeEventListener("pointerdown", onPointerDown);
    removeEventListener("pointermove", onPointerMove);
    removeEventListener("pointerup", endSkyDrag);
    removeEventListener("pointercancel", endSkyDrag);
    removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibility);
    document.documentElement.classList.remove("sky-dragging");
    persistSkyPosition();
    canvas.remove();
  };
}
