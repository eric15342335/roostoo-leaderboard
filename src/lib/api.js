const BASE = "https://mock-api.roostoo.com";

export const HK_CPT_ID = 455;
export const SG_CPT_ID = 456; // competition_id=456 confirmed via HAR

const LB_LEVEL = "OVERALL";
const API_KEY = "";

const COMMON = {
  "Accept-Language": "en-US,en;q=0.9",
  VERSION: "52",
  APP_LANGUAGE: "en",
};

const AUTH = { ...COMMON, "RST-API-KEY": API_KEY };

const ts = () => Date.now();

async function get(url, headers = COMMON) {
  const r = await fetch(url, { headers });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

async function post(url, body) {
  const form = new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]));
  const r = await fetch(url, { method: "POST", headers: AUTH, body: form });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

export async function fetchCompetitionInfo() {
  const data = await get(`${BASE}/v1/competition_list?timestamp=${ts()}`);
  if (!data?.Success) return null;
  const list = data.CptList ?? [];
  return {
    hk: list.find((c) => c.CptID === HK_CPT_ID) ?? null,
    sg: list.find((c) => c.CptID === SG_CPT_ID) ?? null,
  };
}

export async function fetchLeaderboard(competitionId) {
  const data = await get(
    `${BASE}/v1/leader_board?competition_id=${competitionId}&lb_level=${LB_LEVEL}&timestamp=${ts()}`
  );
  if (!data?.Success) return null;
  return data;
}

export async function fetchUserInfo(userCode) {
  const data = await get(`${BASE}/v1/user_info?user_code=${userCode}&timestamp=${ts()}`);
  return data?.Success ? data : null;
}

export async function fetchPortfolio(userCode, competitionId) {
  const data = await get(
    `${BASE}/v1/portfolio_visitor?competition_id=${competitionId}&user_code=${userCode}&timestamp=${ts()}`,
    AUTH
  );
  return data?.Success ? data : null;
}

export async function fetchOrders(userCode, competitionId) {
  const data = await post(`${BASE}/v1/order_visitor`, {
    user_code: userCode,
    competition_id: competitionId,
    timestamp: ts(),
  });
  return data?.Success ? data : null;
}

/** @param {(done: number, total: number) => void} [onProgress] */
export async function fetchAll(onProgress) {
  const [compInfoRaw, hkLbRaw, sgLbRaw] = await Promise.all([
    fetchCompetitionInfo(),
    fetchLeaderboard(HK_CPT_ID),
    fetchLeaderboard(SG_CPT_ID),
  ]);

  const hkEntries = hkLbRaw?.PublicRank ?? [];
  const sgEntries = sgLbRaw?.PublicRank ?? [];
  const totalParticipants = hkEntries.length + sgEntries.length;

  if (totalParticipants === 0) throw new Error("No leaderboard data found for either competition");

  let doneCount = 0;
  const reportProgress = () => onProgress?.(++doneCount, totalParticipants);
  const CONCURRENCY = 5;

  async function fetchEntries(entries, competitionId) {
    const results = [];
    for (let i = 0; i < entries.length; i += CONCURRENCY) {
      const batch = entries.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (entry) => {
          const [userInfo, portfolio, orders] = await Promise.all([
            fetchUserInfo(entry.UserCode),
            fetchPortfolio(entry.UserCode, competitionId),
            fetchOrders(entry.UserCode, competitionId),
          ]);
          reportProgress();
          return { entry, userInfo, portfolio, orders };
        })
      );
      results.push(...batchResults);
    }
    return results;
  }

  const [hkResults, sgResults] = await Promise.all([
    fetchEntries(hkEntries, HK_CPT_ID),
    fetchEntries(sgEntries, SG_CPT_ID),
  ]);

  return {
    compRaw: { hk: compInfoRaw?.hk ?? null, sg: compInfoRaw?.sg ?? null },
    hkLbRaw,
    sgLbRaw,
    results: [...hkResults, ...sgResults],
  };
}
