"""Real Chromium renderer tests; mocked VS Code bridge, no native-provider claims."""
import json
import os
import shutil
import subprocess
import time
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)
catalog = json.loads(subprocess.check_output(['node','-e',"console.log(JSON.stringify(require('./dist/catalog.js').catalog))"],cwd=ROOT))
checks=[]
try:
    with sync_playwright() as p:
        executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
        browser=p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1450,'height':1030},device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.set_content('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div></body></html>')
        page.add_style_tag(content=(ROOT/'media/studio.css').read_text())
        fixture = {'catalog':catalog,'observations':{'ext.fabric':{'state':'detected','version':'sample','detail':'Preview fixture only.'}},'workspace':{'label':'sample-cloud-project (preview)','files':[{'id':'f1-0','path':'functions/host.json','kind':'function'},{'id':'f1-1','path':'model/tables/Sales.tmdl','kind':'model'},{'id':'f1-2','path':'notebooks/ingest.ipynb','kind':'notebook'}],'scan':'complete','notes':['Browser preview: observations are simulated.'],'trusted':True,'remote':False},'favorites':[],'presentation':'guided','checks':{},'contextRevision':1}
        page.evaluate("""s => {window.previewMessages=[]; window.previewState=()=>s; window.acquireVsCodeApi=()=>({getState:()=>null,setState:()=>{},postMessage:m=>{previewMessages.push(m);if(m.type==='presentation')s.presentation=m.value;if(m.type==='favorite')s.favorites=s.favorites.includes(m.id)?s.favorites.filter(x=>x!==m.id):[...s.favorites,m.id];if(m.type==='check')s.checks[m.journey+'/'+m.route+'/'+m.index]=m.checked;window.postMessage({type:'state',state:s},'*');}});}""",fixture)
        page.add_script_tag(content=(ROOT/'media/studio.js').read_text())
        page.get_by_role('heading',name='What would you like to do?').wait_for()
        assert page.locator('.journey-card').count()==6
        checks.append('Six journeys across three studios')
        page.screenshot(path=str(OUT/'cloud-studio-home.png'),full_page=True)
        page.locator('.studio-tile.azure').click()
        assert page.locator('.journey-card').count()==2
        page.locator('#search').fill('Data Factory')
        assert page.locator('.journey-card').count()==1
        checks.append('Studio and text filters')
        page.locator('[data-studio="all"]').first.click()
        page.locator('#search').fill('')
        page.locator('[data-favorite="azure.function"]').click()
        page.locator('[data-ui="favorites"]').click()
        assert page.locator('.journey-card').count()==1
        checks.append('Favorite view uses host-confirmed state')
        page.locator('[data-journey="azure.function"]').first.click()
        assert page.locator('.step').count()==4
        page.locator('[data-file="f1-0"]').click()
        assert page.evaluate('previewMessages.some(x=>x.type==="file"&&x.id==="f1-0")')
        checks.append('Native file action sends only a host token')
        page.locator('[data-step="1"]').click()
        assert page.evaluate('previewMessages.some(x=>x.type==="step"&&x.index===1)')
        page.locator('[data-check="0"]').check()
        expect(page.get_by_text('1/4 marked')).to_have_count(1)
        checks.append('Copy action and self-reported checklist routing')
        page.locator('[data-context="azure.function"]').click()
        assert page.evaluate('previewMessages.some(x=>x.type==="context"&&x.journey==="azure.function")')
        checks.append('AI context request is explicit')
        page.screenshot(path=str(OUT/'cloud-studio-journey.png'),full_page=True)
        page.locator('[data-page="tools"]').click()
        assert page.locator('.tool-card').count()==25
        page.locator('#search').fill('MCP')
        assert page.locator('.tool-card').count()>=2
        checks.append('Searchable tool knowledge')
        page.locator('[data-page="mcp"]').click()
        assert page.get_by_role('heading',name='AI is a method, not a requirement.').count()==1
        checks.append('MCP host boundaries explained')
        page.locator('[data-ui="presentation"]').click()
        expect(page.locator('.main.compact')).to_have_count(1)
        checks.append('Compact presentation')
        page.evaluate("() => {const s=previewState();s.workspace.trusted=false;window.postMessage({type:'state',state:s},'*');}")
        page.locator('.trust-banner').wait_for()
        assert page.locator('[data-send="checkTools"]').is_disabled()
        checks.append('Restricted Mode clearly disables sensitive actions')
        page.evaluate("() => {const s=previewState();s.workspace.label='<img src=x onerror=alert(1)>';window.postMessage({type:'state',state:s},'*');}")
        assert page.locator('.folder-button img').count()==0
        checks.append('Host label is escaped, not executed')
        for width in [390,760,1180,1450]:
            page.set_viewport_size({'width':width,'height':1000})
            assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'), f'Overflow at {width}'
        checks.append('No horizontal overflow at 390/760/1180/1450 px')
        page.evaluate("document.body.classList.add('vscode-high-contrast');document.documentElement.style.setProperty('--vscode-editor-background','#fff');document.documentElement.style.setProperty('--vscode-foreground','#111');document.documentElement.style.setProperty('--vscode-descriptionForeground','#444');document.documentElement.style.setProperty('--vscode-sideBar-background','#f5f5f5');document.documentElement.style.setProperty('--vscode-editorWidget-background','#fff');document.documentElement.style.setProperty('--vscode-widget-border','#aaa')")
        page.screenshot(path=str(OUT/'cloud-studio-light.png'),full_page=True)
        page.keyboard.press('Tab')
        assert page.evaluate('document.activeElement.tagName') in ['BUTTON','INPUT']
        checks.append('Keyboard navigation and light/high-contrast theme render')
        assert not errors,errors
        checks.append('No uncaught browser errors')
        browser.close()
    (OUT/'browser-results.json').write_text(json.dumps({'kind':'browser-renderer-with-simulated-host','passed':len(checks),'checks':checks},indent=2)+'\n')
    print(f'{len(checks)} browser checks passed. VS Code host and provider accounts are separate qualification.')
finally:
    pass
