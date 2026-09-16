from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
idx=(ROOT/"site/index.html").read_text("utf-8")
sw=(ROOT/"site/sw.js").read_text("utf-8")
m=json.loads((ROOT/"site/manifest.webmanifest").read_text("utf-8"))
need=[
"favicon-v1761.ico",
"nangrong-favicon-16-v1761.png",
"nangrong-favicon-32-v1761.png",
"nangrong-favicon-48-v1761.png",
"nangrong-app-180-v1761.png",
"nangrong-app-192-v1761.png",
"nangrong-app-512-v1761.png",
"nangrong-maskable-512-v1761.png",
]
errors=[]
def ok(c,m):
    if not c: errors.append(m)
ok("v17-6-1-icon-refresh-production" in idx,"release marker")
for n in need:
    p=(ROOT/"site"/n) if n.endswith(".ico") else (ROOT/"site/icons"/n)
    ok(p.exists() and p.stat().st_size>200,f"missing {n}")
ok("favicon-v1761.ico" in idx,"desktop favicon link")
ok("nangrong-app-180-v1761.png" in idx,"apple touch icon")
for n in ["nangrong-app-192-v1761.png","nangrong-app-512-v1761.png","nangrong-maskable-512-v1761.png"]:
    ok(any(str(x.get("src","")).endswith(n) for x in m["icons"]),f"manifest {n}")
ok("doc-full-nr-v17-6-1-icon-refresh-20260915" in sw,"new SW cache")
ok("nangrong-app-192-v1761.png" in sw,"new icons cached")
if errors:
    print("V17.6.1 ICON CONTRACT FAILED")
    [print("-",x) for x in errors]
    raise SystemExit(1)
print("V17.6.1 ICON CONTRACT PASS")
