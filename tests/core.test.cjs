const test=require('node:test'); const assert=require('node:assert/strict');
const {catalog}=require('../dist/catalog.js'); const c=require('../dist/core.js');
test('catalog has three independent studios, six usable non-AI journeys',()=>{
  assert.deepEqual(c.validateCatalog(catalog),[]); assert.equal(catalog.journeys.length,6);
  for(const studio of ['fabric','powerbi','azure'])assert.equal(catalog.journeys.filter(j=>j.studio===studio).length,2);
  for(const j of catalog.journeys)assert.ok(j.routes.some(r=>r.id==='native'));
});
test('catalog rejects duplicate IDs, unknown tools, unsafe sources and malformed copy steps',()=>{
  const bad=structuredClone(catalog); bad.tools.push(bad.tools[0]);bad.tools[1].docs='javascript:alert(1)';bad.journeys[0].routes[0].tools.push('not-real');bad.journeys[0].routes[0].steps.push({title:'x',body:'x',action:'copy',copy:'a\nb'});
  const result=c.validateCatalog(bad).join(';');for(const pattern of ['duplicate tool','Unsafe docs','Unknown tool','Invalid copied'])assert.match(result,new RegExp(pattern));
});
for(const [file,kind] of [['a.ipynb','notebook'],['x/.platform','fabric-item'],['r.pbip','pbip'],['model/x.tmdl','model'],['x/definition.pbir','report'],['host.json','function'],['x/function.json','function'],['pipeline/a.json','adf'],['linkedService/a.json','adf'],['main.tf','infra'],['src/a.py','code']])test(`classifies native ${file}`,()=>assert.equal(c.classifyFile(file),kind));
for(const file of ['.env','.env.local','local.settings.json','node_modules/x/a.py','.git/f.py','.datapass/x.py','secrets/private.pem','.claude/a.py','.venv/a.py','README.md'])test(`excludes ${file}`,()=>assert.equal(c.classifyFile(file),undefined));
test('metadata export is bounded, scrubs paths and tokens, contains no implicit permission',()=>{
 const w={label:'C:\\Users\\julian\\secret ghp_123456789101112',files:Array.from({length:100},(_,i)=>({id:`f1-${i}`,kind:'model',path:`table${i}.tmdl`})),scan:'partial',notes:[],trusted:true,remote:false};
 const text=c.buildContext(catalog.journeys[3],'ai',w,{},'2026-09-26');assert.doesNotMatch(text,/C:\\Users|ghp_/);assert.match(text,/No source code/);assert.equal((text.match(/\(model\)/g)||[]).length,40);assert.match(text,/Do not deploy/);assert.match(text,/unverified/);
});
test('unknown and failed observations never become detected/verified',()=>{
 assert.equal(c.observationLabel(),'Not checked');assert.equal(c.observationLabel({state:'failed'}),'Check failed');assert.equal(c.observationLabel({state:'not-detected'}),'Not detected here');
});
test('message boundary rejects arbitrary URLs, commands and stale-shaped paths',()=>{
 for(const m of [{type:'exec',command:'rm -rf /'},{type:'tool',id:'ext.fabric',action:'launch',url:'https://evil.test'},{type:'file',id:'../../.env'},{type:'step',journey:'fabric.open-item',route:'native',index:999},{type:'context',journey:'no',route:'native'},{type:'favorite',id:'no'},{type:'refresh',extra:'x'}])assert.equal(c.parseMessage(m,catalog),undefined);
});
test('valid messages carry only IDs and bounded indices',()=>{
 for(const m of [{type:'ready'},{type:'file',id:'f2-1'},{type:'presentation',value:'compact'},{type:'tool',id:'ext.fabric',action:'docs'},{type:'step',journey:'fabric.open-item',route:'native',index:1},{type:'check',journey:'fabric.open-item',route:'native',index:0,checked:true,revision:3}])assert.deepEqual(c.parseMessage(m,catalog),m);
});
test('sources are HTTPS allowlisted and reject embedded credentials',()=>{
 assert.ok(c.safeDocsUrl('https://github.com/microsoft/vscode-fabric'));for(const url of ['http://github.com/x','https://github.com.evil.test/x','https://token@github.com/x','file:///x','https://evil.test'])assert.equal(c.safeDocsUrl(url),false);
});
