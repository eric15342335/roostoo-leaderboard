#!/usr/bin/env python3
import concurrent.futures
import gzip
import http.client
import json
import logging
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

HK_CPT_ID = 455
SG_CPT_ID = 456
BASE = "https://mock-api.roostoo.com"
LB_LEVEL = "OVERALL"
ORDER_FETCH_LIMIT = 1 << 20
OUTPUT_PATH = "/var/www/roostoo-leaderboard/data.json"
CONCURRENCY = 5
TIME_BUFFER = 5 * 60

USER_AGENT = f"Python/{sys.version_info.major}.{sys.version_info.minor} github.com/eric15342335/roostoo-leaderboard"

COMMON_HEADERS = {
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip",
    "User-Agent": USER_AGENT,
    "VERSION": "52",
    "APP_LANGUAGE": "en",
}
AUTH_HEADERS = {**COMMON_HEADERS, "RST-API-KEY": ""}

_bandwidth_lock = threading.Lock()
_bandwidth_stats = {}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)


def _read_response(resp):
    try:
        wire = resp.read()
    except http.client.IncompleteRead as e:
        wire = e.partial
    raw = gzip.decompress(wire) if resp.headers.get("Content-Encoding") == "gzip" else wire
    return wire, raw


def _record(endpoint, wire_bytes, raw_bytes):
    with _bandwidth_lock:
        stats = _bandwidth_stats.setdefault(endpoint, {"wire": 0, "raw": 0, "requests": 0})
        stats["wire"] += wire_bytes
        stats["raw"] += raw_bytes
        stats["requests"] += 1


def _request(req):
    url = req.full_url
    last_exc = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                wire, raw = _read_response(resp)
                _record(url.split("?")[0].rsplit("/", 1)[-1], len(wire), len(raw))
                return json.loads(raw.decode("utf-8"))
        except urllib.error.HTTPError as e:
            log.error("%s %s -> HTTP %d", req.get_method(), url, e.code)
            return None
        except Exception as exc:
            last_exc = exc
            log.warning("%s %s failed (attempt %d/3), retrying...", req.get_method(), url, attempt + 1)
            time.sleep(1)
    log.error("%s %s failed after 3 attempts", req.get_method(), url, exc_info=last_exc)
    return None


def _get(url, headers=None):
    return _request(urllib.request.Request(url, headers=headers or COMMON_HEADERS))


def _post(url, body):
    data = urllib.parse.urlencode(body).encode("ascii")
    headers = {**AUTH_HEADERS, "Content-Type": "application/x-www-form-urlencoded"}
    return _request(urllib.request.Request(url, data=data, headers=headers, method="POST"))


def get_ttl_seconds():
    hkt_hour = datetime.now(timezone(timedelta(hours=8))).hour
    if 9 <= hkt_hour < 22:
        return 15 * 60
    if hkt_hour >= 22 or hkt_hour < 2:
        return 30 * 60
    return 60 * 60


def is_fresh(ttl):
    try:
        mtime = os.path.getmtime(OUTPUT_PATH)
    except FileNotFoundError:
        return False
    return (time.time() - mtime) < (ttl - TIME_BUFFER)


def fetch_competition_info():
    data = _get(f"{BASE}/v1/competition_list?timestamp={int(time.time() * 1000)}")
    if not data or not data.get("Success"):
        return None
    competitions = data.get("CptList") or []
    return {
        "hk": next((c for c in competitions if c.get("CptID") == HK_CPT_ID), None),
        "sg": next((c for c in competitions if c.get("CptID") == SG_CPT_ID), None),
    }


def fetch_leaderboard(competition_id):
    data = _get(
        f"{BASE}/v1/leader_board?competition_id={competition_id}&lb_level={LB_LEVEL}&timestamp={int(time.time() * 1000)}"
    )
    if not data or not data.get("Success"):
        return None
    return data


