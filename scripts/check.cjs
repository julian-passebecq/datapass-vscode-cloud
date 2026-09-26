const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {catalog}=require('../dist/catalog.js'); const p=require('../package.json');
assert.equal(p.extensionDependencies,undefined); assert.equal(p.extensionPack,undefined);
assert.equal(Object.keys(p.dependencies??{}).length,0);
for(const file of ['src/extension.cjs','src/host.cjs','media/studio.js','scripts/preview.cjs','tests/run-vscode.cjs','tests/integration.cjs']){const r=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
assert.ok(!fs.readFileSync('src/extension.cjs','utf8').includes('workspace.fs.writeFile'));
assert.ok(!fs.readFileSync('src/extension.cjs','utf8').includes('createTerminal'));
for(const j of catalog.journeys)assert.ok(j.checks.length>0);
console.log('Syntax, independent-package boundary and catalogue shape checks passed.');
