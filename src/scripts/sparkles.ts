// Cursor sparkle trail, 2001 edition. Skips touch devices and reduced motion.

export function initSparkles(): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!matchMedia("(pointer: fine)").matches) return;

  const MAX = 14;
  const pool: HTMLSpanElement[] = [];
  let last = 0;
  let cursor = 0;

  document.addEventListener(
    "pointermove",
    (event) => {
      const now = performance.now();
      if (now - last < 40) return;
      last = now;

      let el = pool[cursor];
      if (!el) {
        el = document.createElement("span");
        el.className = "sparkle";
        document.body.appendChild(el);
        pool[cursor] = el;
      } else {
        // restart the CSS animation
        el.style.animation = "none";
        void el.offsetWidth;
        el.style.animation = "";
      }
      el.style.left = `${event.clientX + (Math.random() * 10 - 5)}px`;
      el.style.top = `${event.clientY + (Math.random() * 10 - 5)}px`;
      cursor = (cursor + 1) % MAX;
    },
    { passive: true },
  );
}
