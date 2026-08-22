export async function downloadOfflinePack(
  readings,
  {
    loadReading,
    storeReading,
    limit = 7,
    timeoutMs = 10_000,
    onProgress = () => {},
  },
) {
  const selected = readings.slice(0, Math.max(0, limit));
  const failed = [];
  let saved = 0;
  for (const { id } of selected) {
    const controller = new AbortController();
    let timeout;
    try {
      const reading = await Promise.race([
        loadReading(id, { signal: controller.signal }),
        new Promise((_resolve, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            const error = new Error(`下載 ${id} 逾時`);
            error.name = "TimeoutError";
            reject(error);
          }, timeoutMs);
        }),
      ]);
      if (!reading || storeReading(reading) === false) {
        failed.push(id);
      } else {
        saved += 1;
      }
    } catch {
      failed.push(id);
    } finally {
      clearTimeout(timeout);
      try {
        onProgress(
          Object.freeze({
            completed: saved + failed.length,
            requested: selected.length,
            saved,
            failed: Object.freeze([...failed]),
          }),
        );
      } catch {
        // 進度顯示失效不應中止其餘文章下載。
      }
    }
  }
  return Object.freeze({
    requested: selected.length,
    saved,
    failed: Object.freeze(failed),
  });
}
