const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function constantTimeEqual(left, right) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length, 1);
  let mismatch = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |=
      (leftBytes[index % Math.max(leftBytes.length, 1)] ?? 0) ^
      (rightBytes[index % Math.max(rightBytes.length, 1)] ?? 0);
  }
  return mismatch === 0;
}

export async function hashSecret(secret) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(String(secret ?? "")),
  );
  return toBase64Url(new Uint8Array(digest));
}

export async function verifyTeacherKey(candidate, expectedHash) {
  const candidateHash = await hashSecret(candidate);
  const comparisonHash =
    typeof expectedHash === "string" && expectedHash.length > 0
      ? expectedHash
      : await hashSecret("unconfigured-teacher-key");
  return constantTimeEqual(candidateHash, comparisonHash);
}

export function createOpaqueToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function secretsEqual(left, right) {
  return constantTimeEqual(String(left ?? ""), String(right ?? ""));
}
