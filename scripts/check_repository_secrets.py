"""Scan tracked text for credential literals; never display secret values."""
import pathlib,re,subprocess,sys
paths=subprocess.check_output(['git','ls-files','-z']).decode().split('\0')
patterns=[
 re.compile(r'sk-[A-Za-z0-9_-]{16,}'),
 re.compile(r'gh[pousr]_[A-Za-z0-9]{20,}'),
 re.compile(r'(?:mysql|mongodb|bolt|neo4j)(?:\+[a-z]+)?://[^\s:@{}]+:(?!\$|<|REMOVED_SECRET)[^\s@{}]+@'),
 re.compile(r'-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----'),
]
bad=[]
for name in paths:
 if not name:continue
 p=pathlib.Path(name)
 if p.name=='.env' or (p.name.startswith('.env.') and p.suffix not in ('.example','.sample','.template')):
  bad.append((name,0));continue
 try:
  raw=p.read_bytes()
  if b'\0' in raw:continue
  text=raw.decode('utf-8')
 except (OSError,UnicodeError):continue
 for n,line in enumerate(text.splitlines(),1):
  if any(x.search(line) for x in patterns):bad.append((name,n))
for name,n in bad:print(f'{name}:{n}: potential credential; remove locally and rotate at provider')
print(f'Credential check: {len(bad)} finding(s)')
sys.exit(bool(bad))
