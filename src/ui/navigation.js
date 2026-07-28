export function navigationItems() {
  return Object.freeze([
    { href: "#/", label: "今日航線" },
    { href: "#/city", label: "我的浮城" },
    { href: "#/class", label: "班級共建" },
    { href: "#/teacher", label: "教師校閱" },
  ]);
}

export function applyGlobalPreferences(root, preferences) {
  root.dataset.texture = preferences.texture === false ? "off" : "on";
  root.dataset.muted = preferences.muted === false ? "false" : "true";
}
