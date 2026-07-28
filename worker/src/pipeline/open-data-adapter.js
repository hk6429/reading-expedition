import { fingerprintSourceItem } from "./source-registry.js";

export function createOpenDataAdapter({ fetchSource, mapRecord }) {
  return Object.freeze({
    async fetch(source, url) {
      const { text, finalUrl } = await fetchSource(source, url);
      let records;
      try {
        const payload = JSON.parse(text);
        records = Array.isArray(payload) ? payload : payload.records;
      } catch {
        const error = new Error("open data response is not valid JSON");
        error.code = "open_data_invalid_json";
        throw error;
      }
      if (!Array.isArray(records)) {
        const error = new Error("open data response has no records");
        error.code = "open_data_missing_records";
        throw error;
      }
      const items = [];
      const errors = [];
      for (const record of records) {
        try {
          const mapped = mapRecord(record);
          const fingerprint = await fingerprintSourceItem(mapped);
          items.push({
            ...mapped,
            ...fingerprint,
            publisher: source.publisher,
            fetchedFrom: finalUrl ?? url,
            licenseSnapshot: source.license,
            extractScope: source.extractScope,
          });
        } catch (error) {
          errors.push({
            code: "open_data_record_invalid",
            message: error.message,
          });
        }
      }
      return { sourceId: source.id, items, errors };
    },
  });
}
