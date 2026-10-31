"""DIAMOND NINE の RevenueCat 組み込み前の注文(10/29 の2件)を RevenueCat に取り込む。
先に持ち主が RevenueCat の「DIAMOND NINE (Android)」に Play のサービスアカウントの JSON を入れておくこと(無いと RevenueCat が Google に確かめられず失敗する)。
注文 ID から Play の Orders API で購入トークンを読み(画面には出さない)、RevenueCat の POST /v1/receipts に送る。同じ購入を2回送っても RevenueCat 側で1件にまとまる。
python scripts-rc-import-past.py [--dry]"""
import json, sys, urllib.request, urllib.error, warnings
warnings.filterwarnings("ignore"); sys.stdout.reconfigure(encoding="utf-8")
from google.oauth2 import service_account
from googleapiclient.discovery import build
PKG = "com.diamondninebaseball.game"
ORDERS = [("GPA.3392-2677-1699-26008", "premium_pass"), ("GPA.3344-4937-9139-19129", "pt_pack_300000")]  # 2026-10-29
KEY = r"C:\Users\yuichi1\Downloads\plenary-shade-437402-h4-9185a7081e39.json"
rc = json.load(open(r"C:\Users\yuichi1\Downloads\ios_release\rc_keys.json", encoding="utf-8"))["diamondnine"]["android_public_key"]
cr = service_account.Credentials.from_service_account_file(KEY, scopes=["https://www.googleapis.com/auth/androidpublisher"])
s = build("androidpublisher", "v3", credentials=cr, cache_discovery=False)
for oid, pid in ORDERS:
    o = s.orders().get(packageName=PKG, orderId=oid).execute()
    tok = o.get("purchaseToken"); print(oid, pid, o.get("state"), o.get("total", {}), "token" if tok else "NO TOKEN")
    if not tok or "--dry" in sys.argv: continue
    body = {"app_user_id": "d9_play_order_" + oid, "fetch_token": tok, "product_id": pid, "is_restore": False}
    req = urllib.request.Request("https://api.revenuecat.com/v1/receipts", data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": "Bearer " + rc, "X-Platform": "android", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: print("  RevenueCat", r.status)
    except urllib.error.HTTPError as e: print("  RevenueCat", e.code, e.read()[:300].decode("utf-8", "replace"))
