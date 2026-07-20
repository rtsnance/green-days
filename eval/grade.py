#!/usr/bin/env python3
"""
Green Days recipe-engine eval harness.

Runs a fixed set of golden baskets through the recipe engine, grades each
result with (1) a deterministic lint pass for the unforgivable failures and
(2) an optional LLM-judge pass for the soft quality dimensions, then writes a
scored report. Use it as a regression gate: run before and after any change to
the recipe system prompt and compare.

Usage
  # generate recipes from the live endpoint, lint + judge, write report
  ANTHROPIC_API_KEY=... python3 grade.py --out runs/2026-07-12.json

  # lint only (no API key needed, no judge)
  python3 grade.py --no-judge --out runs/lint-only.json

  # grade pre-generated recipes instead of calling the endpoint
  python3 grade.py --from-file anchors_as_recipes.json --no-judge

  # regression check against a previous run
  python3 grade.py --out runs/new.json --baseline runs/old.json

Exit code is non-zero if any hard gate fails, or (with --baseline) if a
regression is detected. Wire that into CI or a pre-deploy check.

Env
  GREENDAYS_RECIPE_URL  default https://greendays.day/api/recipe
  ANTHROPIC_API_KEY     required unless --no-judge
  JUDGE_MODEL           default claude-opus-4-8

Note on seasonality: the in-season truth here is an APPROXIMATE model parsed
from produce.json's free-text season labels (+ a Mediterranean widening). It
exists so the off-season-honesty gate has something to check against. If it
ever disagrees with the app's own seasonality logic, trust the app and adjust
parse_season()/in_season() to match.
"""
import argparse, json, os, re, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "data"))
RECIPE_URL = os.environ.get("GREENDAYS_RECIPE_URL", "https://greendays.day/api/recipe")
JUDGE_MODEL = os.environ.get("JUDGE_MODEL", "claude-opus-4-8")

# ---------------------------------------------------------------- data loading
def load_produce():
    d = json.load(open(os.path.join(ASSETS, "produce.json")))
    items = d if isinstance(d, list) else d.get("items", d.get("produce"))
    return {it["id"]: it for it in items}

def load_markets():
    return json.load(open(os.path.join(ASSETS, "markets.json")))

# ------------------------------------------------------------- seasonality model
# Calendar wheel in seasonal order, so a range "A–B" is a contiguous slice.
WHEEL = [3,4,5,6,7,8,9,10,11,12,1,2]
SEASON_MONTHS = {"spring":[3,4,5], "summer":[6,7,8], "autumn":[9,10,11], "winter":[12,1,2]}
# "early/late X" edge windows. Late summer deliberately spills into September:
# late-summer crops (borlotti, sweetcorn, marrow, damson) genuinely linger there.
EDGE = {
    ("early","spring"):{3}, ("late","spring"):{5},
    ("early","summer"):{6}, ("late","summer"):{8,9},
    ("early","autumn"):{9}, ("late","autumn"):{11},
    ("early","winter"):{12},("late","winter"):{2},
}
def _edge_months(mod, seas):
    return set(EDGE[(mod, seas)]) if mod else set(SEASON_MONTHS[seas])

def _season_tokens(s):
    return [(m.group(1), m.group(2), m.start())
            for m in re.finditer(r"(early|late)?\s*(spring|summer|autumn|winter)", s)]

def _span(start, end):
    i = WHEEL.index(start); out = []
    for k in range(12):
        mm = WHEEL[(i+k) % 12]; out.append(mm)
        if mm == end: break
    return set(out)

def parse_season(label):
    """Return (months:set[int], available_all:bool). available_all is True only
    for genuinely year-round items (never off-season). 'imported' is NOT
    year-round here: an imported item is exactly what should be flagged when it
    is out of its local season."""
    s = (label or "").lower()
    available_all = "year-round" in s
    toks = _season_tokens(s)
    if not toks:
        return (set() if available_all else set(range(1,13))), available_all
    is_range = len(toks) >= 2 and ("–" in s or "-" in s or " to " in s)
    if is_range:
        a, b = toks[0], toks[-1]
        starts, ends = _edge_months(a[0], a[1]), _edge_months(b[0], b[1])
        wpos = WHEEL.index
        months = _span(min(starts, key=wpos), max(ends, key=wpos))
    else:
        months = set()
        for mod, seas, _ in toks:
            months |= _edge_months(mod, seas)
    if "store" in s:  # stored crops (apples, garlic) last into winter
        months |= {12,1,2}
    return months, available_all

