export async function downloadOfflinePack(
  readings,
  {
    loadReading,
    storeReading,
    limit = 7,
  },
) {
  const selected = readings.slice(0, Math.max(0, limit));
  const failed = [];
  let saved = 0;
  for (const { id } of selected) {
    try {
      const reading = await loadReading(id);
      if (!reading || storeReading(reading) === false) {
        failed.push(id);
        continue;
      }
      saved += 1;
    } catch {
      failed.push(id);
    }
  }
  return Object.freeze({
    requested: selected.length,
    saved,
    failed: Object.freeze(failed),
  });
}
