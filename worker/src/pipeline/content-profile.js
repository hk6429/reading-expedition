const TEXT_TYPES = new Set(["vernacular", "classical"]);
const CLASSICAL_DAYS = new Set([2, 4, 6]);

function paragraphText(paragraph) {
  if (typeof paragraph === "string") return paragraph;
  return typeof paragraph?.text === "string" ? paragraph.text : "";
}

export function readingText(reading) {
  return Array.isArray(reading?.body)
    ? reading.body.map(paragraphText).join("")
    : "";
}

export function countReadingCharacters(reading) {
  return readingText(reading).replace(/\s/g, "").length;
}

export function countHanCharacters(reading) {
  return readingText(reading).match(/\p{Script=Han}/gu)?.length ?? 0;
}

function glossaryIsValid(reading, text) {
  if (!Array.isArray(reading.glossary)) return false;
  const terms = reading.glossary.map(({ term }) => term?.trim());
  return (
    new Set(terms).size === terms.length &&
    reading.glossary.every(
      ({ term, definition }) =>
        typeof term === "string" &&
        term.trim().length > 0 &&
        typeof definition === "string" &&
        definition.trim().length > 0 &&
        text.includes(term.trim()),
    )
  );
}

export function evaluateContentProfile(reading) {
  const textType = reading?.textType;
  const text = readingText(reading);
  const characters = countReadingCharacters(reading);
  const hanCharacters = countHanCharacters(reading);
  const uniqueHanCharacters = new Set(text.match(/\p{Script=Han}/gu) ?? []).size;
  const glossaryCount = Array.isArray(reading?.glossary)
    ? reading.glossary.length
    : 0;
  const reasons = [];

  if (!TEXT_TYPES.has(textType)) reasons.push("text_type_invalid");
  if (!glossaryIsValid(reading, text)) reasons.push("glossary_invalid");

  if (textType === "vernacular") {
    if (hanCharacters < 300 || hanCharacters > 600) {
      reasons.push("vernacular_length_out_of_range");
    }
  }
  if (textType === "classical") {
    if (hanCharacters < 120 || hanCharacters > 300) {
      reasons.push("classical_length_out_of_range");
    }
    if (glossaryCount < 3 || glossaryCount > 8) {
      reasons.push("classical_glossary_out_of_range");
    }
  }
  if (hanCharacters > 0 && uniqueHanCharacters < 20) {
    reasons.push("reading_text_repetitive");
  }

  return Object.freeze({
    ok: reasons.length === 0,
    textType,
    characters,
    hanCharacters,
    uniqueHanCharacters,
    glossaryCount,
    reasons: Object.freeze(reasons),
  });
}

export function selectDailyTextType({ category, date }) {
  if (category !== "humanities") return "vernacular";
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return CLASSICAL_DAYS.has(day) ? "classical" : "vernacular";
}
