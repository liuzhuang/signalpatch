export async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) {
    const requestId =
      response.headers.get("x-github-request-id") ??
      response.headers.get("sb-request-id") ??
      "unavailable";
    throw new Error(
      `${options.method ?? "GET"} ${url} failed (${response.status}); request-id=${requestId}`,
    );
  }
  return text ? JSON.parse(text) : null;
}

export function requireEnvironment(names) {
  return Object.fromEntries(
    names.map((name) => {
      const value = process.env[name];
      if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
      }
      return [name, value];
    }),
  );
}
