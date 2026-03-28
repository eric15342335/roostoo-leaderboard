#!/usr/bin/env python3
import concurrent.futures
import gzip
import http.client
import io
import json
import logging
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import date, datetime, timedelta, timezone

HK_CPT_ID = 455
SG_CPT_ID = 456
BASE = "https://mock-api.roostoo.com"
LB_LEVEL = "OVERALL"
ORDER_FETCH_LIMIT = 1 << 20
OUTPUT_PATH = "/var/www/roostoo-leaderboard/data.json"
CONCURRENCY = 5
TIME_BUFFER = 5 * 60

COMPETITION_START_DATE = date(2026, 3, 21)
CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache")
BINANCE_VISION_BASE = "https://data.binance.vision"

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
    for attempt in range(10):
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
            log.warning("%s %s failed (attempt %d), retrying", req.get_method(), url, attempt + 1)
            time.sleep(2**attempt)
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


def _fetch_raw(url):
    """Fetch raw bytes from a URL. Returns None on HTTP error (including 404)."""
    req = urllib.request.Request(url, headers={"Accept-Encoding": "gzip", "User-Agent": USER_AGENT})
    last_exc = None
    for attempt in range(10):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                wire, raw = _read_response(resp)
                _record("binance_kline", len(wire), len(raw))
                return raw
        except urllib.error.HTTPError as e:
            log.warning("GET %s -> HTTP %d", url, e.code)
            return None
        except Exception as exc:
            last_exc = exc
            log.warning("GET %s failed (attempt %d)", url, attempt + 1)
            time.sleep(2**attempt)
    log.error("GET %s failed after retries", url, exc_info=last_exc)
    return None


def _fetch_and_cache_kline(symbol, target_date):
    """Return close price for symbol on target_date, downloading and caching if needed."""
    cache_path = os.path.join(CACHE_DIR, f"{symbol}-1d-{target_date:%Y-%m-%d}.csv")
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as f:
            csv_text = f.read()
    else:
        if target_date >= datetime.now(timezone.utc).date():
            return None
        url = f"{BINANCE_VISION_BASE}/data/spot/daily/klines/{symbol}/1d/{symbol}-1d-{target_date:%Y-%m-%d}.zip"
        raw = _fetch_raw(url)
        if raw is None:
            return None
        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                csv_text = zf.read(zf.namelist()[0]).decode("utf-8")
        except Exception:
            log.exception("Failed to extract Binance Vision zip %s %s", symbol, target_date)
            return None
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as f:
            f.write(csv_text)

    for line in csv_text.splitlines():
        cols = line.strip().split(",")
        if len(cols) > 4:
            try:
                return float(cols[4])
            except ValueError:
                pass
    return None


