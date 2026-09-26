// CI installs this optional test tool in .ci-tools; it is not shipped in the extension.
const path=require('node:path');const cp=require('node:child_process');
const {runTests,downloadAndUnzipVSCode,resolveCliArgsFromVSCodeExecutablePath}=require('../.ci-tools/node_modules/@vscode/test-electron');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const exe=await downloadAndUnzipVSCode('1.106.0');
 const [cli,...args]=resolveCliArgsFromVSCodeExecutablePath(exe);
 const install=cp.spawnSync(cli,[...args,'--no-sandbox','--user-data-dir',path.join(root,'.vscode-test/user'),'--extensions-dir',path.join(root,'.vscode-test/extensions'),'--install-extension',path.join(root,'artifacts/datapass-vscode-cloud-0.1.0.vsix'),'--force'],{encoding:'utf8',shell:process.platform==='win32'});
 console.log(install.stdout);console.error(install.stderr);if(install.status!==0)throw new Error('VSIX installation failed');
 await runTests({vscodeExecutablePath:exe,extensionDevelopmentPath:root,extensionTestsPath:path.join(__dirname,'integration.cjs'),launchArgs:[path.join(root,'fixtures/sample'),'--no-sandbox','--disable-workspace-trust','--skip-welcome','--skip-release-notes','--user-data-dir',path.join(root,'.vscode-test/smoke-user'),'--extensions-dir',path.join(root,'.vscode-test/extensions')]});
})().catch(e=>{console.error(e);process.exit(1);});
