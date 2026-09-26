# Architecture - standalone first

## Boundaries

`src/core.ts` is a pure typed model: Tool, Journey, Route, Step, Observation, WorkspaceSnapshot and
an exact message allowlist. It contains no provider or filesystem implementation. `src/catalog.ts`
is the reviewed, dated seed with six journeys and 25 tools/references. New content cannot inject
an executable command into the native adapter.

`src/host.cjs` implements bounded filename discovery, file containment checks and fixed local
version probes. `src/extension.cjs` adapts these to VS Code, manages transient context and persistent
non-sensitive favorites/presentation, and validates every webview message. URLs, commands and paths
are resolved by the host; the webview sends identifiers only.

`media/studio.js` and `studio.css` render the task-first interface using VS Code theme variables.
The native tree remains a TreeDataProvider; source files open in the real editor. No project file
browser, custom Python editor, agent orchestration service or cloud API client is included.

## Startup and observations

Activation registers the tree and commands only. Opening the Studio or explicit refresh starts a
bounded filename scan (one selected local workspace root, 1,500 directory entries, depth 6, 120
relevant files). Symlinks, sensitive filenames and dependency directories are excluded. Truncation
or read failure is explicit. Source contents are not read during discovery.

Extension availability means getExtension sees a package on this extension host, not that the
account is signed in or the tool works on the user's target. CLI probes are user-triggered and
Workspace-Trust-gated. They resolve executables from absolute PATH entries outside workspace roots,
run fixed version-only arguments with no shell, and return only a version and bounded status.
No cloud token, sign-in state, model rows or raw CLI error output is exported.

## Native launch

On an explicit click, activate the selected installed extension after confirmation. Read its
contributed view containers, allow only normal IDs, and use the built-in workbench view command
when actually registered. Fall back to the native extension page; do not guess arbitrary provider
commands or scrape webviews. Opening a native view may itself contact the provider.

The official Fabric satellite API is promising but **not integrated in 0.1**. First qualify a
non-invasive typed adapter using @microsoft/vscode-fabric-api. Do not override Notebook or Report
handlers, and do not make the Fabric extension mandatory for the other studios.

## State

Favorites and the presentation toggle use ExtensionContext.globalState. They are not written to
client repositories. The setting `cloudStudio.presentation` supplies the initial default before a
local toggle is stored. Checklist notes are session/context-local and cleared on refresh; they are
self-reported notes, not receipts from a validator.

## Content reuse, not an application fork

The current DataPass common registry is an upstream reference, not a runtime dependency. Keep tool
IDs stable where matching. This prototype authors a small explicit seed; it does not pretend that
`requires.datapass` means compatibility with this different product. Before broadening the registry,
extract a neutral content format with its own version, provenance and reviewed publishing process.
Do not create two independently maintained full catalogues or add a database.

## Future optional bridge

V2 can accept a bounded context envelope: goal ID, local file references, selected target label and
source revision, on an explicit user action. No code-copy requirement, no dependency on DataPass's
internal tree/session class and no permission inheritance. A selected architecture or hidden UI
panel does not authorize cloud execution. Databricks is a future fourth studio, not a hidden runtime.
