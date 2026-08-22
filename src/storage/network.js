export async function fetchWithTimeout(
  input,
  init = {},
  { timeoutMs = 10_000, fetchImpl = globalThis.fetch } = {},
) {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  const forwardAbort = () => controller.abort(upstreamSignal.reason);
  if (upstreamSignal?.aborted) {
    forwardAbort();
  } else {
    upstreamSignal?.addEventListener("abort", forwardAbort, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !upstreamSignal?.aborted) {
      const timeoutError = new Error("網路要求逾時，請稍後重試。");
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", forwardAbort);
  }
}
