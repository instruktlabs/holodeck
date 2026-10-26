"""Verify extracted handoff files against the bundled SHA-256 manifest."""
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
m=json.loads((root/'HANDOFF-MANIFEST.json').read_text())
fail=[]
for entry in m['files']:
 p=(root/entry['path']).resolve()
 if not p.is_relative_to(root) or not p.is_file():fail.append(entry['path']+': missing or outside root');continue
 if hashlib.sha256(p.read_bytes()).hexdigest()!=entry['sha256']:fail.append(entry['path']+': hash mismatch')
print(f"Checked {len(m['files'])} files; {len(fail)} failures.")
for s in fail:print(s)
sys.exit(1 if fail else 0)
