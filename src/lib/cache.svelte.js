import { fetchAll } from "./api.js";
import { transform } from "./transform.js";

const STORAGE_KEY = "crypto_dash_cache_v1";

function getAdaptiveTtlMs() {
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Hong_Kong",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );
  if (hour >= 9 && hour < 22) return 5 * 60 * 1000;
  if (hour >= 22 || hour < 2) return 15 * 60 * 1000;
  return 60 * 60 * 1000;
}

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export const cache = $state({
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

export function loadFromStorage() {
  const stored = readStorage();
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
    cache.data = transform(raw);
    cache.fetchedAt = Date.now();
    writeStorage(cache.data);
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
