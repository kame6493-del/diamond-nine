"""DIAMOND NINE(Android、com.diamondninebaseball.game)を RevenueCat(プロジェクト Nigatecho)に登録する。何度流しても二重に作らない。
課金はアプリ側(@capgo/native-purchases)で完了させ、RevenueCat には記録だけを流す(observer モード)。売り場(Offering)は使わない。
- アプリ「DIAMOND NINE (Android)」、権利 d9_premium(premium_pass だけ)
- 商品 = Play の商品 ID と同じ: premium_pass(買い切り)と pt_pack_*(消費型6つ)
- 公開キーは ios_release/rc_keys.json の "diamondnine" と mobile/revenuecat-config.json(android)に入れる。値は画面に出さない。
- Play のサービスアカウントの JSON は API では入れられない(持ち主が RevenueCat のダッシュボードで入れる)
python scripts-rc-setup.py"""
import json, os, sys
D = r"C:\Users\yuichi1\Downloads\ios_release"
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(D, "rc_all.py"), encoding="utf-8").read()
cut = src.index("apps = {a.get(\"app_store\"")  # 関数の定義まで(iOS の登録処理は流さない)
g = {"__file__": os.path.join(D, "rc_all.py"), "__name__": "rc_all_d9"}
sys.argv = [sys.argv[0]]
exec(src[:cut], g)
call, items = g["call"], g["items"]
sys.stdout.reconfigure(encoding="utf-8")

PKG = "com.diamondninebaseball.game"
ENT = "d9_premium"
PRODUCTS = [  # (store_identifier, type, 表示名, 権利)
    ("premium_pass", "non_consumable", "DIAMOND NINE Premium Pass", ENT),
    ("pt_pack_3000", "consumable", "DIAMOND NINE 3,000 pt", None),
    ("pt_pack_10000", "consumable", "DIAMOND NINE 10,000 pt", None),
    ("pt_pack_21000", "consumable", "DIAMOND NINE 21,000 pt", None),
    ("pt_pack_69000", "consumable", "DIAMOND NINE 69,000 pt", None),
    ("pt_pack_126000", "consumable", "DIAMOND NINE 126,000 pt", None),
    ("pt_pack_300000", "consumable", "DIAMOND NINE 300,000 pt", None),
    # 2026-11-01 はじめての購入だけの1回限り(アプリは消費しない)
    ("pt_first_30000", "non_consumable", "DIAMOND NINE 30,000 pt (first purchase)", None),
]
apps = {a.get("play_store", {}).get("package_name"): a for a in items("/apps") if a["type"] == "play_store"}
if PKG not in apps:
    st, js = call("POST", "/apps", {"name": "DIAMOND NINE (Android)", "type": "play_store", "play_store": {"package_name": PKG}})
    assert st == 201, (st, js); apps[PKG] = js; print("アプリ作成")
app_id = apps[PKG]["id"]
ents = {e["lookup_key"]: e for e in items("/entitlements")}
prods = {(p["store_identifier"], p["app_id"]): p for p in items("/products")}
for sid, ty, name, ent in PRODUCTS:
    p = prods.get((sid, app_id))
    if not p:
        st, js = call("POST", "/products", {"store_identifier": sid, "app_id": app_id, "type": ty, "display_name": name})
        assert st == 201, (sid, st, js); p = js; print("商品作成", sid)
    if ent:
        if ent not in ents:
            st, js = call("POST", "/entitlements", {"lookup_key": ent, "display_name": "DIAMOND NINE Premium"}); assert st == 201, (st, js); ents[ent] = js; print("権利作成", ent)
        st, js = call("GET", f"/entitlements/{ents[ent]['id']}/products?limit=200"); have = {x["id"] for x in js.get("items", [])}
        if p["id"] not in have:
            st, js = call("POST", f"/entitlements/{ents[ent]['id']}/actions/attach_products", {"product_ids": [p["id"]]}); print("権利", ent, "に紐づけ", sid, st)

# 2026-11-01 売り場(Offering) diamondnine に D9 の商品を並べる(アプリは observer なので読まないが、ダッシュボードで見やすくする)。
offs = {o["lookup_key"]: o for o in items("/offerings")}
if "diamondnine" not in offs:
    st, js = call("POST", "/offerings", {"lookup_key": "diamondnine", "display_name": "DIAMOND NINE"}); assert st == 201, (st, js); offs["diamondnine"] = js; print("売り場作成 diamondnine")
off = offs["diamondnine"]["id"]
pkgs = {x["lookup_key"]: x for x in items(f"/offerings/{off}/packages")}
prods = {(p["store_identifier"], p["app_id"]): p for p in items("/products")}
for i, (sid, ty, name, ent) in enumerate(PRODUCTS):
    lk = "$rc_lifetime" if sid == "premium_pass" else sid
    if lk not in pkgs:
        st, js = call("POST", f"/offerings/{off}/packages", {"lookup_key": lk, "display_name": name, "position": i + 1}); assert st == 201, (lk, st, js); pkgs[lk] = js; print("パッケージ作成", lk)
    p = prods[(sid, app_id)]
    st, js = call("GET", f"/packages/{pkgs[lk]['id']}/products?limit=100")
    have = {x["product"]["id"] if "product" in x else x.get("id") for x in js.get("items", [])}
    if p["id"] not in have:
        st, js = call("POST", f"/packages/{pkgs[lk]['id']}/actions/attach_products", {"products": [{"product_id": p["id"], "eligibility_criteria": "all"}]}); print("パッケージ", lk, "に紐づけ", st, "" if st == 200 else str(js)[:200])

st, js = call("GET", f"/apps/{app_id}/public_api_keys")
keys = [k["key"] for k in js.get("items", [])]
assert keys, "公開キーが無い"
kf = os.path.join(D, "rc_keys.json"); result = json.load(open(kf, encoding="utf-8"))
result["diamondnine"] = {"rc_android_app_id": app_id, "android_public_key": keys[0], "mode": "observer"}
json.dump(result, open(kf, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
cfg = os.path.join(HERE, "revenuecat-config.json")
c = json.load(open(cfg, encoding="utf-8")) if os.path.exists(cfg) else {"_comment": "RevenueCat public SDK keys (safe to ship). Purchases are completed by the app; RevenueCat only records them (observer mode)."}
c["android"] = keys[0]; c.setdefault("ios", "")
json.dump(c, open(cfg, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("rc app", app_id, "/ 商品", len(PRODUCTS), "/ 公開キーを revenuecat-config.json と rc_keys.json に入れた(値は出さない)")
