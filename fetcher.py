#!/usr/bin/env python3
import concurrent.futures
import gzip
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
REQUEST_TIMEOUT = 30
TIME_BUFFER = 5 * 60

UA = "Python/{}.{} github.com/eric15342335/roostoo-leaderboard".format(sys.version_info.major, sys.version_info.minor)

COMMON_HEADERS = {
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip",
    "User-Agent": UA,
    "VERSION": "52",
    "APP_LANGUAGE": "en",
}

_bw_lock = threading.Lock()
_bw_stats = {}  # endpoint -> {"wire": int, "raw": int, "requests": int}


def _endpoint(url):
    return url.split("?")[0].rsplit("/", 1)[-1]


def _read_response(resp):
    wire = resp.read()
    if resp.headers.get("Content-Encoding") == "gzip":
        raw = gzip.decompress(wire)
    else:
        raw = wire
    return wire, raw


def _record(endpoint, wire_bytes, raw_bytes):
    with _bw_lock:
        s = _bw_stats.setdefault(endpoint, {"wire": 0, "raw": 0, "requests": 0})
        s["wire"] += wire_bytes
        s["raw"] += raw_bytes
        s["requests"] += 1


AUTH_HEADERS = {**COMMON_HEADERS, "RST-API-KEY": ""}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)


def _ts():
    return int(time.time() * 1000)


def _get(url, headers=None):
    if headers is None:
        headers = COMMON_HEADERS
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            wire, raw = _read_response(resp)
            _record(_endpoint(url), len(wire), len(raw))
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as e:
        log.error("GET %s -> HTTP %d", url, e.code)
        return None
    except Exception:
        log.exception("GET %s failed", url)
        return None


def _post(url, body):
    data = urllib.parse.urlencode(body).encode("ascii")
    headers = {**AUTH_HEADERS, "Content-Type": "application/x-www-form-urlencoded"}
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            wire, raw = _read_response(resp)
            _record(_endpoint(url), len(wire), len(raw))
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as e:
        log.error("POST %s -> HTTP %d", url, e.code)
        return None
    except Exception:
        log.exception("POST %s failed", url)
        return None


def get_ttl_seconds():
    hkt_hour = datetime.now(timezone(timedelta(hours=8))).hour
    if 9 <= hkt_hour < 22:
        return 15 * 60
    if hkt_hour >= 22 or hkt_hour < 2:
        return 30 * 60
    return 60 * 60


def is_fresh():
    try:
        mtime = os.path.getmtime(OUTPUT_PATH)
    except FileNotFoundError:
        return False
    return (time.time() - mtime) < (get_ttl_seconds() - TIME_BUFFER)


def fetch_competition_info():
    data = _get("{}/v1/competition_list?timestamp={}".format(BASE, _ts()))
    if not data or not data.get("Success"):
        return None
    lst = data.get("CptList") or []
    return {
        "hk": next((c for c in lst if c.get("CptID") == HK_CPT_ID), None),
        "sg": next((c for c in lst if c.get("CptID") == SG_CPT_ID), None),
    }


def fetch_leaderboard(competition_id):
    data = _get(
        "{}/v1/leader_board?competition_id={}&lb_level={}&timestamp={}".format(BASE, competition_id, LB_LEVEL, _ts())
    )
    if not data or not data.get("Success"):
        return None
    return data


def fetch_participant(entry, competition_id):
    user_code = entry["UserCode"]

    user_info = _get("{}/v1/user_info?user_code={}&timestamp={}".format(BASE, user_code, _ts()))
    if not (user_info and user_info.get("Success")):
        user_info = None

    portfolio = _get(
        "{}/v1/portfolio_visitor?competition_id={}&user_code={}&timestamp={}".format(
            BASE, competition_id, user_code, _ts()
        ),
        AUTH_HEADERS,
    )
    if not (portfolio and portfolio.get("Success")):
        portfolio = None

    orders = _post(
        "{}/v1/order_visitor".format(BASE),
        {
            "user_code": user_code,
            "competition_id": competition_id,
            "timestamp": _ts(),
            "limit": ORDER_FETCH_LIMIT,
        },
    )
    if not (orders and orders.get("Success")):
        orders = None

    return {"entry": entry, "userInfo": user_info, "portfolio": portfolio, "orders": orders}


def _log_bandwidth_summary():
    if not _bw_stats:
        return
    total_wire = sum(s["wire"] for s in _bw_stats.values())
    total_raw = sum(s["raw"] for s in _bw_stats.values())
    saved = total_raw - total_wire
    pct = (saved / total_raw * 100) if total_raw else 0.0
    log.info("Bandwidth summary: wire=%d raw=%d saved=%d (%.1f%%)", total_wire, total_raw, saved, pct)
    for ep, s in sorted(_bw_stats.items(), key=lambda x: x[1]["raw"], reverse=True):
        ep_pct = ((s["raw"] - s["wire"]) / s["raw"] * 100) if s["raw"] else 0.0
        log.info("endpoint=%s requests=%d wire=%d raw=%d saved=%.1f%%", ep, s["requests"], s["wire"], s["raw"], ep_pct)


def main():
    t0 = time.time()
    ttl = get_ttl_seconds()
    log.info("Start. TTL=%ds", ttl)

    if is_fresh():
        log.info("data.json is fresh (age < %ds). Skipping fetch.", ttl)
        return

    comp_raw = fetch_competition_info()
    hk_lb = fetch_leaderboard(HK_CPT_ID)
    sg_lb = fetch_leaderboard(SG_CPT_ID)

    hk_entries = (hk_lb or {}).get("PublicRank") or []
    sg_entries = (sg_lb or {}).get("PublicRank") or []
    total = len(hk_entries) + len(sg_entries)

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

    all_tasks = [(e, HK_CPT_ID) for e in hk_entries] + [(e, SG_CPT_ID) for e in sg_entries]
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
                log.exception(
                    "participant %d/%d failed (%s)",
                    done,
                    total,
                    futures[future].get("UserCode", "?"),
                )

    snapshot = {
        "fetchedAt": int(time.time() * 1000),
        "compRaw": comp_raw or {"hk": None, "sg": None},
        "hkLbRaw": hk_lb,
        "sgLbRaw": sg_lb,
        "results": results,
    }

    payload = json.dumps(snapshot, ensure_ascii=True, separators=(",", ":"))
    tmp = OUTPUT_PATH + ".tmp"
    os.makedirs(os.path.dirname(os.path.abspath(tmp)), exist_ok=True)
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
    os.replace(tmp, OUTPUT_PATH)

    elapsed = time.time() - t0
    log.info(
        "Done. participants=%d bytes=%d elapsed=%.1fs",
        total,
        len(payload.encode("utf-8")),
        elapsed,
    )
    _log_bandwidth_summary()


if __name__ == "__main__":
    main()
