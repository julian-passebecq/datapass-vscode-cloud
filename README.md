# DataPass Cloud Studio

**Choose a goal. Find the right native tool. Know what to check before acting.**

An independent VS Code extension for **Fabric, Power BI and Azure**. It works without DataPass,
a bridge repository, an AI subscription or a cloud connection. Native project files stay native.

**Version 0.1.0 is a working prototype, not a cloud orchestration engine.** It guides, observes local
metadata, opens source files and hands work to existing tools. It does not deploy or validate a
live cloud project for you.

## Install and try

Use VS Code desktop **1.106 or newer**. Download the VSIX from this repository's Actions artifact
(or the supplied conversation attachment). In Extensions, choose **Install from VSIX...**, then run
**Cloud Studio: Open Studio** in the command palette. No other extension is required to browse.

Open any normal local project, or browse the guide without one. In a multi-root workspace, choose
the working folder explicitly. No `.datapass` or Studio manifest is required or created.

French walkthrough: [DEMARRER.md](docs/DEMARRER.md).

## Six journeys

| Studio | Journey |
|---|---|
| Fabric | Open and understand a workspace item |
| Fabric | Prepare a notebook and select the correct execution route |
| Power BI | Understand PBIP, model and report definitions |
| Power BI | Document measures without changing formulas or relationships |
| Azure | Prepare a Function for an isolated local test |
| Azure | Prepare Azure Data Factory validation using native tools |

All six have a non-AI route. Fabric discovery and Power BI measure documentation also offer
optional agent-assisted routes. MCP setup remains in the chosen native client.

## Implemented

- One activity-bar entry, native journey tree and a theme-aware Studio editor.
- Three studio filters; search across journeys and a **25-entry** tool/reference catalogue.
- Guided / Compact presentation and local favorite journeys.
- Relevant local files found with a bounded, explicit scan; open source text in a second editor group.
- Extension metadata from the current extension host. A tool may be absent here but installed elsewhere.
- On-demand version probes for Python, Node, Azure CLI, Functions Core Tools and Fabric CLI.
- Open an installed extension's contributed native view after confirmation, with fallback to its extension page.
- Reviewed metadata-only context for an external AI. Copying is explicit; nothing is sent automatically.
- Context-scoped personal verification notes, clearly distinguished from executed checks.
- Tool purpose, limits, execution location, cost boundaries, side effects and dated primary sources.

## Not implemented or not qualified

No deployments, cloud queries, credential storage, MCP server installation, project manifest writes,
full compiler, ADF validator clone or automatic agent. No dependency on DataPass or Claude Control.
No live cloud account was used to qualify this release. Fabric satellite API integration, actual
MCP client/server handshakes, Databricks Studio and a DataPass bridge are later work.

Local desktop is the intended v0.1 target. Remote-SSH, WSL and virtual-workspace workflows are not
qualified. The extension disables local scans/probes in a remote session. Windows CLI `.cmd` shims
are intentionally not executed by the probe; use the native terminal when that applies.

A native view can authenticate and contact its provider. Cloud Studio asks before handing control
to it, but cannot change or guarantee another extension's behavior. Installing a tool is not proof
of sign-in, permissions, supported target, successful operation or correct scientific output.

## Develop

Node.js 20+ (tested locally on 22), Python 3 for VSIX packaging:

```sh
npm ci
npm run verify
python scripts/package.py
```

Press F5 to open an Extension Development Host. `npm run preview` serves a browser-only development
preview on localhost; its observations are synthetic. `npm run test:ui` requires Python Playwright
and Chromium. [Testing](docs/TESTING.md) separates unit, renderer, native host and cloud evidence.

The production extension has **zero external runtime dependencies**. The pure core and catalogue
are TypeScript; the thin VS Code/Node adapter and webview are JavaScript. `tsc` checks the pure core;
Node checks adapter/browser syntax, and tests exercise their behavior. This is not a claim that
the JavaScript adapter has full VS Code TypeScript checking.

## Product boundaries

DataPass organizes a multi-repository project. Cloud Studio helps choose and use the tools for a
task. Existing extensions, CLIs, agents and services own their operations. Removing this extension
must leave every client repository usable.

See [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), [sources](docs/SOURCES.md) and
[handoff](HANDOFF.md). Catalogue entries preserve existing shared DataPass IDs where practical;
this release embeds a curated seed, **not** a live or automatic copy of the common registry.

No Marketplace release has been published. License terms have not been selected by the owner;
this repository is currently UNLICENSED.
