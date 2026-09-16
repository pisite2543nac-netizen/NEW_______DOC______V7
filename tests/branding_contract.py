from pathlib import Path
import base64, json, re, sys
root=Path(__file__).resolve().parents[1]
index=(root/"site/index.html").read_text(encoding="utf-8")
app=(root/"site/app.js").read_text(encoding="utf-8")
platform=(root/"site/v16-platform.js").read_text(encoding="utf-8")
sw=(root/"site/sw.js").read_text(encoding="utf-8")
manifest=json.loads((root/"site/manifest.webmanifest").read_text(encoding="utf-8"))
assert "v17-2-college-branding" in index
assert "ตราวิทยาลัยเทคนิคนางรอง" in app
assert "v172-dashboard-seal" in platform
assert "doc-full-nr-v17-2-college-branding" in sw
for f in ["icon-48.png","icon-180.png","icon-192.png","icon-512.png","icon-maskable-512.png"]:
    raw=(root/"site/icons"/f).read_bytes()
    assert raw.startswith(b"\x89PNG\r\n\x1a\n"), f
    b64=base64.b64decode((root/"site/icons"/(f+".b64")).read_text().strip())
    assert raw==b64, f+" b64 mismatch"
assert any(i["src"].endswith("icon-maskable-512.png") and "maskable" in i.get("purpose","") for i in manifest["icons"])
print("V17.2 BRANDING CONTRACT PASS")
