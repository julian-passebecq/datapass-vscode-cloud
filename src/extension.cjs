const { catalog } = require('./catalog.js');
const { validateCatalog, parseMessage, buildContext, relevantFiles, scrub } = require('./core.js');
const { scanFolder, safeFile, probeVersion } = require('./host.cjs');
const crypto = require('node:crypto');

/** Dependency injection keeps the native adapter independently testable. Not a V2 bridge API. */
function createStudio(vscode, context, services = {}) {
  const errors = validateCatalog(catalog); if (errors.length) throw new Error(errors.join('; '));
  const scan = services.scan ?? scanFolder, file = services.safeFile ?? safeFile, probe = services.probe ?? probeVersion;
  let panel, root, revision = 0, requestedJourney, disposed = false, pending = Promise.resolve();
  let observations = {}, checks = {}, scanState = {files:[],scan:'not-scanned',notes:[]};
  let favorites = (context.globalState.get('favorites', []) || []).filter(id=>catalog.journeys.some(j=>j.id===id));
  let presentation = context.globalState.get('presentation', vscode.workspace.getConfiguration('cloudStudio').get('presentation', 'guided'));
  if (!['guided','compact'].includes(presentation)) presentation = 'guided';
  const subscriptions = [];
  const emitter = new vscode.EventEmitter();
  function snapshot() {
    return { catalog, observations, workspace:{...scanState,label:root ? scrub(root.name) : 'No working folder selected',trusted:vscode.workspace.isTrusted,remote:!!vscode.env.remoteName}, favorites, presentation, checks, requestedJourney, contextRevision:revision };
  }
  function tell(message) { return vscode.window.showInformationMessage(message); }
  function send() { if (!disposed && panel) void panel.webview.postMessage({type:'state',state:snapshot()}); emitter.fire(); }
  function requireTrust() { if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before launching native tools, checking CLIs or exporting project context. Guides remain available.'); }
  function selectDefault() { const f = vscode.workspace.workspaceFolders ?? []; if (!root && f.length === 1 && f[0].uri.scheme === 'file') root = f[0]; }
  async function refresh() {
    selectDefault(); revision++; checks = {}; const current = revision;
    const next = {};
    for (const t of catalog.tools) {
      if (t.extensionId) {
        const ext = vscode.extensions.getExtension(t.extensionId);
        next[t.id] = ext ? {state:'detected',version:String(ext.packageJSON.version ?? ''),detail:`Visible on this extension host; ${ext.isActive ? 'active' : 'not activated'}. Authentication and operation unverified.`,at:new Date().toISOString()}
          : {state:'not-detected',detail:'Not visible on this extension host. It may be disabled or installed on another host.'};
      } else next[t.id] = observations[t.id] ?? {state:'unknown',detail:t.cli ? 'Run the explicit local version check.' : 'No automatic probe. Follow the native tool instructions.'};
    }
    observations = next; scanState = {files:[],scan:'not-scanned',notes:[]}; send();
    if (root && root.uri.scheme === 'file' && !vscode.env.remoteName) {
      try { const data = await scan(root.uri.fsPath, current); if (current === revision && !disposed) scanState = data; }
      catch { if (current === revision) scanState = {files:[],scan:'unavailable',notes:['The selected folder could not be listed.']}; }
    } else if (vscode.env.remoteName) scanState = {files:[],scan:'unavailable',notes:['Remote hosts are not qualified in v0.1. Guides still work; use native tools for remote context.']};
    send();
  }
  async function chooseFolder() {
    const folders = (vscode.workspace.workspaceFolders ?? []).filter(f=>f.uri.scheme === 'file');
    if (!folders.length) { await tell('Open a local folder in VS Code first. Cloud Studio guides work without a folder.'); return; }
    const picked = await vscode.window.showQuickPick(folders.map(f=>({label:f.name,description:f.uri.fsPath,folder:f})), {title:'Cloud Studio - working folder',placeHolder:'Only this folder is scanned. No project files are written.'});
    if (picked) { root = picked.folder; await refresh(); }
  }
  async function openSource(id) {
    if (!root) throw new Error('Choose a working folder first.');
    const ref = scanState.files.find(f=>f.id===id); if (!ref) throw new Error('This file reference is stale. Refresh and select it again.');
    const full = await file(root.uri.fsPath,ref.path);
    // Text source only. Native notebook/custom editors remain a user choice (Reopen Editor With).
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(full));
    await vscode.window.showTextDocument(doc,{viewColumn:vscode.ViewColumn.Beside,preview:true});
  }
  async function pickFiles(j) {
    const files = relevantFiles(j,scanState.files);
    if (!files.length) { await tell('No matching source files were found in this scan. Choose or refresh the working folder; remote state is unknown.'); return; }
    const pick = await vscode.window.showQuickPick(files.map(f=>({label:f.path,description:f.kind,id:f.id})),{title:j.title,placeHolder:'Open native source beside the guide; never execute it'});
    if (pick) await openSource(pick.id);
  }
  async function openDocs(url) {
    const approved = await vscode.window.showInformationMessage('Open the source documentation in your browser?',{modal:true,detail:url},'Open documentation');
    if (approved === 'Open documentation') await vscode.env.openExternal(vscode.Uri.parse(url));
  }
  async function showExtension(t) {
    if (!t.extensionId) return openDocs(t.docs);
    // Native extensions UI: never installs or enables an extension automatically.
    await vscode.commands.executeCommand('workbench.extensions.search', `@id:${t.extensionId}`);
  }
  async function launchTool(t) {
    requireTrust();
    if (!t.extensionId) return openDocs(t.docs);
    const ext = vscode.extensions.getExtension(t.extensionId);
    if (!ext) return showExtension(t);
    const choice = await vscode.window.showInformationMessage(`Open ${t.name}'s native view?`,{modal:true,detail:'The extension may activate, contact its provider or prompt for sign-in. Cloud Studio does not verify your account or authorize cloud changes.'},'Open native tool');
    if (choice !== 'Open native tool') return;
    await ext.activate();
    // Read contributed container metadata; never invoke arbitrary provider action commands.
    const containers = ext.packageJSON.contributes?.viewsContainers;
    const views = [...(containers?.activitybar ?? []),...(containers?.panel ?? [])].filter(v=>typeof v.id === 'string' && /^[A-Za-z0-9._-]{1,120}$/.test(v.id));
    let view = views[0];
    if (views.length > 1) view = (await vscode.window.showQuickPick(views.map(v=>({label:String(v.title ?? v.id),view:v})),{title:`${t.name}: choose its native view`}))?.view;
    if (!view) { await showExtension(t); return; }
    const command = `workbench.view.extension.${view.id}`;
    if (!(await vscode.commands.getCommands(true)).includes(command)) { await tell('No supported native view command was found. Opening the extension page instead.'); await showExtension(t); return; }
    await vscode.commands.executeCommand(command);
  }
  async function previewContext(journeyId, routeId) {
    requireTrust();
    const j = catalog.journeys.find(x=>x.id===journeyId); if (!j) throw new Error('Select a journey first.');
    const baseRevision = revision;
    const text = buildContext(j,routeId,snapshot().workspace,observations,new Date().toISOString());
    const doc = await vscode.workspace.openTextDocument({language:'markdown',content:text});
    await vscode.window.showTextDocument(doc,{viewColumn:vscode.ViewColumn.Beside,preview:true});
    const answer = await vscode.window.showInformationMessage('Review the context before copying it to your AI.',{modal:true,detail:'Metadata only; filenames and tool versions can still be confidential. No source contents or credentials are included. Redaction is best-effort; inspect the entire preview.'},'Copy reviewed context');
    if (answer === 'Copy reviewed context') {
      if (revision !== baseRevision) throw new Error('Working context changed. Generate and review a fresh preview.');
      await vscode.env.clipboard.writeText(text); await tell('Reviewed context copied. Nothing was sent to an AI service.');
    }
  }
  async function checkTools() {
    requireTrust(); if (vscode.env.remoteName) throw new Error('Remote CLI probes are not qualified in v0.1.');
    const roots = (vscode.workspace.workspaceFolders ?? []).filter(f=>f.uri.scheme === 'file').map(f=>f.uri.fsPath);
    const selected = await vscode.window.showQuickPick(catalog.tools.filter(t=>t.cli).map(t=>({label:t.name,description:'Version only; no account or project execution',tool:t})), {title:'Check a local CLI version',canPickMany:true});
    if (!selected?.length) return;
    for (const {tool:t} of selected) { observations[t.id] = await probe(t.cli,vscode.workspace.isTrusted,roots); send(); }
  }
  async function handle(raw) {
    const m = parseMessage(raw,catalog); if (!m) throw new Error('Unrecognized Studio request.');
    switch(m.type) {
      case 'ready': send(); return;
      case 'refresh': return refresh();
      case 'chooseFolder': return chooseFolder();
      case 'checkTools': return checkTools();
      case 'mcpSettings': await vscode.commands.executeCommand('workbench.action.openSettings','@feature:mcp'); return;
      case 'favorite': favorites = favorites.includes(m.id) ? favorites.filter(x=>x!==m.id) : [...favorites,m.id]; await context.globalState.update('favorites',favorites); send(); return;
      case 'presentation': presentation = m.value; await context.globalState.update('presentation',presentation); send(); return;
      case 'file': return openSource(m.id);
      case 'context': return previewContext(m.journey,m.route);
      case 'check':
        if (m.revision !== revision) throw new Error('The working context changed. Refresh before recording a checklist note.');
        checks[`${m.journey}/${m.route}/${m.index}`]=m.checked; send(); return;
      case 'tool': {
        const t = catalog.tools.find(t=>t.id===m.id);
        if (m.action === 'docs') return openDocs(t.docs);
        if (m.action === 'extension') return showExtension(t);
        return launchTool(t);
      }
      case 'step': {
        const j=catalog.journeys.find(j=>j.id===m.journey), r=j.routes.find(r=>r.id===m.route), s=r.steps[m.index];
        if (s.action === 'files') return pickFiles(j);
        if (s.action === 'docs') return openDocs(j.docs);
        if (s.action === 'tool') return launchTool(catalog.tools.find(t=>t.id===s.toolId));
        if (s.action === 'mcp') return vscode.commands.executeCommand('workbench.action.openSettings','@feature:mcp');
        if (s.action === 'copy') { await vscode.env.clipboard.writeText(s.copy); await tell('Command copied only. Review it before running in your terminal.'); }
        return;
      }
    }
  }
  const guarded = fn => (...args) => Promise.resolve().then(()=>fn(...args)).catch(e=>{ void vscode.window.showErrorMessage(`Cloud Studio: ${e.message ?? 'operation failed'}`); });
  function html(webview) {
    const nonce=crypto.randomBytes(24).toString('hex');
    const media=vscode.Uri.joinPath(context.extensionUri,'media');
    const css=webview.asWebviewUri(vscode.Uri.joinPath(media,'studio.css'));
    const js=webview.asWebviewUri(vscode.Uri.joinPath(media,'studio.js'));
    return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"><title>Cloud Studio</title><link rel="stylesheet" href="${css}"></head><body><div id="app"><p class="loading">Opening Cloud Studio...</p></div><script nonce="${nonce}" src="${js}"></script></body></html>`;
  }
  function open(journeyId) {
    requestedJourney = catalog.journeys.some(j=>j.id===journeyId) ? journeyId : undefined;
    if (panel) { panel.reveal(vscode.ViewColumn.One); send(); return; }
    panel=vscode.window.createWebviewPanel('cloudStudio.studio','Cloud Studio',vscode.ViewColumn.One,{enableScripts:true,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media')]});
    panel.webview.html=html(panel.webview);
    panel.webview.onDidReceiveMessage(raw=>{pending=pending.then(()=>handle(raw)).catch(e=>{void vscode.window.showErrorMessage(`Cloud Studio: ${e.message}`);});},undefined,subscriptions);
    panel.onDidDispose(()=>{panel=undefined;},undefined,subscriptions);
    void guarded(refresh)();
  }
  const tree={
    onDidChangeTreeData:emitter.event,
    getChildren(node) { if (!node) return ['fabric','powerbi','azure'].map(id=>({kind:'studio',id})); return node.kind === 'studio' ? catalog.journeys.filter(j=>j.studio===node.id).map(j=>({kind:'journey',id:j.id})) : []; },
    getTreeItem(node) {
      if (node.kind === 'studio') { const item=new vscode.TreeItem({fabric:'Fabric',powerbi:'Power BI',azure:'Azure'}[node.id],vscode.TreeItemCollapsibleState.Expanded); item.iconPath=new vscode.ThemeIcon('cloud'); return item; }
      const j=catalog.journeys.find(j=>j.id===node.id), item=new vscode.TreeItem(j.title,vscode.TreeItemCollapsibleState.None); item.description=favorites.includes(j.id)?'Favorite':''; item.command={command:'cloudStudio.open',title:j.title,arguments:[j.id]}; item.iconPath=new vscode.ThemeIcon('compass'); return item;
    }
  };
  subscriptions.push(emitter, vscode.window.registerTreeDataProvider('cloudStudio.explorer',tree));
  for (const [id,fn] of Object.entries({open, refresh, chooseFolder, checkTools, context:async()=>{
    const active=vscode.window.activeTextEditor?.document?.uri;
    const owner=active && vscode.workspace.getWorkspaceFolder?.(active);
    if(owner?.uri.scheme==='file')root=owner;
    selectDefault();
    const picked=await vscode.window.showQuickPick(catalog.journeys.map(j=>({label:j.title,id:j.id})),{title:'Choose the goal for your AI context'});
    if (picked) { await refresh(); await previewContext(picked.id,'native'); }
  }})) subscriptions.push(vscode.commands.registerCommand(`cloudStudio.${id}`,guarded(fn)));
  subscriptions.push(vscode.extensions.onDidChange(()=>{if(panel) void guarded(refresh)();}),vscode.workspace.onDidChangeWorkspaceFolders(()=>{root=undefined; if(panel) void guarded(refresh)();}),vscode.workspace.onDidGrantWorkspaceTrust(()=>{if(panel) void guarded(refresh)();}));
  context.subscriptions.push({dispose(){disposed=true; panel?.dispose(); for(const s of subscriptions) s.dispose();}});
  return { snapshot, handle, open, refresh, chooseFolder };
}
exports.createStudio=createStudio;
exports.activate=context=>{
  const studio=createStudio(require('vscode'),context);
  // Read-only diagnostic seam; not a supported DataPass bridge contract.
  return {diagnostics:()=>{const s=studio.snapshot();return {version:'0.1.0',scan:s.workspace.scan,files:s.workspace.files.length};}};
};
exports.deactivate=()=>{};
