const CATEGORY_ORDER = ["world", "science", "humanities"];

export function groupDailyRoutes(readings) {
  return CATEGORY_ORDER.map((category) => {
    const categoryReadings = readings.filter(
      (reading) => reading.category === category,
    );
    return {
      category,
      versions: {
        guided:
          categoryReadings.find(
            ({ difficulty }) => difficulty === "guided",
          ) ?? null,
        challenge:
          categoryReadings.find(
            ({ difficulty }) => difficulty === "challenge",
          ) ?? null,
      },
    };
  }).filter(({ versions }) => versions.guided || versions.challenge);
}
