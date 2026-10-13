#!/usr/bin/env python3
"""Daily PAL market-data and directional-bias audit. Scores are diagnostics, not financial advice."""
from __future__ import annotations
import io, json, os, re, sys, time, zipfile
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import requests

BASE = os.getenv("PAL_BASE_URL", "https://pal-market-data-api.onrender.com").rstrip("/")
REPO = os.getenv("GITHUB_REPOSITORY", "")
TOKEN = os.getenv("GITHUB_TOKEN", "")
RUN_ID = os.getenv("GITHUB_RUN_ID", "")
TIMEOUT = 18
SYMBOLS = ("DXY", "GBPUSD", "XAUUSD", "BTCUSD")
THRESHOLDS = {"DXY": 0.05, "GBPUSD": 0.02, "XAUUSD": 0.05, "BTCUSD": 0.25}

def fetch_json(url: str, timeout: int = TIMEOUT):
    r = requests.get(url, timeout=timeout, headers={"User-Agent":"PAL-Daily-Audit/1.0", "Accept":"application/json"})
    r.raise_for_status()
    return r.json()

def safe_float(value):
    try:
        v = float(value)
        return v if v == v and abs(v) != float("inf") else None
    except (TypeError, ValueError):
        return None

def parse_time(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)
    except (TypeError, ValueError):
        try:
            return parsedate_to_datetime(value).astimezone(timezone.utc)
        except Exception:
            return None

def find_key(obj, key):
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            found = find_key(v, key)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = find_key(v, key)
            if found is not None:
                return found
    return None

def extract_biases(payload):
    tb = find_key(payload, "today_bias") or {}
    today = tb.get("today", {}) if isinstance(tb, dict) else {}
    assets = tb.get("assets", {}) if isinstance(tb, dict) else {}
    raw = {
        "DXY": (today.get("dxy") or {}),
        "GBPUSD": (today.get("gbpusd") or today.get("gbp") or {}),
        "XAUUSD": (assets.get("gold") or today.get("xauusd") or {}),
        "BTCUSD": (assets.get("btcusd") or today.get("btcusd") or {}),
    }
    result = {}
    for key, item in raw.items():
        bias = str(item.get("bias", "UNKNOWN")).upper()
        if "BULL" in bias: bias = "BULLISH"
        elif "BEAR" in bias: bias = "BEARISH"
        elif "NEUTRAL" in bias: bias = "NEUTRAL"
        else: bias = "UNKNOWN"
        result[key] = {"bias": bias, "evidence_strength": safe_float(item.get("confidence", item.get("evidence_strength"))), "reasons": item.get("reasons", [])}
    return result

def previous_audit():
    if not (REPO and TOKEN and RUN_ID):
        return None
    headers = {"Authorization": f"Bearer {TOKEN}", "Accept":"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28"}
    try:
        url = f"https://api.github.com/repos/{REPO}/actions/runs?workflow_id=daily-bias-audit.yml&status=completed&per_page=20"
        runs = requests.get(url, headers=headers, timeout=15).json().get("workflow_runs", [])
        for run in runs:
            if str(run.get("id")) == str(RUN_ID) or run.get("conclusion") not in ("success", "failure"):
                continue
            arts = requests.get(run["artifacts_url"], headers=headers, timeout=15).json().get("artifacts", [])
            artifact = next((a for a in arts if a.get("name") == "pal-daily-bias-audit" and not a.get("expired")), None)
            if not artifact:
                continue
            blob = requests.get(artifact["archive_download_url"], headers=headers, timeout=25)
            blob.raise_for_status()
            with zipfile.ZipFile(io.BytesIO(blob.content)) as zf:
                with zf.open("audit.json") as fp:
                    return json.load(fp)
    except Exception as exc:
        print(f"Historical score unavailable: {type(exc).__name__}: {exc}")
    return None

