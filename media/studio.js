/* Shared renderer: the VS Code webview and the browser test preview use the same file. */
(() => {
  'use strict';
  const api = acquireVsCodeApi();
  const app = document.getElementById('app');
  const stored = api.getState() || {};
  let state;
  const ui = { page: ['journeys','tools','mcp'].includes(stored.page) ? stored.page : 'journeys', studio: ['all','fabric','powerbi','azure'].includes(stored.studio) ? stored.studio : 'all', query: '', journey: typeof stored.journey === 'string' ? stored.journey : '', route: stored.route === 'ai' ? 'ai' : 'native', favoritesOnly:false };
  let lastRequest;
  const label = {fabric:'Fabric',powerbi:'Power BI',azure:'Azure',all:'All studios'};
  const glyph = {fabric:'F',powerbi:'P',azure:'A'};
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const send = m => api.postMessage(m);
  const btn = (text,attrs='',cls='button') => `<button class="${cls}" ${attrs}>${text}</button>`;
  const disabled = () => state.workspace.trusted ? '' : 'disabled title="Requires Workspace Trust"';
  function save() { api.setState({page:ui.page,studio:ui.studio,journey:ui.journey,route:ui.route}); }
  function observation(id) {
    const o=state.observations[id];
    return {text:o?.state==='detected' ? `Detected${o.version ? ` ${o.version}` : ''}` : o?.state==='not-detected' ? 'Not detected here' : o?.state==='failed' ? 'Check failed' : 'Not checked', detail:o?.detail ?? 'No automatic probe for this tool.'};
  }
  function toolCard(t,small=false) {
    const o=observation(t.id);
    return `<article class="tool-card ${small?'small':''}"><div class="row spread"><span class="eyebrow">${esc(t.kind.replace(/-/g,' '))}</span><span class="publisher">${esc(t.publisher)}</span></div><h3>${esc(t.name)}</h3><p>${esc(t.purpose)}</p><div class="tool-state" title="${esc(o.detail)}"><span class="neutral-dot"></span>${esc(o.text)}</div>${!small?`<dl><dt>Runs in</dt><dd>${esc(t.runsIn)}</dd><dt>Not for</dt><dd>${esc(t.notFor)}</dd><dt>Cost boundary</dt><dd>${esc(t.cost)}</dd></dl><p class="risk">${esc(t.effects.join(' '))}</p>`:''}<div class="row tool-actions">${btn('Documentation',`data-tool="${t.id}" data-action="docs"`,'button ghost')}${t.extensionId?btn('Extension page',`data-tool="${t.id}" data-action="extension"`,'button ghost'):''}${t.extensionId && state.observations[t.id]?.state==='detected'?btn('Open native tool',`data-tool="${t.id}" data-action="launch" ${disabled()}`,'button secondary'):''}</div><span class="micro">Source checked ${esc(t.checkedAt)} &middot; live access not verified</span></article>`;
  }
  function header() {
    return `<header class="topbar"><div class="brand"><span class="brand-mark">cs</span><div><strong>Cloud Studio</strong><span class="brand-sub">DATAPASS &nbsp;/&nbsp; INDEPENDENT EDITION</span></div></div><div class="row"><span class="pill">Local-first</span>${btn(state.presentation==='guided'?'Guided view':'Compact view','data-ui="presentation"','button ghost')}</div></header>`;
  }
  function nav() {
    return `<aside class="sidebar"><div class="nav-label">WORKSPACE</div><button class="folder-button" data-send="chooseFolder"><span class="folder-icon">/</span><span>${esc(state.workspace.label)}<small>Choose working folder</small></span></button><div class="nav-label">EXPLORE</div><nav aria-label="Studio navigation">${[['journeys','Journeys','Find your next step'],['tools','Toolbox','Know what each tool does'],['mcp','AI & MCP','Use the right client']].map(([id,title,sub])=>`<button data-page="${id}" class="nav-item ${ui.page===id?'active':''}" aria-current="${ui.page===id?'page':'false'}"><span>${title}</span><small>${sub}</small></button>`).join('')}</nav><div class="nav-label">YOUR STUDIOS</div>${['all','fabric','powerbi','azure'].map(s=>`<button class="studio-nav ${ui.studio===s?'selected':''}" data-studio="${s}" aria-pressed="${ui.studio===s}"><span class="studio-letter ${s}">${glyph[s]??'+'}</span><span>${label[s]}</span><small>${s==='all'?'6':'2'}</small></button>`).join('')}<div class="sidebar-bottom"><p>No bridge required.<br>No project files changed.</p>${btn('Refresh local context','data-send="refresh"','button ghost')}${btn('Check CLI versions','data-send="checkTools" '+disabled(),'button ghost')}</div></aside>`;
  }
  function contextRail() {
    const w=state.workspace;
    return `<aside class="context-rail" aria-label="Working context"><div class="eyebrow">ON THIS MACHINE</div><h3>Context, not assumptions</h3><dl><dt>Working folder</dt><dd>${esc(w.label)}</dd><dt>Source scan</dt><dd>${esc(w.scan.replace('-',' '))} &middot; ${w.files.length} relevant files</dd><dt>Workspace</dt><dd>${w.trusted?'Trusted':'Restricted Mode'}</dd><dt>Cloud target</dt><dd>Not verified</dd></dl>${w.scannedAt?`<p class="micro">Scanned ${esc(new Date(w.scannedAt).toLocaleTimeString())}</p>`:''}${w.notes.map(n=>`<p class="notice">${esc(n)}</p>`).join('')}<div class="rail-divider"></div><h4>What a badge means</h4><p class="muted">Detected means a tool is visible here, not connected, authorized or tested.</p><h4>Your native tools stay in charge</h4><p class="muted">Cloud Studio helps you choose and prepare. Editors, CLIs and agent hosts perform their own operations.</p><div class="rail-divider"></div><span class="eyebrow">V0.1 PREVIEW</span><p class="muted">Six focused journeys.<br>Fabric &middot; Power BI &middot; Azure</p></aside>`;
  }
  function searchbar() { return `<div class="searchbar"><label class="search-label"><span>Search</span><input id="search" type="search" placeholder="A task, file format or tool..." value="${esc(ui.query)}" maxlength="200"></label>${ui.page==='journeys'?btn(ui.favoritesOnly?'Favorites only':'Show favorites','data-ui="favorites"','button ghost'):''}<span class="pill">${label[ui.studio]}</span></div>`; }
  function home() {
    const q=ui.query.toLowerCase();
    const rows=state.catalog.journeys.filter(j=>(ui.studio==='all'||j.studio===ui.studio)&&(!ui.favoritesOnly||state.favorites.includes(j.id))&&`${j.title} ${j.description} ${j.artifact}`.toLowerCase().includes(q));
    return `<div class="hero"><div class="eyebrow">LESS TOOL HUNTING. MORE PROGRESS.</div><h1>What would you like to do?</h1><p>Choose a goal. Find the right native tool.<br>Know what to check before you act.</p></div><div class="studio-tiles">${['fabric','powerbi','azure'].map(s=>`<button class="studio-tile ${s} ${ui.studio===s?'chosen':''}" data-studio="${s}"><span class="studio-letter ${s}">${glyph[s]}</span><strong>${label[s]}</strong><small>${{fabric:'Workspaces & notebooks',powerbi:'Models & report definitions',azure:'Functions & Data Factory'}[s]}</small></button>`).join('')}</div>${searchbar()}<div class="section-title"><h2>${ui.favoritesOnly?'Saved journeys':'Start with a focused journey'}</h2><span class="micro">${rows.length} available</span></div><div class="journey-grid">${rows.map(j=>`<article class="journey-card"><div class="row spread"><span class="eyebrow">${label[j.studio]}</span><button data-favorite="${j.id}" class="star" aria-label="${state.favorites.includes(j.id)?'Remove':'Save'} ${esc(j.title)}" aria-pressed="${state.favorites.includes(j.id)}">${state.favorites.includes(j.id)?'&#9733;':'&#9734;'}</button></div><h3><button data-journey="${j.id}" class="title-link">${esc(j.title)}</button></h3><p>${esc(j.description)}</p><div class="row spread card-bottom"><span class="micro">${esc(j.artifact)} &middot; ${esc(j.minutes)}</span>${btn('Open journey &rarr;',`data-journey="${j.id}"`,'button ghost')}</div></article>`).join('')||'<div class="empty">No journeys match this filter. Try another studio or search.</div>'}</div>`;
  }
  function journey(j) {
    const r=j.routes.find(r=>r.id===ui.route)??j.routes[0]; ui.route=r.id;
    const files=state.workspace.files.filter(f=>j.matches.includes(f.kind));
    const done=j.checks.filter((_,i)=>state.checks[`${j.id}/${r.id}/${i}`]).length;
    return `<div class="row spread">${btn('&larr; All journeys','data-ui="back"','button ghost')}<span class="pill">${label[j.studio]} &middot; ${esc(j.artifact)}</span></div><div class="journey-header"><span class="eyebrow">A FOCUSED WORKFLOW</span><h1>${esc(j.title)}</h1><p>${esc(j.description)}</p></div><div class="outcome"><span class="eyebrow">EXPECTED RESULT</span><p>${esc(j.outcome)}</p></div><div class="route-tabs" aria-label="Working method">${j.routes.map(r=>btn(esc(r.label),`data-route="${r.id}" aria-pressed="${ui.route===r.id}"`,'button '+(ui.route===r.id?'primary':'secondary'))).join('')}${btn('Preview context for AI',`data-context="${j.id}" ${disabled()}`,'button ghost')}</div><p class="route-summary">${esc(r.summary)}</p><section class="steps" aria-label="Journey steps">${r.steps.map((s,i)=>`<article class="step"><span class="step-number">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p>${s.copy?`<code class="command">${esc(s.copy)}</code>`:''}${s.action?btn({files:'Open source file',tool:'Open native tool / guide',docs:'Read official guide',copy:'Copy command only',mcp:'Open VS Code MCP settings'}[s.action],`data-step="${i}" ${s.action==='tool'?disabled():''}`,'button secondary'):''}</div></article>`).join('')}</section><section class="source-section"><div class="section-title"><h2>Native source files</h2><span class="micro">Open beside this guide &middot; source text only</span></div>${files.length?`<div class="file-list">${files.slice(0,20).map(f=>`<button class="file-row" data-file="${f.id}"><span class="file-glyph">{ }</span><code>${esc(f.path)}</code><small>${esc(f.kind)}</small><span>&nearr;</span></button>`).join('')}</div>`:'<p class="empty">No matching local source in this scan. Choose a working folder or continue with the native remote tool.</p>'}${files.length>20?'<p class="micro">Showing the first 20 files; Open source file offers all scan matches.</p>':''}</section><section class="check-section"><div class="section-title"><h2>Your verification notes</h2><span class="pill">${done}/${j.checks.length} marked</span></div><p class="micro">Self-reported for this working context. Not executed tests; cleared when context is refreshed.</p>${j.checks.map((c,i)=>`<label class="check-row"><input type="checkbox" data-check="${i}" ${state.checks[`${j.id}/${r.id}/${i}`]?'checked':''}><span>${esc(c)}</span></label>`).join('')}</section><section class="boundaries"><h3>Before you act</h3>${j.boundaries.map(b=>`<p>${esc(b)}</p>`).join('')}</section>${state.presentation==='guided'?`<h2 class="tools-heading">Tools for this method</h2><div class="tool-grid">${r.tools.map(id=>toolCard(state.catalog.tools.find(t=>t.id===id),true)).join('')}</div>`:''}`;
  }
  function tools() {
    const q=ui.query.toLowerCase();
    const rows=state.catalog.tools.filter(t=>(ui.studio==='all'||t.studios.includes(ui.studio))&&`${t.name} ${t.kind} ${t.purpose}`.toLowerCase().includes(q));
    return `<div class="hero"><span class="eyebrow">A CURATED TOOLBOX, NOT AN INSTALL PACK</span><h1>Know what each tool does.</h1><p>Extensions, libraries, agents and services have different jobs.<br>Choose only what your workflow needs.</p></div>${searchbar()}<div class="section-title"><h2>${rows.length} tools and references</h2><span class="micro">Catalogued does not mean installed</span></div><div class="tool-grid">${rows.map(t=>toolCard(t)).join('')}</div>`;
  }
  function mcp() {
    return `<div class="hero"><span class="eyebrow">OPTIONAL. HOST-SPECIFIC. DELIBERATE.</span><h1>AI is a method, not a requirement.</h1><p>Start from a native workflow. Add an agent when it helps.</p></div><div class="flow"><span>You choose a goal</span><b>&rarr;</b><span>Your agent host</span><b>&rarr;</b><span>MCP tool</span><b>&rarr;</b><span>Local or cloud target</span></div><div class="info-grid"><article class="tool-card"><h2>One server, different clients</h2><p>Copilot in VS Code, Claude and Codex keep their own configuration and permissions. A server configured in one is not automatically connected in another.</p>${btn('Open VS Code MCP settings','data-send="mcpSettings"','button secondary')}<p class="micro">For the VS Code host. This does not configure Claude or Codex.</p></article><article class="tool-card"><h2>Local does not mean private</h2><p>An MCP server can run locally while tool results are sent to the selected model provider. Review the client, account, data policy and tool permissions.</p><p class="risk">Cloud Studio does not start MCP servers, read credentials or send prompts. Context is reviewed and copied explicitly.</p></article></div><h2 class="tools-heading">Different tools, different scopes</h2><div class="tool-grid">${state.catalog.tools.filter(t=>t.kind==='mcp'||t.kind==='agent-plugin'||t.id==='ext.powerbi-modeling-mcp').map(t=>toolCard(t)).join('')}</div>`;
  }
  function render() {
    if(!state) return;
    const focus=document.activeElement?.id, selection=focus==='search'?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:undefined;
    const j=state.catalog.journeys.find(j=>j.id===ui.journey);
    app.innerHTML=`${header()}${!state.workspace.trusted?'<div class="trust-banner">Restricted Mode: guides remain available. Native-tool launch, CLI checks and context export require trust.</div>':''}<div class="shell">${nav()}<main id="main" class="main ${state.presentation==='compact'?'compact':''}">${ui.page==='journeys'?(j?journey(j):home()):ui.page==='tools'?tools():mcp()}</main>${contextRail()}</div><footer>DataPass Cloud Studio &middot; 0.1 preview <span>No cloud operations or installs are performed automatically.</span></footer>`;
    if(focus==='search') { const el=document.getElementById('search'); el?.focus(); if(selection&&el?.type==='text') el.setSelectionRange(...selection); }
    save();
  }
  app.addEventListener('input',e=>{if(e.target.id==='search'){ui.query=e.target.value;render();}});
  app.addEventListener('change',e=>{const c=e.target.dataset.check;if(c!==undefined)send({type:'check',journey:ui.journey,route:ui.route,index:Number(c),checked:e.target.checked,revision:state.contextRevision});});
  app.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled)return;const d=b.dataset;
    if(d.send)send({type:d.send});
    else if(d.page){ui.page=d.page;ui.journey='';ui.query='';render();}
    else if(d.studio){ui.studio=d.studio;ui.journey='';render();}
    else if(d.journey){ui.journey=d.journey;ui.page='journeys';ui.route='native';render();document.getElementById('main').scrollTop=0;}
    else if(d.route){ui.route=d.route;render();}
    else if(d.favorite)send({type:'favorite',id:d.favorite});
    else if(d.tool)send({type:'tool',id:d.tool,action:d.action});
    else if(d.file)send({type:'file',id:d.file});
    else if(d.context)send({type:'context',journey:d.context,route:ui.route});
    else if(d.step!==undefined)send({type:'step',journey:ui.journey,route:ui.route,index:Number(d.step)});
    else if(d.ui==='back'){ui.journey='';render();}
    else if(d.ui==='favorites'){ui.favoritesOnly=!ui.favoritesOnly;render();}
    else if(d.ui==='presentation')send({type:'presentation',value:state.presentation==='guided'?'compact':'guided'});
  });
  window.addEventListener('message',event=>{
    if(event.data?.type!=='state'||!event.data.state)return;
    state=event.data.state;
    if(state.requestedJourney&&state.requestedJourney!==lastRequest){ui.journey=state.requestedJourney;ui.page='journeys';ui.route='native';lastRequest=state.requestedJourney;}
    render();
  });
  send({type:'ready'});
})();
