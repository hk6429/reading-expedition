const MODES = Object.freeze([
  { id: "paper", label: "宣紙" },
  { id: "plain", label: "素紙" },
  { id: "night", label: "夜讀" },
]);

export function createReadingControls(preferences, onChange) {
  const aside = document.createElement("aside");
  aside.className = "reading-controls";
  aside.setAttribute("aria-label", "閱讀顯示設定");

  const heading = document.createElement("p");
  heading.className = "control-label";
  heading.textContent = "紙張模式";
  aside.append(heading);

  const modeGroup = document.createElement("div");
  modeGroup.className = "mode-group";
  for (const mode of MODES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = mode.label;
    button.setAttribute("aria-pressed", String(preferences.mode === mode.id));
    button.addEventListener("click", () => {
      preferences.mode = mode.id;
      document.documentElement.dataset.readingMode = mode.id;
      for (const peer of modeGroup.querySelectorAll("button")) {
        peer.setAttribute("aria-pressed", String(peer === button));
      }
      onChange(preferences);
    });
    modeGroup.append(button);
  }
  aside.append(modeGroup);

  const sizeGroup = document.createElement("div");
  sizeGroup.className = "font-size-group";
  for (const [label, delta] of [
    ["縮小文字", -0.1],
    ["放大文字", 0.1],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.textContent = delta > 0 ? "字＋" : "字－";
    button.addEventListener("click", () => {
      preferences.fontScale = Math.min(
        1.4,
        Math.max(0.9, Number((preferences.fontScale + delta).toFixed(1))),
      );
      document.documentElement.style.setProperty(
        "--reading-scale",
        preferences.fontScale,
      );
      onChange(preferences);
    });
    sizeGroup.append(button);
  }
  aside.append(sizeGroup);

  return aside;
}