def external_checks(quotes):
    checks = {}
    # Coinbase is independent of PAL's Yahoo Finance quote provider.
    try:
        value = safe_float(fetch_json("https://api.coinbase.com/v2/prices/BTC-USD/spot")["data"]["amount"])
        pal = safe_float((quotes.get("BTCUSD") or {}).get("price"))
        checks["BTCUSD"] = {"provider":"Coinbase spot", "reference_price":value,
            "pal_price":pal, "difference_pct":round((pal/value-1)*100, 4) if value and pal else None,
            "status":"PASS" if value and pal and abs(pal/value-1) <= 0.02 else "REVIEW" if value and pal else "UNAVAILABLE"}
    except Exception as exc:
        checks["BTCUSD"] = {"provider":"Coinbase spot", "status":"UNAVAILABLE", "error":str(exc)[:180]}
    # ECB reference rates are independent, but update once per business day and are not a tick quote.
    try:
        value = safe_float(fetch_json("https://api.frankfurter.dev/v1/latest?base=GBP&symbols=USD")["rates"]["USD"])
        pal = safe_float((quotes.get("GBPUSD") or {}).get("price"))
        checks["GBPUSD"] = {"provider":"Frankfurter/ECB reference", "reference_price":value,
            "pal_price":pal, "difference_pct":round((pal/value-1)*100, 4) if value and pal else None,
            "comparison_note":"Daily reference rate, not a live intraday tick",
            "status":"PASS" if value and pal and abs(pal/value-1) <= 0.015 else "REVIEW" if value and pal else "UNAVAILABLE"}
    except Exception as exc:
        checks["GBPUSD"] = {"provider":"Frankfurter/ECB reference", "status":"UNAVAILABLE", "error":str(exc)[:180]}
    # Gold spot is a cross-check only: PAL tracks GC=F futures, so a small basis difference is expected.
    try:
        raw = fetch_json("https://api.gold-api.com/price/XAU")
        value = safe_float(raw.get("price") if isinstance(raw, dict) else None)
        pal = safe_float((quotes.get("XAUUSD") or {}).get("price"))
        checks["XAUUSD"] = {"provider":"Gold-API spot", "reference_price":value,
            "pal_price":pal, "difference_pct":round((pal/value-1)*100, 4) if value and pal else None,
            "comparison_note":"Spot-versus-futures basis means this is indicative, not exact parity",
            "status":"PASS" if value and pal and abs(pal/value-1) <= 0.03 else "REVIEW" if value and pal else "UNAVAILABLE"}
    except Exception as exc:
        checks["XAUUSD"] = {"provider":"Gold-API spot", "status":"UNAVAILABLE", "error":str(exc)[:180]}
    # No independent, keyless DXY tick feed is asserted here; the audit refuses to pretend otherwise.
    checks["DXY"] = {"provider":"No independent DXY source configured", "status":"NOT_CROSS_CHECKED",
                     "comparison_note":"Check source timestamp, daily-change sign and Yahoo provider diagnostics."}
    return checks

def score_previous(previous, current_quotes):
    if not previous:
        return {"status":"WAITING_FOR_SECOND_DAILY_SAMPLE", "message":"A prior audit artifact is needed before directional alignment can be scored."}
    outcomes, hits = {}, 0
    old_biases = previous.get("biases", {})
    for key in SYMBOLS:
        bias = str((old_biases.get(key) or {}).get("bias", "UNKNOWN")).upper()
        change = safe_float((current_quotes.get(key) or {}).get("change_percent"))
        threshold = THRESHOLDS[key]
        observed = "BULLISH" if change is not None and change > threshold else "BEARISH" if change is not None and change < -threshold else "NEUTRAL" if change is not None else "UNKNOWN"
        if bias in ("BULLISH", "BEARISH") and observed in ("BULLISH", "BEARISH"):
            result = "ALIGNED" if bias == observed else "DIVERGED"
            hits += result == "ALIGNED"
        else:
            result = "NOT_SCORABLE"
        outcomes[key] = {"previous_bias":bias, "observed_daily_move":observed, "change_percent":change, "result":result}
    scorable = sum(1 for v in outcomes.values() if v["result"] in ("ALIGNED","DIVERGED"))
    return {"status":"SCORED" if scorable else "NO_DIRECTIONAL_SAMPLES", "aligned":hits, "scorable":scorable,
            "alignment_pct":round(hits/scorable*100,1) if scorable else None,
            "warning":"One-day directional alignment is a small-sample diagnostic, not proof of forecast skill or profitability.",
            "assets":outcomes}

