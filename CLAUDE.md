# Origami Header

A frontend module for Home Assistant in a single file, `origami-header.js`. No dependencies, no build step.

## Commands

- `npm test` runs the Playwright tests against a mock of the Home Assistant frontend in `test/mock`.
- `npm run check` runs `scripts/check-style.mjs`, which rejects wording and formatting typical of generated text.

Run both before every commit.

## Code

- Plain modern JavaScript. Keep the module dependency-free and in one file.
- Add code only for a real need. No abstractions for a single use, no defensive checks for cases that cannot happen.
- Comments explain Home Assistant internals or decisions that are not obvious from the code. No JSDoc, no comments that restate the code.
- Logging is limited to warnings for unsupported versions and invalid CSS.
- Keep the fail-safe: when Home Assistant changes its structure, the default header must stay usable.
- Every behavior change gets a test. Tests describe behavior in plain words.

## Text

Applies to the README, comments, commit messages, issues and release notes.

- Plain English in normal, natural sentences. Keep it short and on point. Say what something does, not how good it is.
- No emojis, no exclamation marks, no em dashes, no marketing words.
- Headings in sentence case.
- Do not add sections, badges or files that nobody asked for.
- No Co-Authored-By or other AI trailers in commits. The note on AI in the README covers that.

## Home Assistant internals

The module depends on these. When an update breaks something, check them first:

- `hui-root`: `updated()`, `slot[name="toolbar"]`, `.header` and its `backdrop-filter`, `--header-height`, `_enableEditMode()`
- `hui-card`: removes cards whose element is `hidden`, sets `preview` in edit mode and in the card editor
- the scoped custom element registry polyfill in the Home Assistant app bundle
- the events `hass-action`, `hass-toggle-menu`, `ll-custom` and `location-changed`

`test/mock/mock-ha.js` reproduces this behavior. Update it together with the module, and check the result on a real Home Assistant instance before a release.

## Releases

1. Update `VERSION` in `origami-header.js`, `version` in `package.json` and the version in the README's manual install URL.
2. Commit, tag `vX.Y.Z` and push.
3. Create a GitHub release for the tag, attach `origami-header.js` and write a few lines on what changed.
