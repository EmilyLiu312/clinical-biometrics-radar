#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把新条目合并进 data.json：校验字段、去重、排序、写回。

上游（搜索 + 判断）产出的原始条目放进 inbox.json，本脚本只负责"入库卫生"。

用法：
    python3 scripts/merge_items.py                    # inbox.json -> data.json
    python3 scripts/merge_items.py --inbox other.json
    python3 scripts/merge_items.py --check            # 只校验 data.json，不写入
    python3 scripts/merge_items.py --max 500          # 保留最近 N 条

inbox.json 可以是数组，也可以是 {"items": [...]}。每条必需字段：
    title, category, importance, summary, impact, source, url, published
可选：tags（数组或逗号分隔字符串）、deadline、collected（缺省为今天）
"""

import argparse
import io
import json
import os
import re
import sys
from datetime import date

CATEGORIES = ["AI产品动态", "FDA与法规", "CDISC与标准", "行业与会议"]
IMPORTANCE = ["高", "中", "低"]
REQUIRED = ["title", "category", "importance", "summary", "impact", "source", "url", "published"]

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data.json")
INBOX = os.path.join(ROOT, "inbox.json")


def norm_url(u):
    u = (u or "").strip().lower()
    u = re.sub(r"^https?://", "", u)
    u = re.sub(r"^www\.", "", u)
    u = u.split("#")[0].rstrip("/")
    return u


def norm_title(t):
    t = (t or "").lower()
    return re.sub(r"[\s\-—–_·,，。.、:：;；()（）\[\]【】\"'“”‘’]+", "", t)


def d10(v):
    v = str(v or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}", v):
        return ""
    return v[:10]


def normalize(item):
    out = {
        "title": str(item.get("title", "")).strip(),
        "category": str(item.get("category", "")).strip(),
        "importance": str(item.get("importance", "")).strip(),
        "summary": str(item.get("summary", "")).strip(),
        "impact": str(item.get("impact", "")).strip(),
        "source": str(item.get("source", "")).strip(),
        "url": str(item.get("url", "")).strip(),
        "tags": item.get("tags") or [],
        "published": d10(item.get("published")),
        "deadline": d10(item.get("deadline")),
        "collected": d10(item.get("collected")) or date.today().isoformat(),
    }
    if isinstance(out["tags"], str):
        out["tags"] = [t.strip() for t in re.split(r"[,，;；]", out["tags"]) if t.strip()]
    else:
        out["tags"] = [str(t).strip() for t in out["tags"] if str(t).strip()]
    return out


def problems(item, idx):
    errs = []
    for f in REQUIRED:
        if not item.get(f):
            errs.append("第 %d 条缺少 %s" % (idx + 1, f))
    if item.get("category") and item["category"] not in CATEGORIES:
        errs.append("第 %d 条分类非法：%s（只能是 %s）" % (idx + 1, item["category"], "/".join(CATEGORIES)))
    if item.get("importance") and item["importance"] not in IMPORTANCE:
        errs.append("第 %d 条重要度非法：%s（只能是 高/中/低）" % (idx + 1, item["importance"]))
    if item.get("url") and not item["url"].startswith("http"):
        errs.append("第 %d 条 url 不是 http(s) 链接" % (idx + 1))
    if item.get("published") and not item["published"]:
        errs.append("第 %d 条 published 不是 YYYY-MM-DD" % (idx + 1))
    return errs


def load(path):
    if not os.path.isfile(path):
        return None
    data = json.load(io.open(path, encoding="utf-8"))
    if isinstance(data, list):
        return {"updated": "", "items": data}
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inbox", default=INBOX)
    ap.add_argument("--data", default=DATA)
    ap.add_argument("--max", type=int, default=500)
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()

    data = load(a.data)
    if data is None:
        raise SystemExit("找不到 %s" % a.data)

    existing = [normalize(x) for x in data.get("items", [])]
    errs = []
    for i, it in enumerate(existing):
        errs += problems(it, i)

    added, skipped = [], 0
    if not a.check:
        inbox = load(a.inbox)
        if inbox is None:
            raise SystemExit("找不到 %s，请把新条目放进去" % a.inbox)
        seen_urls = {norm_url(x["url"]) for x in existing}
        seen_titles = {norm_title(x["title"]) for x in existing}
        for i, raw in enumerate(inbox.get("items", [])):
            it = normalize(raw)
            errs += problems(it, i)
            if not it["title"] or not it["url"]:
                continue
            if norm_url(it["url"]) in seen_urls or norm_title(it["title"]) in seen_titles:
                skipped += 1
                continue
            seen_urls.add(norm_url(it["url"]))
            seen_titles.add(norm_title(it["title"]))
            added.append(it)

    if errs:
        print("校验未通过，未写入：", file=sys.stderr)
        for e in errs:
            print("  - " + e, file=sys.stderr)
        return 2

    if a.check:
        print("OK %d 条，格式全部合法" % len(existing))
        return 0

    items = existing + added
    items.sort(key=lambda x: (x["collected"], x["published"]), reverse=True)
    items = items[: a.max]
    out = {"updated": date.today().isoformat(), "items": items}
    io.open(a.data, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=2) + "\n")

    print("新增 %d 条，去重跳过 %d 条，现有 %d 条" % (len(added), skipped, len(items)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
