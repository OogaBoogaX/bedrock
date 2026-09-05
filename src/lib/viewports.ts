import { DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Raycaster, Scene, Timer, Vector2, Vector3, WebGLRenderer } from "three";
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
//   data-drag   pointer drag rotates horizontally and vertically
//   data-wheel-zoom  wheel zooms the model without scrolling the page
//   data-zoom-min / data-zoom-max  wheel-scale limits (defaults .78 / 1.22)
//   data-overflow-y  vertical render overflow per side, as a fraction of height
//   data-frame-inset  keeps this many CSS pixels clear for a DOM border above WebGL
//   data-angle  initial y rotation in radians
//   data-static  holds the initial angle instead of idly or hover-spinning
//   data-hide-sticker  hides the procedural banana's avatar sticker
//   data-follow-overlay  selector for a sibling overlay that follows model motion
//   data-kick   click flips it over and emits `viewport:kick`

const BASE_FOV = 36;

interface View {
  el: HTMLElement;
  scene: Scene;
  camera: PerspectiveCamera;
  rig: Group;
  character: Character | null;
  characterBasePosition: Vector3 | null;
  build: (() => void) | null;
  followOverlay: HTMLElement | null;
  staticView: boolean;
  baseSpin: number;
  spin: number;
  angle: number;
  pitch: number;
  zoom: number;
  zoomHold: number;
  overflowY: number;
  frameInset: number;
  flip: number;
  flipTarget: number;
  hover: boolean;
  dragging: boolean;
  dragX: number;
  dragY: number;
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
  let canvasScrollX = Number.NaN;
  let canvasScrollY = Number.NaN;

