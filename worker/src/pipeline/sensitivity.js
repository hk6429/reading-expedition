const SENSITIVITY_PATTERNS = Object.freeze({
  war: /戰爭|武裝衝突|軍事攻擊|war\b|armed conflict/i,
  disaster: /災難|地震|颱風|洪水|野火|土石流|disaster|earthquake|typhoon/i,
  death: /死亡|喪生|罹難|死者|death|killed|fatalit/i,
  crime: /犯罪|兇殺|綁架|詐騙|毒品|crime|murder|kidnap/i,
  gender_violence: /性暴力|性侵|性騷擾|家暴|gender.?based violence|sexual assault/i,
  politics: /政治|選舉|政黨|政府責任|總統|立法院|politic|election/i,
  major_health: /疫情|傳染病|重大疾病|癌症|疫苗風險|pandemic|epidemic|major health/i,
});

export function sensitivityFlagsFor(text) {
  return Object.entries(SENSITIVITY_PATTERNS)
    .filter(([, pattern]) => pattern.test(String(text ?? "")))
    .map(([flag]) => flag);
}

export function requiresManualReview(flags) {
  return Array.isArray(flags) && flags.length > 0;
}
