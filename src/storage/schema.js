export const LOCAL_SCHEMA_VERSION = 1;
export const LOCAL_STORAGE_KEY = "reading-expedition:v1";
export const LOCAL_ALLOWED_KEYS = Object.freeze([
  "schemaVersion",
  "deviceId",
  "readingProgress",
  "completedReadings",
  "readingHistory",
  "city",
  "collections",
  "abilityGrowth",
  "preferences",
  "weeklyGoal",
  "offlineQueue",
]);
