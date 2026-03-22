import { fetchAll } from "./api.js";
import { transform } from "./transform.js";

const DB_NAME = "crypto_dash";
const STORE_NAME = "cache";
const STORAGE_KEY = "crypto_dash_cache_v2";

function getAdaptiveTtlMs() {
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Hong_Kong",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );
  if (hour >= 9 && hour < 22) return 15 * 60 * 1000;
  if (hour >= 22 || hour < 2) return 30 * 60 * 1000;
  return 60 * 60 * 1000;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

async function readStorage(): Promise<{ data: ReturnType<typeof transform>; ts: number } | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STORAGE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeStorage(data: ReturnType<typeof transform>): Promise<boolean> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put({ data, ts: Date.now() }, STORAGE_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export const cache = $state<{
  data: ReturnType<typeof transform> | null;
  fetchedAt: number;
  loading: boolean;
  progress: number;
  progressTotal: number;
  error: string | null;
}>({
  data: null,
  fetchedAt: 0,
  loading: false,
  progress: 0,
  progressTotal: 0,
  error: null,
});

export function isStale() {
  return Date.now() - cache.fetchedAt > getAdaptiveTtlMs();
}

export async function loadFromStorage(): Promise<boolean> {
  const stored = await readStorage();
  if (!stored) return false;
  cache.data = stored.data;
  cache.fetchedAt = stored.ts;
  return true;
}

export async function refresh(force = false) {
  if (cache.loading) return;
  if (!force && !isStale()) return;

  cache.loading = true;
  cache.error = null;
  cache.progress = 0;
  cache.progressTotal = 0;

  try {
    const raw = await fetchAll((done, total) => {
      cache.progress = done;
      cache.progressTotal = total;
    });
    const data = transform(raw);
    cache.data = data;
    cache.fetchedAt = Date.now();
    await writeStorage(data);
  } catch (e) {
    cache.error = e instanceof Error ? e.message : String(e);
  } finally {
    cache.loading = false;
  }
}

export function ttlLabel() {
  if (!cache.fetchedAt) return "No data";
  const ageMs = Date.now() - cache.fetchedAt;
  const ttl = getAdaptiveTtlMs();
  const remainMs = ttl - ageMs;
  if (remainMs <= 0) return "Stale - refreshing...";
  const m = Math.floor(remainMs / 60000);
  const s = Math.floor((remainMs % 60000) / 1000);
  return m > 0 ? `Refreshes in ${m}m ${s}s` : `Refreshes in ${s}s`;
}
