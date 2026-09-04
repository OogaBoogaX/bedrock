// Fake browser status bar: shows link targets on hover and a clock.

export function initStatusBar(): void {
  const status = document.querySelector<HTMLElement>("[data-status]");
  const clock = document.querySelector<HTMLElement>("[data-clock]");
  if (!status || !clock) return;

  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };
  tick();
  setInterval(tick, 15_000);

  document.addEventListener("pointerover", (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    const custom = (event.target as HTMLElement).closest<HTMLElement>("[data-status-text]");
    if (custom?.dataset.statusText) status.textContent = custom.dataset.statusText;
    else if (link) status.textContent = `Opening ${link.href.replace(/^https?:\/\//, "")}`;
    else status.textContent = "Done";
  });
  document.addEventListener("pointerout", () => (status.textContent = "Done"));
}
