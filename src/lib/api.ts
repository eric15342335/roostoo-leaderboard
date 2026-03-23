const DATA_URL = "data.json";

export async function fetchSnapshot() {
  const r = await fetch(DATA_URL);
  if (!r.ok) return null;
  return r.json().catch(() => null);
}
