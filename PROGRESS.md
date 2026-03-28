# PROGRESS.md — lfocomp

## Project Bootstrap — 2026-03-28

### Completed

#### Core engine (lfo-engine.js)
- [x] `LFOEngine` class with singleton `engine` export
- [x] `createLFO(opts)` → lfoId with full state object
- [x] 7 waveform shapes: sine, triangle, saw, rsaw, square, random (S&H), smooth
- [x] `seededRand` — deterministic pseudo-random (sin hash) for S&H shape
- [x] `smoothRand` — cubic Hermite interpolated random for smooth shape
- [x] RAF tick loop with accurate `dt` and 100ms cap
- [x] 3-pass tick: (1) reset effective params, (2) chain routes, (3) advance + apply
- [x] `addRoute` for both `'element'` and `'lfo'` target types
- [x] Chain auto-detection: `data-lfo-id` / `data-lfo-param` on element → auto-promote to lfo route
- [x] `ElementState` base value tracking (updated on user input/change events)
- [x] Modulation formula: `clamp(base + lfoVal × depth × range/2, min, max)`
- [x] LFO→LFO rate chain: `effectiveRate = base × (1 + srcVal × depth)`
- [x] LFO→LFO depth chain: `effectiveDepth = base + srcVal × depth × 0.5`
- [x] `removeRoute`, `setRouteDepth`, `setRouteEnabled`
- [x] `subscribe(fn)` → unsubscribe callback for UI tick notifications
- [x] `destroyLFO(id)` removes all associated routes

#### UI (lfo-ui.js)
- [x] `injectStyles()` with full dark-theme CSS (injected once into `<head>`)
- [x] `LFOWidget` canvas panel (176×56px waveform + header + shapes + params + handle)
- [x] Canvas waveform: 2.5 cycle preview, scrolling phase cursor, current-value dot, glow
- [x] Shape buttons: SIN / TRI / SAW / RSW / SQR / S&H / SMO (4-column grid)
- [x] 4 param sliders: Rate (0.01–20Hz), Depth (0–1), Phase (0–1), Offset (-1–1)
- [x] Param sliders carry `data-lfo-id` / `data-lfo-param` for chain detection
- [x] Connect handle: `setPointerCapture` drag with `elementsFromPoint` target detection
- [x] SVG bezier wire overlay during drag with valid/invalid color switching
- [x] `lfo-drag-target` highlight class on hover target during drag
- [x] `ModIndicator` floating badge: color dot, LFO label, depth %, drag-to-adjust, × remove
- [x] Range arc overlay canvas (5px strip below range inputs): sweep range + current dot
- [x] `LFOWidget.connect(element, opts)` for programmatic connections
- [x] `LFOWidget.disconnectRoute(routeId)` and `disconnectAll()`
- [x] `LFOWidget.destroy()` cleans up RAF, routes, DOM

#### Public API (lfo-comp.js)
- [x] `createLFO(container?, opts?)` → `{ lfoId, widget }`
- [x] `connect(widget, element, opts?)` → routeId
- [x] `disconnect(routeId)`
- [x] `getRoutes()` → all active routes
- [x] Re-exports: `engine`, `SHAPES`, `seededRand`, `smoothRand`, `LFOWidget`, `ModIndicator`, `LFO_COLORS`

#### Demo (demo.html)
- [x] 3 LFO panels (cyan, magenta, lime) in a flex row
- [x] 6 modulation targets: Size, Opacity, Rotation, Blur, Hue Shift, Frequency
- [x] Live preview box driven by Size + Opacity + Rotation + Blur + Hue controls
- [x] Modulation matrix table (polled every 500ms)
- [x] One pre-wired example: LFO 1 → Size
- [x] Instructions panel

---

## Backlog

### High priority
- [ ] BPM sync: rate expressed as note value (1/4, 1/8, 1/16…) relative to a BPM
- [ ] Retrigger: reset phase on a trigger signal or keyboard event
- [ ] Preset save/load (JSON export/import of routing state)

### Medium priority
- [ ] Envelope mode: one-shot ADSR triggered by event
- [ ] Rate display toggle: Hz ↔ ms ↔ BPM-sync notation
- [ ] `data-lfo-target="label"` for custom label in the matrix table
- [ ] Touch UX: long-press to arm, two-finger horizontal drag for depth

### Low priority
- [ ] Modulation matrix: inline depth sliders (not just display)
- [ ] `prefers-reduced-motion` disables animation for accessibility
- [ ] Multiple mod sources summed with per-source polarity toggle (bipolar/unipolar)
- [ ] MIDI output: emit CC on modulated value changes
- [ ] Unit tests: engine math, route management (vitest, Node env)
- [ ] `temu-ableton-lfo.html` — could be a minimal single-file showcase
