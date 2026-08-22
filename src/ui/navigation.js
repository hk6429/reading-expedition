export function navigationItems() {
  return Object.freeze([
    { href: "#/", label: "個人挑戰" },
    { href: "#/city", label: "我的浮城" },
    { href: "#/class", label: "班級共建" },
    { href: "#/teacher", label: "教師校閱" },
  ]);
}

export function applyGlobalPreferences(root, preferences) {
  root.dataset.texture = preferences.textures === false ? "off" : "on";
  root.dataset.muted = preferences.muted === true ? "true" : "false";
  root.dataset.reducedMotion = String(preferences.reducedMotion === true);
  root.style.setProperty(
    "--reading-line-height",
    String(preferences.lineHeight ?? 1.85),
  );
}