def in_season(item, month, band):
    months, available_all = parse_season(item.get("season"))
    if available_all:
        return True
    win = set(months)
    if band == "mediterranean":  # produce comes earlier and lingers in the south
        for m in list(months):
            win.add((m % 12) + 1)
            win.add(((m - 2) % 12) + 1)
    return month in win

# ------------------------------------------------------------------- lint pass
# Term families + matching are kept IN SYNC with the worker guard
# (worker/index.js auditRecipe). Word-boundary matching with variant-aware
# lists so texture/flavor words never masquerade as ingredients:
# "creamy" != cream, "nutty"/"nutmeg" != nut, "buttered" is caught, "butternut"
# is not, "eggplant" != egg. A couple of compounds still need scrubbing.
ALLERGEN = {
    "Nuts": ["almond","almonds","walnut","walnuts","hazelnut","hazelnuts","pecan","pecans","cashew","cashews","pistachio","pistachios","peanut","peanuts","pine nut","pine nuts","praline"],
    "Dairy": ["butter","buttered","buttery","cream","creamed","milk","cheese","yogurt","yoghurt","burrata","mozzarella","parmesan","parmigiano","queijo","feta","ricotta","mascarpone","ghee","creme fraiche","crème fraîche"],
    "Gluten": ["bread","toast","pasta","flour","breadcrumb","breadcrumbs","crouton","croutons","couscous","wheat","barley","bulgur","orzo","farro","pastry","cracker"],
    "Eggs": ["egg","eggs"],
    "Shellfish": ["prawn","prawns","shrimp","crab","crabs","lobster","mussel","mussels","clam","clams","scallop","scallops","langoustine","crayfish","oyster","oysters"],
    "Soy": ["soy","soya","tofu","miso","tempeh","tamari","edamame"],
}
MEAT = ["beef","pork","lamb","chicken","sausage","sausages","chorizo","bacon","prosciutto","pancetta","duck","veal","turkey","salami","guanciale"]
FISH = ["fish","sardine","sardines","anchovy","anchovies","tuna","salmon","mackerel","cod","haddock","trout","seafood"]
DAIRY = ALLERGEN["Dairy"]
EGG = ALLERGEN["Eggs"]
NONVEGAN_EXTRA = DAIRY + EGG + ["honey"]
PROTEIN_PRODUCE = {"borlotti-beans","broad-beans-fava","edamame","garden-peas"}

def _text_fields(recipe):
    """All human-readable recipe text as one lowercased blob, plus the parts."""
    parts = []
    for k in ("title","note","stars","ingredients","method","grabOneMore","protein","offSeasonAdvice"):
        v = recipe.get(k)
        if isinstance(v, list):
            v = " ; ".join(str(x) for x in v)
        parts.append((k, str(v or "")))
    blob = " \n ".join(p[1] for p in parts).lower()
    return blob, dict(parts)

def _scrub_shellfish(blob):
    # "oyster mushroom" must not trip the shellfish "oyster" match
    return re.sub(r"oyster mushrooms?", "mushroom", blob)

def _scrub_dairy(blob):
    # plant milks/creams are not dairy: "coconut cream", "oat milk", etc.
    return re.sub(r"\b(coconut|almond|oat|soya|soy|rice|cashew|hemp)\s+(milk|cream|yogurt|yoghurt)\b", r"\1", blob)

def _hits(blob, terms):
    """Whole-word matches (optional trailing plural), so 'creamy' != cream and
    'nutty'/'nutmeg' != nut, matching the worker guard's \\bterms?\\b logic."""
    found = []
    for t in terms:
        t2 = t.strip()
        if not t2:
            continue
        if re.search(rf"\b{re.escape(t2)}s?\b", blob):
            found.append(t2)
    return sorted(set(found))

