# SPEC-npm-publish — npm publishing readiness

## Status
Implemented — pending `npm publish`

## Goal

Publish `lfocomp` to npm so it can be installed with `npm install lfocomp` and
consumed either as a plain ES module (no bundler) or inside a bundled project
(Vite, Rollup, webpack, etc.).

The project is already close. `package.json` has `"type": "module"`, a correct
`exports` map, and a `files` whitelist. The remaining work is: TypeScript
declarations, a single-file build artifact, a CHANGELOG, and a name check.

---

## Scope

### In scope
- TypeScript declaration files (`.d.ts`) generated from JSDoc
- Single-file bundle (`lfo.js`) as an optional convenience export
- `package.json` polish (`homepage`, `repository`, `bugs` fields)
- `CHANGELOG.md` (keep-a-changelog format, v0.1.0 entry)
- README npm install section
- `npm publish` dry-run validation

### Out of scope
- Migrating source to TypeScript (JSDoc types are sufficient)
- UMD/CJS builds (ESM only; Node has supported ESM since v12)
- Monorepo / scoped package (`@kush42/lfocomp`) — use flat name unless taken

---

## Name

Check availability before publishing:

```bash
npm view lfocomp 2>&1 | head -3
```

If taken, use `@kush42/lfocomp`. The README, demo link, and package.json name
field must all be updated consistently.

---

## TypeScript declarations

Source files are already JSDoc-annotated. Generate `.d.ts` from JSDoc using
`tsc --declaration --emitDeclarationOnly --allowJs --checkJs`.

Add to `package.json`:

```json
"types": "./lfo-comp.d.ts",
"exports": {
  ".": {
    "types":   "./lfo-comp.d.ts",
    "default": "./lfo-comp.js"
  },
  "./engine": {
    "types":   "./lfo-engine.d.ts",
    "default": "./lfo-engine.js"
  },
  "./ui": {
    "types":   "./lfo-ui.d.ts",
    "default": "./lfo-ui.js"
  }
}
```

Add a `tsconfig.json` for declaration generation only — no compiled output,
no source changes:

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "declaration": true,
    "declarationDir": ".",
    "emitDeclarationOnly": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "strict": false,
    "outDir": "."
  },
  "include": ["lfo-engine.js", "lfo-ui.js", "lfo-comp.js"]
}
```

Add the generated `.d.ts` files to the `files` array in `package.json`.

Add a `build:types` script:

```json
"build:types": "tsc -p tsconfig.json"
```

Run it as part of `prepublishOnly`:

```json
"prepublishOnly": "npm run build:types && npm test"
```

---

## Single-file bundle

A convenience export at `lfocomp/bundle` (or just `lfo.js` in the package
root) for users who want to drop a single `<script type=module>` tag:

```bash
npm install rollup --save-dev
```

```json
"build:bundle": "rollup lfo-comp.js --file lfo.js --format es"
```

Add to `exports`:

```json
"./bundle": {
  "types":   "./lfo.d.ts",
  "default": "./lfo.js"
}
```

Add `lfo.js` and `lfo.d.ts` to `files`.

The bundle adds no new runtime code — it is just the three source files
concatenated with imports resolved. Output is ~same size.

---

## package.json fields

Add the missing metadata fields:

```json
"homepage": "https://kush42.github.io/lfo.html",
"repository": {
  "type": "git",
  "url":  "https://github.com/KUSH42/lfocomp.git"
},
"bugs": {
  "url": "https://github.com/KUSH42/lfocomp/issues"
},
"engines": {
  "node": ">=18"
}
```

---

## CHANGELOG

Create `CHANGELOG.md` following [keep-a-changelog](https://keepachangelog.com):

```markdown
# Changelog

## [Unreleased]

## [0.1.0] - YYYY-MM-DD
### Added
- 7 waveform shapes: sine, triangle, saw, rsaw, square, S&H, smooth random
- Drag-to-assign handle with pointer capture and cross-element detection
- LFO chaining (rate and depth modulation, multiplicative rate formula)
- Per-cycle jitter and waveform skew parameters
- ModIndicator badges with drag-adjustable depth and range arc overlay
- Modulation matrix with live depth sliders
- Bipolar / unipolar output modes
- Float32Array ring buffer oscilloscope with wall-clock time axis
- Zero runtime dependencies
```

---

## README updates

Add an **npm install** section after the Quick start block:

```markdown
## Install

### npm
\`\`\`bash
npm install lfocomp
\`\`\`
\`\`\`js
import { createLFO } from 'lfocomp';
\`\`\`

### CDN (no install)
\`\`\`html
<script type="module">
  import { createLFO } from 'https://cdn.jsdelivr.net/npm/lfocomp/lfo-comp.js';
</script>
\`\`\`

### Self-hosted (three files)
Download `lfo-comp.js`, `lfo-engine.js`, and `lfo-ui.js` — place them in the
same directory and import from `./lfo-comp.js`. No build step required.
```

Update the badges row to include an npm version badge once published:

```markdown
[![npm](https://img.shields.io/npm/v/lfocomp.svg)](https://www.npmjs.com/package/lfocomp)
```

---

## Validation

Before `npm publish`:

```bash
npm pack --dry-run          # check included files
npm publish --dry-run       # full dry run
npx publint                 # lint package.json exports
```

Checklist:
- [ ] `npm view lfocomp` returns 404 (name is free) or name is changed to scoped
- [ ] `npm run build:types` produces `.d.ts` files with no errors
- [ ] `npm run build:bundle` produces `lfo.js`
- [ ] `npm pack --dry-run` lists only the intended files
- [ ] `npx publint` reports no errors
- [ ] `npm test` passes
- [ ] CHANGELOG has a dated v0.1.0 entry
- [ ] README has npm install section and correct CDN URL
- [ ] `package.json` has `homepage`, `repository`, `bugs`

---

## Implementation order

1. Check npm name availability
2. Add `tsconfig.json`, run `build:types`, verify `.d.ts` output
3. Add rollup, `build:bundle`, verify `lfo.js`
4. Update `package.json` (exports with types, metadata fields, scripts)
5. Write `CHANGELOG.md`
6. Update README (install section, npm badge)
7. Run full validation checklist
8. `npm publish`
