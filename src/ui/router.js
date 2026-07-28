export function createRouter({ onHome, onRead }) {
  async function navigate() {
    const readMatch = /^#\/read\/([a-zA-Z0-9-]+)$/.exec(
      window.location.hash,
    );
    if (readMatch) {
      await onRead(readMatch[1]);
      return;
    }
    await onHome();
  }

  window.addEventListener("hashchange", navigate);
  return Object.freeze({ navigate });
}
