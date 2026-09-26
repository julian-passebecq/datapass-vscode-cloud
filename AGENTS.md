# DataPass Cloud Studio - implementation instructions

Read README.md, docs/ARCHITECTURE.md and HANDOFF.md. This is a standalone VS Code extension, not
DataPass Control Plane and not a FOIL simulator. Keep client files native and do not require a
bridge, agent subscription, cloud sign-in or another extension for the guides to work.

Use npm run verify. Validate the real renderer, then distinguish native-host and provider-account
evidence. Keep UI/host messages as an exact typed allowlist with host-side re-resolution. Catalogue
changes are data; never let a tool catalogue add new executable privileges. No automatic imports,
cloud writes, deployment, secrets in Git or changes to another repository.

Keep this first release narrow. More routes, a Fabric satellite adapter, shared-neutral catalogue
format and the optional DataPass bridge are separate reviewed slices. Do not rebuild existing
native editors, a compiler, an account manager, a price scraper or a full PM backlog.
