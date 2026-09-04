import { DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Scene, Timer, WebGLRenderer } from "three";
import { buildCharacter, loadAvatar, type Character } from "./characters";
import { hash } from "./hash";
import type { Kind } from "./kinds";
// One renderer, many small scenes. Each `[data-viewport]` element reserves a rect;
// the fixed, transparent canvas draws into it through scissor tests. This keeps
// two dozen spinning characters on a single WebGL context.
//
// Per-element options (data attributes):
//   data-login, data-kind, data-avatar  what to build and whose face to use
//   data-model  URL of a .glb that replaces the procedural character
//   data-size   avatar texture size (default 256)
//   data-zoom   camera distance multiplier (<1 = closer)
//   data-tilt   rig tilt around z, radians
//   data-spin   idle spin multiplier
//   data-drag   pointer drag rotates
//   data-kick   click flips it over and emits `viewport:kick`

interface View {
  el: HTMLElement;
  scene: Scene;
  camera: PerspectiveCamera;
  rig: Group;
  character: Character | null;
  build: (() => void) | null;
  baseSpin: number;
  spin: number;
  angle: number;
  flip: number;
  flipTarget: number;
  hover: boolean;
  dragging: boolean;
  dragX: number;
  dragDist: number;
  bounce: number;
  bounceV: number;
  visible: boolean;
}

export function mountViewports(root: ParentNode): () => void {
  const els = [...root.querySelectorAll<HTMLElement>("[data-viewport]")];
  if (!els.length) return () => {};

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  } catch {
    els.forEach((el) => el.classList.add("no-webgl"));
    return () => {};
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.setScissorTest(true);
  const canvas = renderer.domElement;
  canvas.className = "viewports-canvas";
  document.body.appendChild(canvas);

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timer = new Timer();
  const views: View[] = [];
  let raf = 0;
  let disposed = false;

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
  };
  resize();
  addEventListener("resize", resize);

  for (const el of els) {
    const login = el.dataset.login ?? "";
    const kind = (el.dataset.kind ?? "cube") as Kind;
    const seed = hash(login.toLowerCase());
    const zoom = Number(el.dataset.zoom) || 1;
    const size = Number(el.dataset.size) || 256;
    const drag = "drag" in el.dataset;
    const kick = "kick" in el.dataset;
    const scene = new Scene();
    scene.add(new HemisphereLight(0xffffff, 0x8a6d2a, 2.4));
    const key = new DirectionalLight(0xffffff, 2.8);
    key.position.set(2.5, 4, 3.5);
    scene.add(key);
    const camera = new PerspectiveCamera(36, 1, 0.1, 50);
    camera.position.set(0, 0.25 * zoom, 4.8 * zoom);
    camera.lookAt(0, 0, 0);
    const rig = new Group();
    rig.rotation.z = Number(el.dataset.tilt) || 0;
    scene.add(rig);

    const view: View = {
      el,
      scene,
      camera,
      rig,
      character: null,
      build: null,
      baseSpin: reduced ? 0 : (0.45 + (seed % 100) / 250) * (Number(el.dataset.spin) || 1),
      spin: 0,
      angle: ((seed % 80) - 40) / 100,
      flip: 0,
      flipTarget: 0,
      hover: false,
      dragging: false,
      dragX: 0,
      dragDist: 0,
      bounce: 0,
      bounceV: 0,
      visible: false,
    };
    views.push(view);

    const url = new URL(el.dataset.avatar ?? "");
    url.searchParams.set("s", String(size));
    const procedural = () => loadAvatar(url.toString(), login).then((tex) => buildCharacter(kind, seed, tex));
    const modelUrl = el.dataset.model;
    // Assets (a .glb can be a couple of MB) only load once the card scrolls near the viewport.
    view.build = () => {
      view.build = null;
      const pending = modelUrl
        ? import("./models")
            .then((m) => {
              scene.environment = m.environment(renderer);
              return m.loadModel(modelUrl);
            })
            .catch((err: unknown) => {
              console.warn(`model ${modelUrl} failed, using procedural ${kind}`, err);
              return procedural();
            })
        : procedural();
      pending.then((character) => {
        if (disposed) return;
        view.character = character;
        rig.add(character.group);
        el.classList.add("is-ready");
        if (!raf && views.some((v) => v.visible)) start();
      });
    };

    el.addEventListener("pointerenter", () => {
      view.hover = true;
      view.bounceV += 2.4;
    });
    el.addEventListener("pointerleave", () => {
      view.hover = false;
      view.dragging = false;
    });
    if (drag || kick) {
      el.style.touchAction = "pan-y";
      el.addEventListener("pointerdown", (e) => {
        view.dragging = drag;
        view.dragX = e.clientX;
        view.dragDist = 0;
        if (drag) el.setPointerCapture(e.pointerId);
      });
      el.addEventListener("pointermove", (e) => {
        if (!view.dragging) return;
        const dx = e.clientX - view.dragX;
        view.dragDist += Math.abs(dx);
        view.angle += dx * 0.012;
        view.dragX = e.clientX;
      });
      el.addEventListener("pointerup", () => {
        const dragged = view.dragDist > 6;
        view.dragging = false;
        if (!kick || dragged) return;
        view.flipTarget += Math.PI * 2;
        view.bounceV += 4;
        el.dispatchEvent(new CustomEvent("viewport:kick", { bubbles: true }));
      });
      el.addEventListener("pointercancel", () => (view.dragging = false));
    }
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const view = views.find((v) => v.el === entry.target);
        if (!view) continue;
        view.visible = entry.isIntersecting;
        if (entry.isIntersecting) view.build?.();
      }
      if (views.some((v) => v.visible)) start();
      else stop();
    },
    { rootMargin: "400px 0px" },
  );
  views.forEach((v) => io.observe(v.el));

  function frame() {
    raf = requestAnimationFrame(frame);
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();
    const h = innerHeight;

    for (const view of views) {
      if (!view.visible || !view.character) continue;
      const rect = view.el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > h || rect.right < 0 || rect.left > innerWidth || rect.width < 2) continue;

      const target = view.dragging ? 0 : view.hover ? 3.2 : view.baseSpin;
      view.spin += (target - view.spin) * Math.min(1, dt * 5);
      view.angle += view.spin * dt;
      view.bounceV += (-view.bounce * 70 - view.bounceV * 7) * dt;
      view.bounce += view.bounceV * dt;
      view.flip += (view.flipTarget - view.flip) * Math.min(1, dt * 4.5);
      view.rig.rotation.set(view.flip, view.angle, view.rig.rotation.z);
      view.rig.position.y = view.bounce * 0.25;
      view.character.update?.(t);

      const aspect = rect.width / rect.height;
      if (Math.abs(view.camera.aspect - aspect) > 1e-3) {
        view.camera.aspect = aspect;
        view.camera.updateProjectionMatrix();
      }
      const bottom = h - rect.bottom;
      renderer.setViewport(rect.left, bottom, rect.width, rect.height);
      renderer.setScissor(rect.left, bottom, rect.width, rect.height);
      renderer.render(view.scene, view.camera);
    }
  }

  function start() {
    if (raf || disposed) return;
    timer.update();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    renderer.clear();
  }

  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : views.some((v) => v.visible) && start()));

  return () => {
    disposed = true;
    stop();
    io.disconnect();
    removeEventListener("resize", resize);
    renderer.dispose();
    canvas.remove();
  };
}
