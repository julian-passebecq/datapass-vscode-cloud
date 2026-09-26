const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const h=require('../dist/host.cjs');
async function temp(t){const p=await fs.mkdtemp(path.join(os.tmpdir(),'cloud-studio-'));t.after(()=>fs.rm(p,{recursive:true,force:true}));return p;}
test('scan finds files without opening source contents, and excludes private/config trees',async t=>{
 const root=await temp(t);await fs.mkdir(path.join(root,'pipeline'));await fs.mkdir(path.join(root,'.datapass'));for(const file of ['host.json','function_app.py','pipeline/a.json','.env','local.settings.json','.datapass/private.py'])await fs.writeFile(path.join(root,file),'not valid code or JSON');
 const out=await h.scanFolder(root,7);assert.deepEqual(out.files.map(f=>f.path),['function_app.py','host.json','pipeline/a.json']);assert.equal(out.scan,'complete');assert.match(out.files[0].id,/^f7-/);
});
test('file and depth limits report partial rather than complete',async t=>{
 const root=await temp(t);for(let i=0;i<5;i++)await fs.writeFile(path.join(root,`f${i}.py`),'');const out=await h.scanFolder(root,1,{maxFiles:2});assert.equal(out.files.length,2);assert.equal(out.scan,'partial');
});
test('unreadable root fails instead of inventing an empty verified project',async()=>{await assert.rejects(h.scanFolder('/does-not-exist-cloud-studio',1));});
test('safeFile confines opens and rejects traversal or symbolic links',async t=>{
 const root=await temp(t);await fs.writeFile(path.join(root,'a.py'),'x');assert.equal(await h.safeFile(root,'a.py'),await fs.realpath(path.join(root,'a.py')));await assert.rejects(h.safeFile(root,'../a.py'));
 if(process.platform!=='win32'){await fs.symlink(path.join(root,'a.py'),path.join(root,'link.py'));await assert.rejects(h.safeFile(root,'link.py'));const out=await h.scanFolder(root,1);assert.equal(out.scan,'partial');assert.equal(out.files.length,1);}
});
test('parent link swap after scan cannot open an outside file',{skip:process.platform==='win32' ? 'Symlink creation needs separate Windows qualification' : false},async t=>{
 const root=await temp(t),outside=await temp(t);await fs.writeFile(path.join(outside,'a.py'),'secret');await fs.symlink(outside,path.join(root,'child'));await assert.rejects(h.safeFile(root,'child/a.py'));
});
test('large source files require native manual open',async t=>{const root=await temp(t);await fs.writeFile(path.join(root,'large.py'),Buffer.alloc(2*1024*1024+1));await assert.rejects(h.safeFile(root,'large.py'),/2 MiB/);});
test('PATH entries must be absolute, cross-platform',()=>{assert.deepEqual(h.absoluteEntries(':/usr/bin:.:relative:/bin','linux'),['/usr/bin','/bin']);assert.deepEqual(h.absoluteEntries(';.;relative;C:\\Tools;"C:\\Program Files\\Tool";\\Windows','win32'),['C:\\Tools','C:\\Program Files\\Tool']);});
test('probe never resolves or runs a program in Restricted Mode',async()=>{
 let called=false;const o=await h.probeVersion('node',false,[],{resolve:()=>{called=true;}});assert.equal(called,false);assert.equal(o.state,'unknown');
});
test('probe executes only a fixed version command with no shell and exports only version',async()=>{
 let options;const o=await h.probeVersion('node',true,[],{resolve:async()=>({executable:'/usr/bin/node',args:['--version']}),run:(exe,args,opts,cb)=>{assert.equal(exe,'/usr/bin/node');assert.deepEqual(args,['--version']);options=opts;cb(null,'v22.16.0\npassword=PRIVATE','');}});assert.equal(options.shell,false);assert.equal(options.timeout,3500);assert.equal(o.version,'22.16.0');assert.doesNotMatch(JSON.stringify(o),/PRIVATE/);
});
test('CLI errors and unrecognized output do not produce success',async()=>{
 for(const [err,out,state] of [[new Error('private error'),'','failed'],[null,'unknown output','unknown']]){const r=await h.probeVersion('func',true,[],{resolve:async()=>({executable:'/tool',args:['--version']}),run:(_e,_a,_o,cb)=>cb(err,out,'')});assert.equal(r.state,state);assert.doesNotMatch(JSON.stringify(r),/private error/);}
});
test('unregistered probes are refused',async()=>assert.equal((await h.probeVersion('custom',true)).state,'unknown'));
