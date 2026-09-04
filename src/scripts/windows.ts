// Win98 title-bar buttons. Minimize collapses the body, maximize toggles a wide
// variant, close shakes the window and says no. The page stays intact either way.

const CLOSE_LINES = ["nice try", "no.", "the tribe says no", "ooga? booga.", "closing is for engineers"];
let closeIndex = 0;

export function initWindows(): void {
  document.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-win]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const win = button.closest<HTMLElement>(".win");
    if (!win) return;
    const action = button.dataset.win;

    if (action === "min") {
      const body = win.querySelector<HTMLElement>(":scope > .win__body");
      if (!body) return;
      if (win.classList.contains("is-min")) {
        win.classList.remove("is-min");
        body.addEventListener("transitionend", () => (body.style.maxHeight = ""), { once: true });
        return;
      }
      body.style.maxHeight = `${body.scrollHeight}px`;
      requestAnimationFrame(() => win.classList.add("is-min"));
      return;
    }

    if (action === "max") {
      win.classList.toggle("is-max");
      return;
    }

    if (action === "close") {
      const name = win.querySelector<HTMLElement>(".win__name");
      if (!name || win.classList.contains("is-shake")) return;
      const original = name.textContent;
      name.textContent = CLOSE_LINES[closeIndex++ % CLOSE_LINES.length];
      win.classList.add("is-shake");
      win.addEventListener(
        "animationend",
        () => {
          win.classList.remove("is-shake");
          setTimeout(() => (name.textContent = original), 900);
        },
        { once: true },
      );
    }
  });
}
