import { fetchSnapshot } from "./api.js";
import { transform } from "./transform.js";

export const cache = $state<{
  data: ReturnType<typeof transform> | null;
  fetchedAt: number;
  loading: boolean;
  error: string | null;
}>({
  data: null,
  fetchedAt: 0,
  loading: false,
  error: null,
});

export async function refresh() {
  if (cache.loading) return;

  cache.loading = true;
  cache.error = null;

  try {
    const raw = await fetchSnapshot();
    if (!raw) throw new Error("Failed to load data.json");
    const data = transform(raw);
    cache.data = data;
    cache.fetchedAt = raw.fetchedAt ?? Date.now();
  } catch (e) {
    cache.error = e instanceof Error ? e.message : String(e);
  } finally {
    cache.loading = false;
  }
}

export function scrapedLabel() {
  if (!cache.fetchedAt) return "";
  const ageMs = Date.now() - cache.fetchedAt;
  const ageMin = Math.floor(ageMs / 60000);
  const ageSec = Math.floor((ageMs % 60000) / 1000);
  const ago = ageMin > 0 ? `${ageMin}m ${ageSec}s ago` : `${ageSec}s ago`;
  const time = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(cache.fetchedAt));
  return `Scraped at ${time} HKT (${ago})`;
}