def lint(recipe, req, produce):
    """Return dict with hard_fail:list, warn:list, and per-check detail."""
    prefs = req.get("prefs", {}) or {}
    diet = (prefs.get("diet") or "none").lower()
    allergies = prefs.get("allergies", []) or []
    basket_ids = req.get("basket", []) or []
    basket_names = " ".join((produce.get(i, {}).get("name_en", i)).lower() for i in basket_ids)

    blob, parts = _text_fields(recipe)
    shell_scan = _scrub_shellfish(blob)
    dairy_scan = _scrub_dairy(blob)
    # do not penalise ingredients the user themselves put in the basket
    _wl = lambda t: t in basket_names
    hard, warn = [], []

    # G4 structure
    required = ["title","note","stars","ingredients","method","grabOneMore"]
    missing = [k for k in required if not str(recipe.get(k) or "").strip()]
    if missing:
        hard.append(f"STRUCTURE: missing/empty required field(s): {', '.join(missing)}")

    # G1 allergens (skip terms the user has in their own basket; per-family scrub)
    for a in allergies:
        terms = ALLERGEN.get(a, [])
        src = shell_scan if a == "Shellfish" else dairy_scan if a == "Dairy" else blob
        found = [t for t in _hits(src, terms) if not _wl(t)]
        if found:
            hard.append(f"ALLERGEN[{a}]: recipe calls for {found} despite '{a}' allergy")

    # G2 diet
    if diet in ("vegan","vegetarian"):
        found = [t for t in _hits(shell_scan, MEAT+FISH+ALLERGEN["Shellfish"]) if not _wl(t)]
        if found:
            hard.append(f"DIET[{diet}]: animal terms present: {found}")
    if diet == "vegan":
        found = [t for t in _hits(dairy_scan, DAIRY) if not _wl(t)] \
              + [t for t in _hits(blob, EGG + ["honey"]) if not _wl(t)]
        if found:
            hard.append(f"DIET[vegan]: dairy/egg/honey present: {found}")

    # G3 off-season honesty
    off = []
    for i in basket_ids:
        it = produce.get(i)
        if it and not in_season(it, req.get("month"), req.get("_band")):
            off.append(i)
    osa = str(recipe.get("offSeasonAdvice") or "").strip()
    if off:
        named = [i for i in off if produce.get(i,{}).get("name_en","").lower() in osa.lower() or i.replace("-"," ") in osa.lower()]
        if not osa:
            hard.append(f"OFF-SEASON: basket has off-season item(s) {off} but no honest off-season note")
        elif not named:
            warn.append(f"OFF-SEASON: note present but does not clearly name the off-season item(s) {off}")
    else:
        if osa:
            warn.append("OFF-SEASON: note present but all basket items look in-season (possible false flag)")

    # G7/G8/G9 voice hard rules
    if "—" in blob:
        hard.append("VOICE: em dash present (rule: no em dashes)")
    if re.search(r"(?<![a-z])simply(?![a-z])", blob):
        hard.append("VOICE: 'simply' present (banned word)")
    if "!" in blob:
        hard.append("VOICE: exclamation mark present (banned)")
    # 'just' is legitimate as a degree adverb ('just tender'), so warn-only with context
    for m in re.finditer(r"(?<![a-z])just(?![a-z])", blob):
        ctx = blob[max(0,m.start()-15):m.end()+15].replace("\n"," ")
        warn.append(f"VOICE: 'just' used — check it is degree ('just tender') not filler: …{ctx}…")

    # time/effort cue
    if not re.search(r"minute|hour|quick|slow|weeknight|tuesday|sunday|fast", blob):
        warn.append("CUE: no time/effort cue found (recipes should signal quick vs leisurely)")

    # G5 protein rule
    has_protein_produce = any(i in PROTEIN_PRODUCE for i in basket_ids)
    if has_protein_produce and str(recipe.get("protein") or "").strip():
        warn.append("PROTEIN: basket already has a pulse; 'make it a meal' protein should usually be omitted")

    return {"hard_fail": hard, "warn": warn, "off_season_items": off}