def _compute_team_scores(result, prices, all_dates):
    """Compute Sortino, Sharpe, Calmar, and Composite score for a single team."""
    orders = result.get("orders") or {}
    filled = sorted(
        [order for order in (orders.get("OrderMatched") or []) if order.get("FilledAverPrice")],
        key=lambda order: order["FinishTimestamp"],
    )

    initial_cash = 1000000
    epsilon = 1e-8

    portfolio_values = []
    cash = initial_cash
    holdings = {}
    order_idx = 0

    for trading_date in all_dates:
        eod_ms = (
            int(
                (
                    datetime(trading_date.year, trading_date.month, trading_date.day, tzinfo=timezone.utc)
                    + timedelta(days=1)
                ).timestamp()
                * 1000
            )
            - 1
        )
        while order_idx < len(filled) and filled[order_idx]["FinishTimestamp"] <= eod_ms:
            order = filled[order_idx]
            notional = order["FilledQuantity"] * order["FilledAverPrice"]
            commission = notional * order["CommissionPercent"]
            sym = order["Pair"].replace("/USD", "USDT")

            if order["Side"] == "BUY":
                cash -= notional + commission
                holdings[sym] = holdings.get(sym, 0.0) + order["FilledQuantity"]
            else:
                cash += notional - commission
                holdings[sym] = holdings.get(sym, 0.0) - order["FilledQuantity"]

            order_idx += 1

        portfolio_val = cash
        for sym, qty in holdings.items():
            if abs(qty) < epsilon:
                continue
            close = prices.get(sym, {}).get(trading_date)
            if close is None:
                portfolio_val = None
                break
            portfolio_val += qty * close

        if portfolio_val is None:
            break
        portfolio_values.append(portfolio_val)

    equity_curve = [initial_cash] + portfolio_values
    returns = [
        equity_curve[i] / equity_curve[i - 1] - 1 for i in range(1, len(equity_curve)) if equity_curve[i - 1] != 0
    ]
    n = len(returns)

    base = {
        "compositeScore": None,
        "sortino": None,
        "sharpe": None,
        "calmar": None,
        "meanReturn": None,
        "stdNegReturn": None,
        "maxDrawdown": None,
        "dailyReturns": [],
    }
    if n < 2:
        return base

    mean_r = sum(returns) / n
    std_r = (sum((r - mean_r) ** 2 for r in returns) / n) ** 0.5

    # Downside deviation: sqrt(sum(min(r,0)^2 for all r) / n), centered on zero
    std_down = (sum(min(return_value, 0) ** 2 for return_value in returns) / n) ** 0.5
    sortino = mean_r / max(std_down, epsilon)
    sharpe = mean_r / max(std_r, epsilon)

    peak = equity_curve[0]
    max_dd = 0.0
    for val in equity_curve:
        if val > peak:
            peak = val
        if peak > 0:
            dd = (peak - val) / peak
            if dd > max_dd:
                max_dd = dd
    calmar = mean_r / max(max_dd, epsilon)

    composite = 0.4 * sortino + 0.3 * sharpe + 0.3 * calmar

    daily_returns = [
        {"date": all_dates[i].isoformat(), "r": round(returns[i], 6)}
        for i in range(n)
    ]

    return {
        **base,
        "compositeScore": round(composite, 6),
        "sortino": round(sortino, 6),
        "sharpe": round(sharpe, 6),
        "calmar": round(calmar, 6),
        "meanReturn": round(mean_r, 6),
        "stdNegReturn": round(std_down, 6),
        "maxDrawdown": round(max_dd, 6),
        "dailyReturns": daily_returns,
    }


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
    all_tasks = [(entry, HK_CPT_ID) for entry in hk_entries] + [(entry, SG_CPT_ID) for entry in sg_entries]
    total = len(all_tasks)

    if total == 0:
        log.error("No leaderboard entries found. Aborting.")
        sys.exit(1)

    log.info(
        "Fetching %d participants (HK=%d, SG=%d) with concurrency=%d",
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

    symbols = set()
    for participant_result in results:
        for order in (participant_result.get("orders") or {}).get("OrderMatched") or []:
            if order.get("FilledAverPrice") and "/" in (order.get("Pair") or ""):
                symbols.add(order["Pair"].replace("/USD", "USDT"))
        for cp in (participant_result.get("portfolio") or {}).get("CoinProfit") or []:
            if cp.get("CoinLeft", 0) > 0 and cp.get("Coin"):
                symbols.add(cp["Coin"] + "USDT")

    today_utc = datetime.now(timezone.utc).date()
    all_dates = []
    current_date = COMPETITION_START_DATE
    while current_date < today_utc:
        all_dates.append(current_date)
        current_date += timedelta(days=1)

    prices = {symbol: {} for symbol in symbols}
    if symbols and all_dates:
        log.info("Fetching Binance klines for %d symbol(s) * %d date(s)", len(symbols), len(all_dates))
        tasks = [(symbol, trade_date) for symbol in symbols for trade_date in all_dates]
        with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
            futs = {
                pool.submit(_fetch_and_cache_kline, symbol, trade_date): (symbol, trade_date)
                for symbol, trade_date in tasks
            }
            for fut in concurrent.futures.as_completed(futs):
                symbol, trade_date = futs[fut]
                try:
                    close = fut.result()
                    if close is not None:
                        prices[symbol][trade_date] = close
                except Exception:
                    log.exception("kline fetch failed %s %s", symbol, trade_date)

    for participant_result in results:
        participant_result["scores"] = _compute_team_scores(participant_result, prices, all_dates)

    team_dates = [
        participant_result["scores"]["dailyReturns"][-1]["date"]
        for participant_result in results
        if participant_result["scores"].get("dailyReturns")
    ]
    binance_latest_date = max(team_dates) if team_dates else None

    snapshot = {
        "fetchedAt": int(time.time() * 1000),
        "compRaw": competition_info or {"hk": None, "sg": None},
        "hkLbRaw": hk_leaderboard,
        "sgLbRaw": sg_leaderboard,
        "results": results,
        "binanceLatestDate": binance_latest_date,
    }

    payload = json.dumps(snapshot, ensure_ascii=True, separators=(",", ":"))
    tmp = OUTPUT_PATH + ".tmp"
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    with open(tmp, "w", encoding="utf-8") as output_file:
        output_file.write(payload)
    os.replace(tmp, OUTPUT_PATH)

    elapsed = time.time() - start_time
    log.info("Done. participants=%d bytes=%d elapsed=%.1fs", total, len(payload), elapsed)
    _log_bandwidth_summary()


if __name__ == "__main__":
    main()
