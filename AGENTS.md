# DataPass Cloud Studio (datapass-vscode-cloud)

A standalone VS Code extension for Fabric, Power BI and Azure work: choose a goal, find the right native tool, know what to check before acting. It works without DataPass, a bridge repository, an AI subscription or a cloud sign-in. Read `README.md`, `docs/ARCHITECTURE.md` and `HANDOFF.md`.

## Build and test
- `npm run verify` (build, `node --test tests/*.test.cjs`, `scripts/check.cjs`). `npm run test:ui` and `npm run test:vscode` exercise the real renderer and host.
- CI: the GitLab mirror `juliandatapass-group/datapass-vscode-cloud` has its jobs only on the mirror's own `main`, not on GitHub `main`, so a branch from GitHub runs no pipeline. Run `npm run verify` yourself and quote it, or bring the CI file over first.

## Guidelines
- Live cloud writes stay off and show as NOT EXECUTED; no automatic imports or deployment. Users point it at real tenants.
- Messages between the UI and the host are an exact typed allowlist, re-resolved on the host side.
- A catalogue change is data and never adds an executable privilege.
- No secrets in Git, and no changes to another repository.
- Client files stay native; the guides must work without another extension.

How work flows: the fleet guideline every session loads (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`). CI recipe and runners: datapass-fleet-facade `AGENTS.md`.
