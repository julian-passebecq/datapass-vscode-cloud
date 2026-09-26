const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
exports.run=async()=>{
 const vscode=require('vscode');
 const root=path.resolve(__dirname,'../fixtures/sample');
 const snapshot=()=>Object.fromEntries(fs.readdirSync(root,{recursive:true}).filter(f=>fs.statSync(path.join(root,f)).isFile()).map(f=>[f,fs.readFileSync(path.join(root,f),'base64')]));
 const before=snapshot();
 const ext=vscode.extensions.getExtension('julian-passebecq.datapass-vscode-cloud');assert.ok(ext,'extension found in native host');
 const api=await ext.activate();assert.ok(ext.isActive);assert.equal(ext.packageJSON.extensionDependencies,undefined);
 const commands=await vscode.commands.getCommands();for(const name of ['open','refresh','chooseFolder','checkTools','context'])assert.ok(commands.includes(`cloudStudio.${name}`));
 await vscode.commands.executeCommand('cloudStudio.open','azure.function');
 await vscode.commands.executeCommand('cloudStudio.refresh');
 await new Promise(r=>setTimeout(r,1200));
 assert.equal(api.diagnostics().files,2,'native filesystem scan found the fixture');
 assert.equal(api.diagnostics().scan,'complete');
 assert.ok(vscode.window.tabGroups.all.some(g=>g.tabs.some(t=>t.label==='Cloud Studio')),'webview editor tab exists');
 assert.deepEqual(snapshot(),before,'browsing did not change native files');
 console.log('Native VS Code smoke: activation, five registered commands, webview open, refresh, unchanged fixture. No provider-account qualification.');
};
