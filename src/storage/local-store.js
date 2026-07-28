import {
  LOCAL_ALLOWED_KEYS,
  LOCAL_SCHEMA_VERSION,
  LOCAL_STORAGE_KEY,
} from "./schema.js";

export function createDefaultState(deviceId = crypto.randomUUID()) {
  return {
    schemaVersion: LOCAL_SCHEMA_VERSION,
    deviceId,
    readingProgress: {},
    completedReadings: {},
    city: {
      materials: { inkBricks: 0, fellowshipSeals: 0, starFragments: 0 },
      buildings: {
        library: 0,
        strategyTower: 0,
        craftHarbor: 0,
        worldPost: 0,
      },
      investments: [],
    },
    collections: {
      stars: [],
      tokens: [],
      quotes: [],
    },
    preferences: {
      mode: "paper",
      fontScale: 1,
      lineHeight: 1.85,
      reducedMotion: false,
      textures: true,
      muted: true,
    },
    weeklyGoal: null,
    offlineQueue: [],
  };
}

function assertState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new TypeError("state must be an object");
  }
  for (const key of Object.keys(state)) {
    if (!LOCAL_ALLOWED_KEYS.includes(key)) {
      throw new TypeError(`${key} is not allowed in local learning state`);
    }
  }
  if (state.schemaVersion !== LOCAL_SCHEMA_VERSION) {
    throw new TypeError("Unsupported local schema version");
  }
  if (typeof state.deviceId !== "string" || state.deviceId.length < 8) {
    throw new TypeError("deviceId must be an anonymous identifier");
  }
}

export function createLocalStore(
  storage,
  { createDeviceId = () => crypto.randomUUID() } = {},
) {
  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function"
  ) {
    throw new TypeError("A Storage-compatible object is required");
  }

  return Object.freeze({
    load() {
      const raw = storage.getItem(LOCAL_STORAGE_KEY);
      if (raw === null) return createDefaultState(createDeviceId());
      try {
        const parsed = JSON.parse(raw);
        assertState(parsed);
        return parsed;
      } catch {
        storage.setItem("reading-expedition:backup:invalid", raw);
        return createDefaultState(createDeviceId());
      }
    },
    save(state) {
      assertState(state);
      storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    },
    clear() {
      storage.removeItem(LOCAL_STORAGE_KEY);
    },
    export() {
      return storage.getItem(LOCAL_STORAGE_KEY);
    },
  });
}
