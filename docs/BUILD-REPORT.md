# v0.5.0-beta.1 Build verification (2026-10-26)

## Verified in current sandbox

- Source migration check: passed (`node scripts/validate.mjs`).
- Node syntax: engine Render.js, Vue API source, plugin entry and build tooling all parse.
- Legacy compatibility / regression checks: 13 of 13 passed (including map serialization, saving, theme defaults, overlays, iframe reuse).
- Local engine link: `web/package.json` uses `file:../engine`; Webpack has a corresponding absolute alias for deep imports.
- The full production compile is gated: no old `editor/dist` is included as a fallback.

## Blocker

The execution environment has no cached `@toast-ui/editor` and required Vue CLI npm packages. `npm install --offline` returned `ENOTCACHED`; running `node scripts/build.mjs` correctly refused to produce an installation ZIP because `web/node_modules/.bin/vue-cli-service` is missing.

**Therefore, a new rebuilt v0.5.0 installer is NOT included in this deliverable.** A normal networked Node development computer can run `npm install` in `web/`, then `npm run build` from the repository root. This build still needs to be tested on a running SiYuan desktop client; successful bundling does not prove integration correctness.

Current usable installation stays v0.4.6 until that build and validation succeeds.


## dev.2 regression status

- Initial legacy plugin tests reported 4 failures because the test DOM mock had no SVG `createElementNS`; this was a test harness defect introduced when startup preview was added, **not evidence of an application crash**.
- Extended mock implements `createElementNS` and `appendChild`; `npm test` now discovers both root and plugin test suites.
- GitHub Actions workflow prepared to install dependencies and compile on a network-capable runner. It is not a successful compile itself.
- Runtime network lookup of registry.npmjs.org failed with `EAI_AGAIN` on 2026-10-26; full Vue compilation remains blocked in this environment.

- The release manifest and source project now both declare `0.5.0-dev.2`, and the build output filename is derived from the manifest version.
