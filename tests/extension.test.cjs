const test=require('node:test');const assert=require('node:assert/strict');
const {createStudio}=require('../dist/extension.cjs');
function mock(trusted=true){
 const calls=[],commands=new Map(),store=new Map();const noop=()=>({dispose(){}});
 class EventEmitter{event=noop;fire(){}dispose(){}}
 const uri=s=>({scheme:'file',fsPath:s,toString:()=>s});
 const v={EventEmitter,Uri:{file:uri,parse:uri,joinPath:(u,...s)=>uri(u.fsPath+'/'+s.join('/'))},ViewColumn:{One:1,Beside:2},TreeItem:class{constructor(label){this.label=label;}},ThemeIcon:class{},TreeItemCollapsibleState:{Expanded:2,None:0},
 workspace:{isTrusted:trusted,workspaceFolders:[{name:'sample',uri:uri('/sample')}],getConfiguration:()=>({get:(_k,d)=>d}),onDidChangeWorkspaceFolders:noop,onDidGrantWorkspaceTrust:noop,openTextDocument:async o=>{calls.push(['document',o]);return o;}},
 env:{remoteName:undefined,clipboard:{writeText:async s=>calls.push(['clipboard',s])},openExternal:async u=>calls.push(['external',u])},
 extensions:{getExtension:()=>undefined,onDidChange:noop},
 commands:{registerCommand:(id,f)=>{commands.set(id,f);return noop();},executeCommand:async(...a)=>calls.push(['command',...a]),getCommands:async()=>[]},
 window:{registerTreeDataProvider:noop,showInformationMessage:async(...a)=>{calls.push(['confirm',...a]);return undefined;},showErrorMessage:async m=>calls.push(['error',m]),showQuickPick:async()=>undefined,showTextDocument:async d=>calls.push(['show',d]),createWebviewPanel:()=>({webview:{cspSource:'local:',asWebviewUri:u=>u.toString(),postMessage:async m=>calls.push(['state',m]),onDidReceiveMessage:noop},reveal(){},onDidDispose:noop,dispose(){}})}};
 const ctx={globalState:{get:(_k,d)=>d,update:async(k,val)=>store.set(k,val)},subscriptions:[],extensionUri:uri('/extension')};
 return {v,ctx,calls,commands,store};
}
const scan=async()=>({files:[{id:'f1-0',path:'host.json',kind:'function'}],scan:'complete',notes:[]});
test('activation needs no DataPass, performs no scan, CLI, file write or network',()=>{
 const m=mock();let scans=0;createStudio(m.v,m.ctx,{scan:()=>{scans++;}});assert.equal(scans,0);assert.equal(m.calls.length,0);assert.equal(m.commands.size,5);
});
test('refresh observes metadata but never invokes CLI tools',async()=>{
 const m=mock();let probes=0;const s=createStudio(m.v,m.ctx,{scan,probe:()=>{probes++;}});await s.refresh();assert.equal(probes,0);assert.equal(s.snapshot().workspace.files.length,1);assert.equal(s.snapshot().observations['cli.az'].state,'unknown');
});
test('context preview does not copy without explicit confirmation',async()=>{
 const m=mock();const s=createStudio(m.v,m.ctx,{scan});await s.refresh();await s.handle({type:'context',journey:'azure.function',route:'native'});assert.ok(m.calls.some(c=>c[0]==='document'));assert.ok(!m.calls.some(c=>c[0]==='clipboard'));assert.ok(!m.calls.some(c=>c[0]==='external'));
});
test('context clipboard copy needs approval and stays metadata-only',async()=>{
 const m=mock();m.v.window.showInformationMessage=async()=> 'Copy reviewed context';const s=createStudio(m.v,m.ctx,{scan});await s.refresh();await s.handle({type:'context',journey:'azure.function',route:'native'});const value=m.calls.find(c=>c[0]==='clipboard')[1];assert.match(value,/host.json/);assert.doesNotMatch(value,/\/sample/);assert.match(value,/No source code/);
});
test('direct command requests cannot bypass Workspace Trust',async()=>{
 const m=mock(false);const s=createStudio(m.v,m.ctx,{scan});for(const req of [{type:'checkTools'},{type:'context',journey:'azure.function',route:'native'},{type:'tool',id:'ext.fabric',action:'launch'}])await assert.rejects(s.handle(req),/Trust this workspace/);assert.equal(m.calls.length,0);
});
test('documentation navigation asks before opening a browser',async()=>{
 const m=mock();const s=createStudio(m.v,m.ctx,{scan});await s.handle({type:'tool',id:'ext.fabric',action:'docs'});assert.equal(m.calls[0][0],'confirm');assert.ok(!m.calls.some(c=>c[0]==='external'));
});
test('malicious or stale webview requests cannot open arbitrary paths or URLs',async()=>{
 const m=mock();const s=createStudio(m.v,m.ctx,{scan});await s.refresh();for(const req of [{type:'file',id:'file:///secret'},{type:'tool',id:'ext.fabric',action:'docs',url:'https://evil.test'},{type:'step',journey:'azure.function',route:'native',index:200}])await assert.rejects(s.handle(req),/Unrecognized/);await assert.rejects(s.handle({type:'file',id:'f0-0'}),/stale/);
});
test('favorites are local preference IDs only',async()=>{const m=mock();const s=createStudio(m.v,m.ctx,{scan});await s.handle({type:'favorite',id:'azure.adf'});assert.deepEqual(m.store.get('favorites'),['azure.adf']);await s.handle({type:'favorite',id:'azure.adf'});assert.deepEqual(m.store.get('favorites'),[]);});
test('checklist notes are scoped and invalidated on context refresh',async()=>{
 const m=mock();const s=createStudio(m.v,m.ctx,{scan});await s.refresh();await s.handle({type:'check',journey:'azure.adf',route:'native',index:0,checked:true,revision:1});assert.equal(Object.keys(s.snapshot().checks).length,1);await s.refresh();assert.equal(Object.keys(s.snapshot().checks).length,0);await assert.rejects(s.handle({type:'check',journey:'azure.adf',route:'native',index:0,checked:true,revision:1}),/context changed/);
});
test('compact mode does not change trust or project files',async()=>{const m=mock(false);const s=createStudio(m.v,m.ctx);await s.handle({type:'presentation',value:'compact'});assert.equal(s.snapshot().presentation,'compact');assert.equal(s.snapshot().workspace.trusted,false);assert.deepEqual([...m.store.keys()],['presentation']);});