def main():
    report = {"checked_at":datetime.now(timezone.utc).isoformat(), "base_url":BASE,
              "quote_provider":"Yahoo Finance chart API", "external_checks":{}, "biases":{}, "quotes":{}, "alerts":[]}
    try:
        health = fetch_json(BASE + "/health", timeout=10)
        report["api_health"] = health
        if str(health.get("status","")).lower() != "healthy":
            raise RuntimeError(f"PAL health not healthy: {health}")
        markets = fetch_json(BASE + "/pal/markets", timeout=10)
        deadline = time.monotonic() + 30
        while markets.get("refreshing") and time.monotonic() < deadline:
            time.sleep(3)
            markets = fetch_json(BASE + "/pal/markets", timeout=10)
        raw_quotes = markets.get("markets", {})
        for key in SYMBOLS:
            q = raw_quotes.get(key) or {}
            stamp = parse_time(q.get("timestamp"))
            age = round((datetime.now(timezone.utc)-stamp).total_seconds(),1) if stamp else None
            report["quotes"][key] = {"price":safe_float(q.get("price")), "change_percent":safe_float(q.get("change_percent")),
                "status":q.get("status","UNKNOWN"), "timestamp":q.get("timestamp"), "age_seconds":age,
                "provider_symbol":q.get("provider_symbol"), "reason":q.get("reason")}
            if report["quotes"][key]["price"] is None:
                report["alerts"].append(f"{key}: no numeric quote")
            if age is not None and age > (900 if key=="BTCUSD" else 7200):
                report["alerts"].append(f"{key}: quote timestamp is older than the audit freshness threshold ({age:.0f}s)")
        analysis = fetch_json(BASE + "/pal/analysis/GBPUSD", timeout=75)
        report["analysis_success"] = bool(analysis.get("success", False))
        report["biases"] = extract_biases(analysis)
        report["directional_consistency"] = {}
        for key in SYMBOLS:
            bias = report["biases"][key]["bias"]
            change = report["quotes"][key]["change_percent"]
            threshold = THRESHOLDS[key]
            daily_direction = "BULLISH" if change is not None and change > threshold else "BEARISH" if change is not None and change < -threshold else "NEUTRAL" if change is not None else "UNKNOWN"
            daily_alignment = "NOT_SCORABLE" if bias not in ("BULLISH", "BEARISH") or daily_direction not in ("BULLISH", "BEARISH") else "ALIGNED" if bias == daily_direction else "DIVERGED"
            reasons = report["biases"][key].get("reasons") or []
            momentum = None
            for reason in reasons:
                match = re.search(r"Latest short-term momentum\s+([+-]?\d+(?:\.\d+)?)%", str(reason), re.I)
                if match:
                    momentum = safe_float(match.group(1))
                    break
            momentum_direction = "BULLISH" if momentum is not None and momentum > 0 else "BEARISH" if momentum is not None and momentum < 0 else "NEUTRAL" if momentum is not None else "UNKNOWN"
            momentum_alignment = "NOT_REPORTED" if momentum is None or bias not in ("BULLISH", "BEARISH") else "ALIGNED" if momentum_direction == bias else "TIMEFRAME_DIVERGENCE"
            report["directional_consistency"][key] = {"PAL_bias":bias, "observed_daily_move":daily_direction,
                "daily_alignment":daily_alignment, "reported_short_term_momentum_pct":momentum,
                "momentum_alignment":momentum_alignment}
            if daily_alignment == "DIVERGED":
                report["alerts"].append(f"{key}: PAL directional label {bias} differs from the current daily move {daily_direction}; review timeframe and reasons.")
            if momentum_alignment == "TIMEFRAME_DIVERGENCE":
                report["alerts"].append(f"{key}: PAL {bias} baseline conflicts with its reported short-term momentum {momentum:+.4f}%; this is a timeframe divergence to review, not automatically a bug.")
        report["external_checks"] = external_checks(raw_quotes)
        for key, check in report["external_checks"].items():
            if check.get("status") == "REVIEW":
                report["alerts"].append(f"{key}: independent-source comparison needs review ({check.get('difference_pct')}% difference)")
        report["previous_day_alignment"] = score_previous(previous_audit(), report["quotes"])
        report["methodology"] = {
            "quote_checks":"timestamps, numeric price, provider symbol and independent cross-check where an independent source is available",
            "bias_checks":"records PAL's daily directional label and compares the prior audit's label with the current daily move",
            "limitations":"Yahoo-backed PAL quotes are not independently validated by another Yahoo endpoint; GBP reference is daily, gold compares spot with futures, and DXY has no independent source configured.",
            "score_definition":"Directional score percentages in the UI are heuristic, uncalibrated scores, not probabilities or win rates."
        }
    except Exception as exc:
        report["fatal_error"] = f"{type(exc).__name__}: {str(exc)[:240]}"
        report["alerts"].append("PAL audit could not complete all core checks.")
    with open("audit.json","w",encoding="utf-8") as fp:
        json.dump(report,fp,indent=2,ensure_ascii=False)
    print(json.dumps(report,indent=2,ensure_ascii=False))
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as fp:
            fp.write("# PAL Daily Bias Audit\n\n")
            fp.write(f"- Checked: {report['checked_at']}\n")
            fp.write(f"- PAL API: {'healthy' if 'fatal_error' not in report else 'FAILED'}\n")
            fp.write(f"- Independent quote checks: {sum(x.get('status') in ('PASS','REVIEW') for x in report.get('external_checks',{}).values())} with a reference source; DXY is explicitly not cross-checked.\n")
            score=report.get("previous_day_alignment",{})
            fp.write(f"- Prior-bias alignment: {score.get('alignment_pct','not yet scorable')}% ({score.get('aligned',0)}/{score.get('scorable',0)} directional samples)\n\n")
            fp.write("## Alerts\n")
            fp.write("\n".join(f"- {a}" for a in report.get("alerts",[])) or "- No audit alerts.")
    return 1 if "fatal_error" in report else 0

if __name__ == "__main__":
    sys.exit(main())
