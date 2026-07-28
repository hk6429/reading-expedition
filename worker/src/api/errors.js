export function jsonResponse(payload, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function errorResponse(code, message, status, traceId) {
  return jsonResponse(
    { error: { code, message } },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-trace-id": traceId,
      },
    },
  );
}
