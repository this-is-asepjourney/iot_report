/**
 * Cache in-memory di client untuk mengurangi read Firestore.
 * TTL (time-to-live) per key; invalidateAll() dipanggil setelah write (create/update/delete).
 */

const store = new Map<string, { value: unknown; expiresAt: number }>();

export function get<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function set<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/** Hapus semua cache. Panggil setelah create/update/delete agar data terbaru dibaca lagi. */
export function invalidateAll(): void {
  store.clear();
}

/** Hapus cache yang key-nya diawali prefix (untuk invalidation selektif, kurangi read). */
export function invalidateByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
