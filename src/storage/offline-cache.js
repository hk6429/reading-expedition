const CACHE_KEY = "reading-expedition.offline.v1";

function emptyCache() {
  return { daily: {}, readings: {}, images: {}, withdrawn: [] };
}

export function createOfflineCache(storage, { maxBytes = 2_000_000 } = {}) {
  function load() {
    try {
      return { ...emptyCache(), ...JSON.parse(storage.getItem(CACHE_KEY)) };
    } catch {
      return emptyCache();
    }
  }

  function save(state) {
    let serialized = JSON.stringify(state);
    if (new TextEncoder().encode(serialized).length > maxBytes) {
      state.images = {};
      serialized = JSON.stringify(state);
    }
    storage.setItem(CACHE_KEY, serialized);
  }

  return Object.freeze({
    storeDaily(payload) {
      const state = load();
      state.daily[payload.date] = payload;
      save(state);
    },
    getDaily(date) {
      return load().daily[date] ?? null;
    },
    storeReading(reading) {
      const state = load();
      if (state.withdrawn.includes(reading.id)) return false;
      state.readings[reading.id] = reading;
      save(state);
      return true;
    },
    getReading(id) {
      const state = load();
      const reading = state.readings[id];
      if (!reading) return null;
      return state.withdrawn.includes(id)
        ? { ...reading, withdrawn: true }
        : reading;
    },
    storeImage(id, dataUrl) {
      const state = load();
      state.images[id] = dataUrl;
      save(state);
    },
    getImage(id) {
      return load().images[id] ?? null;
    },
    markWithdrawn(id) {
      const state = load();
      if (!state.withdrawn.includes(id)) state.withdrawn.push(id);
      save(state);
    },
    canDownload(id) {
      return !load().withdrawn.includes(id);
    },
  });
}
