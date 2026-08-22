export function createAnonymousDeviceId(
  randomUUID = () => crypto.randomUUID(),
) {
  return `reader-${randomUUID()}`;
}

const TELEMETRY_ID_KEY = "reading-expedition.telemetry-id";
const TELEMETRY_ROTATION_MS = 35 * 86_400_000;

export function getRotatingTelemetryId(
  storage,
  {
    now = new Date(),
    createId = () => createAnonymousDeviceId(),
  } = {},
) {
  const currentTime = now.getTime();
  if (!Number.isFinite(currentTime)) {
    throw new TypeError("now must be a valid date");
  }
  try {
    const saved = JSON.parse(storage.getItem(TELEMETRY_ID_KEY) ?? "null");
    const createdAt = Date.parse(saved?.createdAt);
    if (
      typeof saved?.id === "string" &&
      /^[A-Za-z0-9-]{8,120}$/.test(saved.id) &&
      Number.isFinite(createdAt) &&
      currentTime >= createdAt &&
      currentTime - createdAt < TELEMETRY_ROTATION_MS
    ) {
      return saved.id;
    }
  } catch {
    // Invalid telemetry state is replaced without touching learning records.
  }
  const id = createId();
  if (typeof id !== "string" || !/^[A-Za-z0-9-]{8,120}$/.test(id)) {
    throw new TypeError("telemetry id must be an anonymous identifier");
  }
  storage.setItem(
    TELEMETRY_ID_KEY,
    JSON.stringify({ id, createdAt: now.toISOString() }),
  );
  return id;
}
