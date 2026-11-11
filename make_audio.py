"""Generate natural Korean MP3s for every unit.

Run on your own computer (needs internet):
    pip install edge-tts
    python3 make_audio.py

Creates units/<unit>/audio/<hash>.mp3 for each word. Already-made files are
skipped, so just run it again after adding new words or units.
"""
import asyncio, re, sys, unicodedata
from pathlib import Path

try:
    import edge_tts
except ImportError:
    sys.exit("First run:  pip install edge-tts")

VOICE = "ko-KR-SunHiNeural"   # female. Male option: "ko-KR-InJoonNeural"
RATE = "-10%"                  # a little slower than normal

def audio_name(text):  # must match audioName() in shared/app.js
    h = 0x811c9dc5
    t = unicodedata.normalize("NFC", text)
    for unit in t.encode("utf-16-le").hex(" ", 2).split():
        h ^= int(unit[2:4] + unit[0:2], 16)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"

async def main():
    root = Path(__file__).parent / "units"
    made = 0
    for data in sorted(root.glob("*/data.js")):
        if data.parent.name.startswith("_"):
            continue
        words = re.findall(r'\bko:\s*"([^"]+)"', data.read_text(encoding="utf-8"))
        out = data.parent / "audio"
        out.mkdir(exist_ok=True)
        for w in words:
            f = out / f"{audio_name(w)}.mp3"
            if f.exists() and f.stat().st_size > 0:
                continue
            await edge_tts.Communicate(w, VOICE, rate=RATE).save(str(f))
            made += 1
            print(f"{data.parent.name}: {w}")
    print(f"Done. {made} new file(s).")

asyncio.run(main())
