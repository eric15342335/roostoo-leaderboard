const BASE = "https://mock-api.roostoo.com";
const CPT_ID = 455;
const LB_LEVEL = "OVERALL";
const API_KEY = "";

const COMMON = {
  "Accept-Language": "en-US,en;q=0.9",
  VERSION: "52",
  APP_LANGUAGE: "en",
};

const AUTH = { ...COMMON, "RST-API-KEY": API_KEY };

const ts = () => Date.now();

/** @param {string} url @param {Record<string,string>} [headers] */
async function get(url, headers = COMMON) {
  const r = await fetch(url, { headers });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

/** @param {string} url @param {Record<string,string|number>} body */
async function post(url, body) {
  const form = new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]));
  const r = await fetch(url, { method: "POST", headers: AUTH, body: form });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

export async function fetchCompetitionInfo() {
  const data = await get(`${BASE}/v1/competition_list?timestamp=${ts()}`);
  if (!data?.Success) return null;
  return data.CptList?.find((c) => c.CptID === CPT_ID) ?? null;
}

export async function fetchLeaderboard() {
  const data = await get(
    `${BASE}/v1/leader_board?competition_id=${CPT_ID}&lb_level=${LB_LEVEL}&timestamp=${ts()}`
  );
  if (!data?.Success) return null;
  return data;
}

/** @param {string} userCode */
export async function fetchUserInfo(userCode) {
  const data = await get(`${BASE}/v1/user_info?user_code=${userCode}&timestamp=${ts()}`);
  return data?.Success ? data : null;
}

/** @param {string} userCode */
export async function fetchPortfolio(userCode) {
  const data = await get(
    `${BASE}/v1/portfolio_visitor?competition_id=${CPT_ID}&user_code=${userCode}&timestamp=${ts()}`,
    AUTH
  );
  return data?.Success ? data : null;
}

/** @param {string} userCode */
export async function fetchOrders(userCode) {
  const data = await post(`${BASE}/v1/order_visitor`, {
    user_code: userCode,
    competition_id: CPT_ID,
    timestamp: ts(),
  });
  return data?.Success ? data : null;
}

/**
 * Fetch all data for all participants with capped concurrency.
 * @param {(done: number, total: number) => void} [onProgress]
 */
export async function fetchAll(onProgress) {
  const [compRaw, lbRaw] = await Promise.all([fetchCompetitionInfo(), fetchLeaderboard()]);

  if (!lbRaw?.PublicRank?.length) throw new Error("No leaderboard data");

  const entries = lbRaw.PublicRank;
  const total = entries.length;
  let done = 0;

  const CONCURRENCY = 5;
  const results = [];

  for (let i = 0; i < total; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (entry) => {
        const [userInfo, portfolio, orders] = await Promise.all([
          fetchUserInfo(entry.UserCode),
          fetchPortfolio(entry.UserCode),
          fetchOrders(entry.UserCode),
        ]);
        done++;
        onProgress?.(done, total);
        return { entry, userInfo, portfolio, orders };
      })
    );
    results.push(...batchResults);
  }

  return { compRaw, lbRaw, results };
}