def fetch_participant(entry, competition_id):
    user_code = entry["UserCode"]

    user_info = _get(f"{BASE}/v1/user_info?user_code={user_code}&timestamp={int(time.time() * 1000)}")
    if not (user_info and user_info.get("Success")):
        user_info = None

    portfolio = _get(
        f"{BASE}/v1/portfolio_visitor?competition_id={competition_id}&user_code={user_code}&timestamp={int(time.time() * 1000)}",
        AUTH_HEADERS,
    )
    if not (portfolio and portfolio.get("Success")):
        portfolio = None

    orders = _post(
        f"{BASE}/v1/order_visitor",
        {
            "user_code": user_code,
            "competition_id": competition_id,
            "timestamp": int(time.time() * 1000),
            "limit": ORDER_FETCH_LIMIT,
        },
    )
    if not (orders and orders.get("Success")):
        orders = None

    return {
        "entry": entry,
        "userInfo": user_info,
        "portfolio": portfolio,
        "orders": orders,
    }


def _log_bandwidth_summary():
    if not _bandwidth_stats:
        return
    total_wire = total_raw = 0
    for stats in _bandwidth_stats.values():
        total_wire += stats["wire"]
        total_raw += stats["raw"]
    saved = total_raw - total_wire
    saved_pct = (saved / total_raw * 100) if total_raw else 0.0
    log.info(
        "Bandwidth summary: wire=%d raw=%d saved=%d (%.1f%%)",
        total_wire,
        total_raw,
        saved,
        saved_pct,
    )
    for endpoint, stats in sorted(_bandwidth_stats.items(), key=lambda x: x[1]["raw"], reverse=True):
        saved_pct = ((stats["raw"] - stats["wire"]) / stats["raw"] * 100) if stats["raw"] else 0.0
        log.info(
            "endpoint=%s requests=%d wire=%d raw=%d saved=%.1f%%",
            endpoint,
            stats["requests"],
            stats["wire"],
            stats["raw"],
            saved_pct,
        )


def main():
    start_time = time.time()
    ttl = get_ttl_seconds()
    log.info("Start. TTL=%ds", ttl)

    if is_fresh(ttl):
        log.info("data.json is fresh (age < %ds). Skipping fetch.", ttl)
        return

    with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        fut_competition = pool.submit(fetch_competition_info)
        fut_hk = pool.submit(fetch_leaderboard, HK_CPT_ID)
        fut_sg = pool.submit(fetch_leaderboard, SG_CPT_ID)
        competition_info = fut_competition.result()
        hk_leaderboard = fut_hk.result()
        sg_leaderboard = fut_sg.result()

    hk_entries = (hk_leaderboard or {}).get("PublicRank") or []
    sg_entries = (sg_leaderboard or {}).get("PublicRank") or []
    all_tasks = [(e, HK_CPT_ID) for e in hk_entries] + [(e, SG_CPT_ID) for e in sg_entries]
    total = len(all_tasks)

    if total == 0:
        log.error("No leaderboard entries found. Aborting.")
        sys.exit(1)

    log.info(
        "Fetching %d participants (HK=%d, SG=%d) with concurrency=%d...",
        total,
        len(hk_entries),
        len(sg_entries),
        CONCURRENCY,
    )

    results = []
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = {executor.submit(fetch_participant, entry, cpt_id): entry for entry, cpt_id in all_tasks}
        for future in concurrent.futures.as_completed(futures):
            done += 1
            try:
                results.append(future.result())
                log.info("participant %d/%d done", done, total)
            except Exception:
                log.exception("participant %d/%d failed (%s)", done, total, futures[future].get("UserCode", "?"))

    snapshot = {
        "fetchedAt": int(time.time() * 1000),
        "compRaw": competition_info or {"hk": None, "sg": None},
        "hkLbRaw": hk_leaderboard,
        "sgLbRaw": sg_leaderboard,
        "results": results,
    }

    payload = json.dumps(snapshot, ensure_ascii=True, separators=(",", ":"))
    tmp = OUTPUT_PATH + ".tmp"
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    os.replace(tmp, OUTPUT_PATH)

    elapsed = time.time() - start_time
    log.info("Done. participants=%d bytes=%d elapsed=%.1fs", total, len(payload), elapsed)
    _log_bandwidth_summary()


if __name__ == "__main__":
    main()