# ------------------------------------------------------------------ judge pass
JUDGE_SYSTEM = """You are a strict but fair recipe editor for "Green Days", grading one generated recipe against the app's principles. Score only what the principles ask for. Return ONLY minified JSON, no prose.

PRINCIPLES (condensed):
- The cook: a confident home cook. Simple, with real technique when it earns its place (refogado, braise, pan sauce, sear). Never fussy or cheffy. Lean minimalist when produce is at absolute peak; curious/improvisational for variety.
- Voice: warm and spare. Poetry ONLY in the one-line seasonal note and the "grab one more" nudge; method stays plain and sensory. Never: em dashes, "simply"/"just" as filler, exclamation marks, backstory, purple food-writing.
- Produce is the star. Market-strict: only things a shopper could grab at the same European market/supermarket that day. Assumed pantry: olive oil, salt, pepper, garlic, onion, vinegar, lemon, butter, eggs, flour, pasta/rice, stock, common dried herbs/spices.
- Mediterranean-European home cooking as default voice, with a LIGHT inflection from the market's country. Rooted, not costumed.
- Servings 2, quantities scale obviously. Signal quick vs leisurely up front.
- "Grab one more": one in-season item to complete the dish. "Make it a meal": 1-2 proteins ONLY when the dish has none, diet-aware; omit if a protein is present. Honest off-season note only when an off-season item is in the basket. Honor diet/allergy silently.

Score each dimension 1-5 (5 best):
- voice: warm, spare, correct register; poetry confined to note + grab-one-more
- technique: confident-home-cook level; technique earns its place; not fussy, not lazy; peak/variety dial right
- seasonality: stars are the in-season picks; market-strict; location inflection light and correct; off-season handled honestly
- structure: clear numbered method, scales to 2, fresh-vs-pantry register, useful grab-one-more, protein rule respected
- appetite: would a real cook want to make and eat this
Also give overall (1-5) and list hard_flags (array of short strings) for any principle-violation you see (allergen/diet breach, banned words, dishonest seasonality, non-market ingredient). rationale: one sentence.

Return exactly: {"voice":n,"technique":n,"seasonality":n,"structure":n,"appetite":n,"overall":n,"hard_flags":[...],"rationale":"..."}"""

def judge(recipe, req, produce, band):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY not set (use --no-judge to skip)")
    # give the judge the basket with season truth so it can assess honesty
    basket_ctx = []
    for i in req.get("basket", []):
        it = produce.get(i, {})
        basket_ctx.append({
            "id": i, "name": it.get("name_en", i), "season_label": it.get("season"),
            "in_season_here": in_season(it, req.get("month"), band) if it else None,
        })
    user = {
        "market": {"country": req.get("country"), "band": band, "month": req.get("month")},
        "prefs": req.get("prefs", {}),
        "basket": basket_ctx,
        "recipe": recipe,
    }
    body = json.dumps({
        "model": JUDGE_MODEL, "max_tokens": 600, "system": JUDGE_SYSTEM,
        "messages": [{"role":"user","content": json.dumps(user, ensure_ascii=False)}],
    }).encode()
    r = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={
        "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json",
    })
    with urllib.request.urlopen(r, timeout=60) as resp:
        out = json.load(resp)
    txt = out["content"][0]["text"].strip()
    txt = re.sub(r"^```json|^```|```$", "", txt.strip(), flags=re.M).strip()
    return json.loads(txt)

# --------------------------------------------------------------- recipe source
def call_engine(req):
    payload = {k: req[k] for k in ("basket","country","month","prefs","avoid") if k in req}
    payload.setdefault("avoid", [])
    data = json.dumps(payload).encode()
    r = urllib.request.Request(RECIPE_URL, data=data, headers={"content-type":"application/json"})
    with urllib.request.urlopen(r, timeout=90) as resp:
        return json.load(resp)

