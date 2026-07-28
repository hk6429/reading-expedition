export function createPipelineIdempotencyKey(date, version) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !version) {
    throw new TypeError("pipeline date and version are required");
  }
  return `daily:${date}:${version}`;
}

export function shouldSkipPipelineRun(run) {
  return run?.status === "succeeded";
}
