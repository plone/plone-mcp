/**
 * Module-level per-path serialization queue for Plone content mutations.
 *
 * Multiple MCP sessions (stdio or HTTP) share this map because it is defined
 * at module scope. Operations targeting the same content path are chained so
 * that a later operation only starts after the previous one has settled,
 * preventing read-modify-write races where two callers read the same snapshot
 * and the last PATCH overwrites an earlier change.
 */

const pathQueues = new Map<string, Promise<unknown>>();

function normalizeQueuePath(path: string): string {
  if (!path || path === "/") {
    return "/";
  }

  let normalized = path.replace(/\/$/, "");
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }

  return normalized;
}

/**
 * Run `operation` for `path` after any previously queued operation for the
 * same path has settled. Rejected operations do not block subsequent ones.
 */
export async function withContentPathQueue<T>(
  path: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = normalizeQueuePath(path);
  const previous = pathQueues.get(key);

  const current: Promise<T> = previous
    ? previous.then(() => operation(), () => operation())
    : operation();

  pathQueues.set(key, current);

  try {
    return await current;
  } finally {
    // Only clear the queue if no newer operation has chained onto it.
    if (pathQueues.get(key) === current) {
      pathQueues.delete(key);
    }
  }
}
