"""Deterministic VSIX/OPC packager using only Python's standard library.
Native VS Code installation is tested separately in CI; packaging is not runtime proof.
"""
import hashlib
import json
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
ROOT = Path(__file__).resolve().parents[1]
p = json.loads((ROOT / 'package.json').read_text())
out = ROOT / 'artifacts'
out.mkdir(exist_ok=True)
archive = out / f"{p['name']}-{p['version']}.vsix"
manifest = f'''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
<Metadata><Identity Language="en-US" Id="{escape(p['name'])}" Version="{escape(p['version'])}" Publisher="{escape(p['publisher'])}"/><DisplayName>{escape(p['displayName'])}</DisplayName><Description xml:space="preserve">{escape(p['description'])}</Description><Tags>Fabric,Power BI,Azure,MCP</Tags><Categories>Data Science,Other</Categories><GalleryFlags>Public</GalleryFlags><Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="{escape(p['engines']['vscode'])}"/><Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/><Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/><Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace"/><Property Id="Microsoft.VisualStudio.Code.EnabledApiProposals" Value=""/></Properties></Metadata>
<Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Dependencies/>
<Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/><Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/><Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true"/></Assets></PackageManifest>'''
content_types = '''<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="application/json"/><Default Extension="js" ContentType="application/javascript"/><Default Extension="cjs" ContentType="application/javascript"/><Default Extension="css" ContentType="text/css"/><Default Extension="svg" ContentType="image/svg+xml"/><Default Extension="md" ContentType="text/markdown"/><Default Extension="vsixmanifest" ContentType="text/xml"/></Types>'''
files = {'extension.vsixmanifest':manifest.encode(), '[Content_Types].xml':content_types.encode()}
for rel in ['package.json','README.md','CHANGELOG.md','LICENSE']:
    files['extension/'+rel] = (ROOT/rel).read_bytes()
for folder in ['dist','media','docs']:
    for f in sorted((ROOT/folder).rglob('*')):
        if f.is_file() and f.suffix not in ['.map','.ts']:
            files['extension/'+f.relative_to(ROOT).as_posix()] = f.read_bytes()
with ZipFile(archive,'w',compression=ZIP_DEFLATED,compresslevel=9) as z:
    for name,data in sorted(files.items()):
        info=ZipInfo(name,(2026,9,26,0,0,0));info.compress_type=ZIP_DEFLATED;info.external_attr=0o644 << 16
        z.writestr(info,data)
with ZipFile(archive) as z:
    assert z.testzip() is None
    assert 'extension/dist/extension.cjs' in z.namelist()
    assert not any('node_modules/' in name for name in z.namelist())
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
(archive.with_suffix('.vsix.sha256')).write_text(f'{digest}  {archive.name}\n')
print(f'{archive.name}: {archive.stat().st_size} bytes; {len(files)} files; SHA-256 {digest}')
