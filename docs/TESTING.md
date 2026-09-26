# Verification layers

Run `npm ci && npm run verify` for TypeScript core compilation, Node unit/adapter tests and syntax/
package-boundary checks. The host adapter tests use an injected VS Code mock; they are not native
editor integration tests. Browser tests execute the actual webview renderer in Chromium with a
simulated message bridge; they are not a cloud runtime or installed-extension proof.

`python scripts/package.py` creates a deterministic VSIX/OPC archive with an explicit file allowlist,
then checks ZIP integrity and entrypoint presence. This uses a small standard-library packager, not
VSCE. The separate CI native job installs that VSIX with the real VS Code CLI and opens an Extension
Development Host. Both layers must be distinguished in reporting.

`npm run test:ui` requires Python Playwright and Chromium (`CHROMIUM_PATH` optionally selects it).
It uses in-memory HTML, not a network server. Checks include routes, studio/search filters,
favorites, file/context message tokens, checklist semantics, compact mode, Restricted Mode,
injection escaping, keyboard navigation and 390/760/1180/1450-pixel layout. Screenshots and a JSON
result go to ignored `artifacts/`.

For the native job, CI installs pinned @vscode/test-electron 2.5.2 into ignored `.ci-tools/` and
uses VS Code 1.106.0. This optional test tool is not included in the VSIX or production dependencies.
The native test exercises activation, command registration, webview opening, refresh and unchanged
source fixtures. It does not sign in, start MCP, use a real provider extension, or run cloud jobs.

## Evidence for the first implementation pass

Locally executed: pure-core compilation, 49 Node tests, adapter/browser syntax checks, and 14 real
Chromium renderer checks with a simulated host. The first test run exposed a `v22.16.0` parsing
bug; it was fixed and the full local suite rerun successfully. Packaging and install validation
are separate. See GitHub Actions for the actual result of each pushed commit; do not infer CI
success from this document or a workflow file.

Not locally executed: native VS Code runtime (not installed and network downloads unavailable),
Windows/macOS host behavior, live Microsoft accounts, Fabric kernels, Power BI Desktop or MCP
handshakes. Do not promote local UI tests into provider/runtime evidence.

## Manual acceptance

On the user's machine: install the VSIX; open a normal folder; browse all three studios; choose a
native file; confirm it opens beside the guide; try the extension page/native-view route; request
one CLI version; preview and cancel context copy; repeat and approve it. Check that no client file
changed. Only after this, qualify one disposable sample with a real provider tool.
