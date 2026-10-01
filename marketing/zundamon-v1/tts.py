# Synthesize each line of lines.json with a running VOICEVOX engine (http://127.0.0.1:50021).
# Usage: python tts.py [speedScale]   -> voice/NN.wav + voice/durations.json
# Subtitles keep the original text; only the spoken text gets reading fixes below.
import json, sys, urllib.parse, urllib.request, wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
API = "http://127.0.0.1:50021"
SPEED = float(sys.argv[1]) if len(sys.argv) > 1 else 1.15
READ = [("DIAMOND NINE", "ダイヤモンドナイン"), ("TestFlight", "テストフライト"), ("iPhone", "アイフォーン"),
        ("Android", "アンドロイド"), ("OK", "オーケー"), ("Xに", "エックスに"), ("143試合", "百四十三試合"),
        ("3枚", "三枚"), ("1枚", "一枚"), ("1シーズン", "ワンシーズン"), ("『", ""), ("』", "")]

def call(method, path, body=None):
    req = urllib.request.Request(API + path, data=body, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()

def speaker_id(char, style="ノーマル"):
    for sp in json.loads(call("GET", "/speakers")):
        if sp["name"] == char:
            for st in sp["styles"]:
                if st["name"] == style:
                    return st["id"]
    raise SystemExit(f"speaker not found: {char}/{style}")

def main():
    ids = {"zundamon": speaker_id("ずんだもん"), "metan": speaker_id("四国めたん")}
    print("speaker ids", ids)
    out = HERE / "voice"
    out.mkdir(exist_ok=True)
    lines = json.loads((HERE / "lines.json").read_text(encoding="utf-8"))
    durs = []
    for i, ln in enumerate(lines, start=1):
        spoken = ln["text"]
        for a, b in READ:
            spoken = spoken.replace(a, b)
        sid = ids[ln["who"]]
        q = json.loads(call("POST", f"/audio_query?speaker={sid}&text={urllib.parse.quote(spoken)}"))
        q["speedScale"] = SPEED
        q["prePhonemeLength"] = 0.05
        q["postPhonemeLength"] = 0.1
        wav = call("POST", f"/synthesis?speaker={sid}", json.dumps(q).encode("utf-8"))
        f = out / f"{i:02d}.wav"
        f.write_bytes(wav)
        with wave.open(str(f)) as w:
            d = w.getnframes() / w.getframerate()
        durs.append(round(d, 3))
        print(f"{i:02d} {ln['who']:8s} {d:5.2f}s  {spoken}")
    (out / "durations.json").write_text(json.dumps({"speed": SPEED, "ids": ids, "durations": durs}), encoding="utf-8")
    print("total voice", round(sum(durs), 2), "s")

if __name__ == "__main__":
    main()
