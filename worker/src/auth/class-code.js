import { createOpaqueToken, hashSecret } from "./teacher-auth.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createClassCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes]
    .map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
    .join("");
}

export function createParticipantToken() {
  return createOpaqueToken();
}

export async function hashClassCredential(value) {
  return hashSecret(String(value).trim().toUpperCase());
}
