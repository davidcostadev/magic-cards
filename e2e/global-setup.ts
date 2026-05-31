// The webServer only waits for the frontend port. Under Docker Desktop on WSL2 the
// backend's host port proxy can come up a beat later, so the very first request from
// the browser would race it. Block here until the backend answers from the host.
async function waitForReachable(url: string, timeoutMs = 120_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export default async function globalSetup(): Promise<void> {
  await waitForReachable('http://localhost:3100/docs');
  await waitForReachable('http://localhost:5100/');
}
