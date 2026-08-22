const MODES = Object.freeze([
  { id: "paper", label: "宣紙" },
  { id: "plain", label: "素紙" },
  { id: "night", label: "夜讀" },
]);

export function createReadingControls(
  preferences,
  onChange,
  { onSupportModeChange } = {},
) {
  const aside = document.createElement("aside");
  aside.className = "reading-controls";
  aside.setAttribute("aria-label", "閱讀顯示設定");
  aside.dataset.expanded = "false";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "reading-controls__toggle";
  toggle.textContent = "顯示設定";
  toggle.setAttribute("aria-expanded", "false");

  const panel = document.createElement("div");
  panel.className = "reading-controls__panel";
  toggle.addEventListener("click", () => {
    const expanded = aside.dataset.expanded !== "true";
    aside.dataset.expanded = String(expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "收合設定" : "顯示設定";
  });

  const heading = document.createElement("p");
  heading.className = "control-label";
  heading.textContent = "紙張模式";
  panel.append(heading);

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
  panel.append(modeGroup);

  if (onSupportModeChange) {
    const supportLabel = document.createElement("p");
    supportLabel.className = "control-label";
    supportLabel.textContent = "陪讀方式";
    const supportGroup = document.createElement("div");
    supportGroup.className = "support-mode-group";
    for (const [mode, label] of [
      ["guided", "引導"],
      ["independent", "獨立"],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute(
        "aria-pressed",
        String(preferences.supportMode === mode),
      );
      button.addEventListener("click", () => onSupportModeChange(mode));
      supportGroup.append(button);
    }
    panel.append(supportLabel, supportGroup);
  }

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
  panel.append(sizeGroup);

  const spacingLabel = document.createElement("p");
  spacingLabel.className = "control-label";
  spacingLabel.textContent = "閱讀行距";
  const spacingGroup = document.createElement("div");
  spacingGroup.className = "line-height-group";
  for (const [label, value] of [
    ["緊密 1.6", 1.6],
    ["舒適 1.9", 1.9],
    ["寬鬆 2.2", 2.2],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute(
      "aria-pressed",
      String(Math.abs(preferences.lineHeight - value) < 0.06),
    );
    button.addEventListener("click", () => {
      preferences.lineHeight = value;
      document.documentElement.style.setProperty(
        "--reading-line-height",
        String(value),
      );
      spacingGroup.querySelectorAll("button").forEach((peer) => {
        peer.setAttribute("aria-pressed", String(peer === button));
      });
      onChange(preferences);
    });
    spacingGroup.append(button);
  }
  panel.append(spacingLabel, spacingGroup);

  const comfortLabel = document.createElement("p");
  comfortLabel.className = "control-label";
  comfortLabel.textContent = "視覺舒適";
  const comfortGroup = document.createElement("div");
  comfortGroup.className = "comfort-group";
  for (const [label, field, enabledValue] of [
    ["減少動效", "reducedMotion", true],
    ["純色背景", "textures", false],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    const active = preferences[field] === enabledValue;
    button.setAttribute("aria-pressed", String(active));
    button.addEventListener("click", () => {
      const nextActive = button.getAttribute("aria-pressed") !== "true";
      preferences[field] = nextActive ? enabledValue : !enabledValue;
      button.setAttribute("aria-pressed", String(nextActive));
      document.documentElement.dataset.reducedMotion = String(
        preferences.reducedMotion === true,
      );
      document.documentElement.dataset.texture =
        preferences.textures === false ? "off" : "on";
      onChange(preferences);
    });
    comfortGroup.append(button);
  }
  panel.append(comfortLabel, comfortGroup);
  aside.append(toggle, panel);

  return aside;
}