# ----------------------------------------------------------------------- main
def run():
    ap = argparse.ArgumentParser()
    ap.add_argument("--baskets", default=os.path.join(HERE, "golden_baskets.json"))
    ap.add_argument("--from-file", help="JSON map {basket_id: recipe} to grade instead of calling the engine")
    ap.add_argument("--no-judge", action="store_true")
    ap.add_argument("--out", default=os.path.join(HERE, "runs", f"run-{int(time.time())}.json"))
    ap.add_argument("--baseline", help="prior run json to diff against")
    ap.add_argument("--sleep", type=float, default=0.0, help="seconds between engine calls")
    ap.add_argument("--label", default=None, help="label for this run (e.g. the model under test)")
    args = ap.parse_args()

    produce = load_produce()
    markets = load_markets()
    spec = json.load(open(args.baskets))
    baskets = spec["baskets"] if isinstance(spec, dict) else spec
    pregen = json.load(open(args.from_file)) if args.from_file else None

    results = []
    for b in baskets:
        req = dict(b["request"])
        band = markets.get(req.get("country",""), {}).get("band")
        req["_band"] = band
        try:
            t0 = time.time()
            recipe = pregen[b["id"]] if pregen else call_engine(req)
            latency_ms = None if pregen else round((time.time() - t0) * 1000)
        except (urllib.error.URLError, KeyError) as e:
            results.append({"id": b["id"], "intent": b.get("intent"), "error": str(e)})
            continue
        L = lint(recipe, req, produce)
        row = {"id": b["id"], "intent": b.get("intent"), "tags": b.get("tags", []),
               "hard_fail": L["hard_fail"], "warn": L["warn"], "off_season_items": L["off_season_items"],
               "latency_ms": latency_ms, "recipe_title": recipe.get("title"), "recipe": recipe}
        if not args.no_judge:
            try:
                row["judge"] = judge(recipe, req, produce, band)
            except Exception as e:
                row["judge_error"] = str(e)
        results.append(row)
        if args.sleep and not pregen:
            time.sleep(args.sleep)

    # aggregate
    graded = [r for r in results if "error" not in r]
    n = len(graded)
    hard_fail_n = sum(1 for r in graded if r["hard_fail"])
    agg = {"baskets": len(results), "graded": n, "errored": len(results)-n,
           "hard_fail_baskets": hard_fail_n,
           "hard_fail_rate": round(hard_fail_n/n, 3) if n else None}
    dims = ["voice","technique","seasonality","structure","appetite","overall"]
    judged = [r["judge"] for r in graded if isinstance(r.get("judge"), dict)]
    if judged:
        agg["judge_means"] = {d: round(sum(j.get(d,0) for j in judged)/len(judged), 2) for d in dims}
        agg["judged"] = len(judged)
    lats = sorted(r["latency_ms"] for r in graded if r.get("latency_ms"))
    if lats:
        pct = lambda p: lats[min(len(lats) - 1, int(round(p / 100 * (len(lats) - 1))))]
        agg["latency_ms"] = {"median": pct(50), "p95": pct(95), "min": lats[0], "max": lats[-1], "n": len(lats)}

    report = {"generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "recipe_url": RECIPE_URL, "label": args.label,
              "judge_model": None if args.no_judge else JUDGE_MODEL, "aggregate": agg, "results": results}

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    json.dump(report, open(args.out, "w"), ensure_ascii=False, indent=2)
    _print_summary(report)
    print(f"\nReport written: {args.out}")

    regressed = False
    if args.baseline and os.path.exists(args.baseline):
        regressed = _diff(json.load(open(args.baseline)), report)

    if hard_fail_n or regressed:
        sys.exit(1)

def _print_summary(rep):
    a = rep["aggregate"]
    print(f"\n{rep.get('label') or ''}  Graded {a['graded']}/{a['baskets']} baskets  (errored {a['errored']})")
    print(f"Hard-gate failures: {a['hard_fail_baskets']} baskets  (rate {a['hard_fail_rate']})")
    if a.get("latency_ms"):
        L = a["latency_ms"]; print(f"Latency ms: median {L['median']}  p95 {L['p95']}  (min {L['min']}, max {L['max']})")
    if a.get("judge_means"):
        print("Judge means: " + "  ".join(f"{k} {v}" for k,v in a["judge_means"].items()))
    for r in rep["results"]:
        if r.get("error"):
            print(f"  ! {r['id']}: ENGINE ERROR {r['error']}"); continue
        if r["hard_fail"]:
            print(f"  ✗ {r['id']}  [{', '.join(r.get('tags',[]))}]")
            for h in r["hard_fail"]:
                print(f"      HARD: {h}")

def _diff(base, new):
    """Return True if a regression is detected."""
    bmap = {r["id"]: r for r in base.get("results", [])}
    regressed = False
    print("\n=== regression vs baseline ===")
    for r in new["results"]:
        b = bmap.get(r["id"])
        if not b:
            continue
        # new hard failures where there were none
        if r.get("hard_fail") and not b.get("hard_fail"):
            print(f"  REGRESSION {r['id']}: new hard failure(s): {r['hard_fail']}")
            regressed = True
    ba, na = base.get("aggregate",{}).get("judge_means"), new.get("aggregate",{}).get("judge_means")
    if ba and na:
        for d in na:
            if d in ba and na[d] - ba[d] <= -0.3:
                print(f"  REGRESSION judge '{d}': {ba[d]} -> {na[d]}")
                regressed = True
    if not regressed:
        print("  no regressions")
    return regressed

if __name__ == "__main__":
    run()
