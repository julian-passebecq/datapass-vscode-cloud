# Security and enterprise posture

This prototype has no telemetry implementation, account backend, credential store or automatic
model call. No source files, manifests, AI-client settings or MCP files are created/rewritten by
browsing. Other extensions and AI providers have their own policies, which this extension cannot
control. VSIX installation is still subject to the organization's extension allowlist.

Workspace Trust is checked in the host, not just by disabling buttons. CLI probes, provider launch
and project-context export require trust. Guides and local extension metadata remain available in
Restricted Mode. Provider extensions may have their own activation and network behavior.

Webviews use a restrictive CSP, external packaged scripts/styles, no remote script dependency and
only the media folder as local resource root. Every label is escaped. Messages contain IDs, not
arbitrary paths, commands or URLs. The host validates exact shapes and resolves IDs again against
its current catalogue and scan. Unknown messages and stale file/context references are rejected.

Local scan never reads source contents, skips symlinks and known private/configuration trees, and
reports partial coverage. File-open checks revalidate containment and symlink parents. These checks
are not an OS sandbox against an adversary racing the filesystem. Large files require manual use
of a native editor. This is also not comprehensive secret scanning: innocuous source filenames may
still reveal confidential project information.

Context export contains relative filenames, tool status, the selected journey and its constraints.
It excludes source contents, absolute paths and credential files, applies best-effort redaction,
opens a preview and asks before clipboard copy. The user must inspect that preview. Project text is
untrusted data, not instructions. A local MCP server does not mean an AI provider processes locally.

CLI probes use known commands/arguments only, no shell, absolute PATH lookup, workspace-root
exclusion, a timeout, bounded output and no raw stderr export. `.cmd` shims are not run on Windows.
This can yield 'not detected here' even when a tool is installed; the UI explains that limitation.
An executable installed by a user is not independently authenticated by the Studio.

Native views, validation tools, MCP servers and agents can have real side effects. This release
hands off to them but does not authorize deployment, resource changes or model edits on the user's
behalf. Avoid unreviewed install-all bundles, auto-approve scripts and production experimentation.
