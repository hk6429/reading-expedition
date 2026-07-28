export function createAnonymousDeviceId(
  randomUUID = () => crypto.randomUUID(),
) {
  return `reader-${randomUUID()}`;
}
