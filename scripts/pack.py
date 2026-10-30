#!/usr/bin/env python3
import sys
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
folder=Path(sys.argv[1]);dest=Path(sys.argv[2]);dest.parent.mkdir(exist_ok=True,parents=True)
with ZipFile(dest,'w',ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(folder.rglob('*')):
  if p.is_file(): z.write(p,p.relative_to(folder).as_posix())
with ZipFile(dest) as z:
 assert z.testzip() is None
 print(f'Install ZIP ready: {dest} ({len(z.namelist())} files)')