  const anchorCanvas = () => {
    if (scrollX === canvasScrollX && scrollY === canvasScrollY) return;
    canvasScrollX = scrollX;
    canvasScrollY = scrollY;
    canvas.style.transform = `translate3d(${canvasScrollX}px, ${canvasScrollY}px, 0)`;
  };

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    anchorCanvas();
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
    const wheelZoom = "wheelZoom" in el.dataset;
    const wheelMin = Number(el.dataset.zoomMin) || 0.78;
    const wheelMax = Number(el.dataset.zoomMax) || 1.22;
    const overflowY = Math.max(0, Number(el.dataset.overflowY) || 0);
    const frameInset = Math.max(0, Number(el.dataset.frameInset) || 0);
    const staticView = "static" in el.dataset;
    const followOverlay = el.dataset.followOverlay
      ? (el.parentElement?.querySelector<HTMLElement>(el.dataset.followOverlay) ?? null)
      : null;
    const initialAngle = el.dataset.angle === undefined ? ((seed % 80) - 40) / 100 : Number(el.dataset.angle) || 0;
    const kick = "kick" in el.dataset;
    let suppressClick = false;
    const scene = new Scene();
    scene.add(new HemisphereLight(0xffffff, 0x8a6d2a, 2.4));
    const key = new DirectionalLight(0xffffff, 2.8);
    key.position.set(2.5, 4, 3.5);
    scene.add(key);
    const camera = new PerspectiveCamera(BASE_FOV, 1, 0.1, 50);
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
      characterBasePosition: null,
      build: null,
      followOverlay,
      staticView,
      baseSpin: reduced || staticView ? 0 : (0.45 + (seed % 100) / 250) * (Number(el.dataset.spin) || 1),
      spin: 0,
      angle: initialAngle,
      pitch: 0,
      zoom: 1,
      zoomHold: 0,
      overflowY,
      frameInset,
      flip: 0,
      flipTarget: 0,
      hover: false,
      dragging: false,
      dragX: 0,
      dragY: 0,
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
        if ("hideSticker" in el.dataset) {
          character.group.traverse((part) => {
            if (part.name === "banana-sticker") part.visible = false;
          });
        }
        view.character = character;
        view.characterBasePosition = character.group.position.clone();
        rig.add(character.group);
        el.classList.add("is-ready");
        if (!raf && views.some((v) => v.visible)) start();
      });
    };

    el.addEventListener("pointerenter", () => {
      if (view.staticView) return;
      view.hover = true;
      view.bounceV += 2.4;
    });
    el.addEventListener("pointerleave", () => {
      view.hover = false;
    });
    if (drag || kick) {
      el.style.touchAction = drag ? "none" : "pan-y";
      el.addEventListener("dragstart", (e) => e.preventDefault());
      el.addEventListener("pointerdown", (e) => {
        view.dragging = drag;
        view.dragX = e.clientX;
        view.dragY = e.clientY;
        view.dragDist = 0;
        if (drag) el.setPointerCapture(e.pointerId);
      });
      el.addEventListener("pointermove", (e) => {
        if (!view.dragging) return;
        const dx = e.clientX - view.dragX;
        const dy = e.clientY - view.dragY;
        view.dragDist += Math.hypot(dx, dy);
        view.angle += dx * 0.012;
        view.pitch += dy * 0.012;
        view.dragX = e.clientX;
        view.dragY = e.clientY;
      });
      el.addEventListener("pointerup", () => {
        const dragged = view.dragDist > 6;
        view.dragging = false;
        if (dragged) view.pitch = Math.atan2(Math.sin(view.pitch), Math.cos(view.pitch));
        if (dragged) {
          suppressClick = true;
          setTimeout(() => (suppressClick = false), 0);
        }
        if (!kick || dragged) return;
        view.flipTarget += Math.PI * 2;
        view.bounceV += 4;
        el.dispatchEvent(new CustomEvent("viewport:kick", { bubbles: true }));
      });
      el.addEventListener("pointercancel", () => {
        view.dragging = false;
        view.pitch = Math.atan2(Math.sin(view.pitch), Math.cos(view.pitch));
      });
      el.addEventListener("click", (e) => {
        if (!suppressClick) return;
        e.preventDefault();
        e.stopPropagation();
        suppressClick = false;
      });
    }
    if (wheelZoom) {
      const raycaster = new Raycaster();
      const pointer = new Vector2();
      el.addEventListener(
        "wheel",
        (e) => {
          if (!view.character) return;
          const rect = el.getBoundingClientRect();
          const overflow = rect.height * view.overflowY;
          const renderHeight = rect.height + overflow * 2;
          pointer.set(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            1 - ((e.clientY - rect.top + overflow) / renderHeight) * 2,
          );
          raycaster.setFromCamera(pointer, view.camera);
          if (!raycaster.intersectObject(view.rig, true).length) return;
          e.preventDefault();
          const direction = Math.sign(e.deltaY);
          const magnitude = e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? Math.min(1, Math.abs(e.deltaY) / 100) : 1;
          view.zoom = Math.max(wheelMin, Math.min(wheelMax, view.zoom - direction * magnitude * 0.12));
          view.zoomHold = 0.22;
        },
        { passive: false },
      );
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
    anchorCanvas();

    for (const view of views) {
      if (!view.visible || !view.character) continue;
      const rect = view.el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > h || rect.right < 0 || rect.left > innerWidth || rect.width < 2) continue;

      const target = view.staticView || view.dragging ? 0 : view.hover ? 3.2 : view.baseSpin;
      view.spin += (target - view.spin) * Math.min(1, dt * 5);
      view.angle += view.spin * dt;
      if (!view.dragging) {
        view.pitch += (0 - view.pitch) * Math.min(1, dt * 1.6);
        if (Math.abs(view.pitch) < 0.0005) view.pitch = 0;
      }
      view.zoomHold = Math.max(0, view.zoomHold - dt);
      if (view.zoomHold === 0 && !view.dragging) {
        view.zoom += (1 - view.zoom) * Math.min(1, dt * 1.6);
        if (Math.abs(view.zoom - 1) < 0.0005) view.zoom = 1;
      }
      view.bounceV += (-view.bounce * 70 - view.bounceV * 7) * dt;
      view.bounce += view.bounceV * dt;
      view.flip += (view.flipTarget - view.flip) * Math.min(1, dt * 4.5);
      view.rig.rotation.set(view.pitch + view.flip, view.angle, view.rig.rotation.z);
      view.rig.scale.setScalar(view.zoom);
      view.rig.position.y = view.bounce * 0.25;
      view.character.update?.(t);

      // A zoomed hero can paint beyond its DOM box without changing layout.
      // Expanding the vertical FOV in the same proportion keeps its on-screen
      // scale stable while the taller viewport removes the clipping boundary.
      const overflow = rect.height * view.overflowY;
      const renderHeight = rect.height + overflow * 2;
      const aspect = rect.width / renderHeight;
      const fov = (Math.atan(Math.tan((BASE_FOV * Math.PI) / 360) * (renderHeight / rect.height)) * 360) / Math.PI;
      if (Math.abs(view.camera.aspect - aspect) > 1e-3 || Math.abs(view.camera.fov - fov) > 1e-3) {
        view.camera.aspect = aspect;
        view.camera.fov = fov;
        view.camera.updateProjectionMatrix();
      }
      if (view.followOverlay && view.characterBasePosition) {
        // Project the model's real idle offset into this viewport so a DOM
        // overlay stays registered to the moving mesh rather than drifting.
        view.rig.updateWorldMatrix(true, true);
        view.camera.updateMatrixWorld();
        const current = view.character.group.position.clone();
        const baseline = view.characterBasePosition.clone();
        view.rig.localToWorld(current).project(view.camera);
        view.rig.localToWorld(baseline).project(view.camera);
        const x = ((current.x - baseline.x) * rect.width) / 2;
        const y = ((baseline.y - current.y) * renderHeight) / 2;
        view.followOverlay.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      const viewportBottom = h - (rect.bottom + overflow);
      const scissorLeft = Math.max(0, rect.left + view.frameInset);
      const scissorRight = Math.min(innerWidth, rect.right - view.frameInset);
      const scissorTop = Math.max(0, rect.top - overflow + view.frameInset);
      const scissorBottomEdge = Math.min(h, rect.bottom + overflow - view.frameInset);
      renderer.setViewport(rect.left, viewportBottom, rect.width, renderHeight);
      renderer.setScissor(
        scissorLeft,
        h - scissorBottomEdge,
        Math.max(0, scissorRight - scissorLeft),
        Math.max(0, scissorBottomEdge - scissorTop),
      );
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
