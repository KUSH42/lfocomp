# CLAUDE.md — lfocomp

## What This Project Is

A zero-dependency ES module component for adding Ableton/Bitwig/Serum-style
LFO modulation to any HTML input element. Drag an LFO's assign handle onto any
`<input type=range>` or `<input type=number>` to wire up live modulation.
LFOs can be chained (LFO B modulates LFO A's rate or depth) by dragging onto
the target LFO's parameter sliders.

No bundler. No npm install at runtime. Plain ES modules — serve with any static
file server.

---

## File Structure

```
lfocomp/
├── lfo-engine.js      # Core math: LFO state machine, tick loop, route graph
├── lfo-ui.js          # DOM: LFOWidget canvas, ModIndicator badge, drag wire
├── lfo-comp.js        # Public API: createLFO(), connect(), disconnect()
├── demo.html          # Interactive demo — open in browser after `npm run serve`
├── temu-ableton-lfo.html  # Original scratch file (unused)
├── memory/
│   └── MEMORY.md      # Agent session notes
├── specs/             # Spec docs for planned features
├── package.json
├── vitest.config.js
└── CLAUDE.md          # This file
```

---

## Architecture

### Engine (lfo-engine.js)

- **LFOState** — `{ shape, baseRate, baseDepth, phase, offset, bipolar, currentPhase, currentValue, seed, ... }`
- **RouteState** — `{ id, sourceId, targetType, target, targetParam, depth, enabled }`
- **ElementState** — `{ min, max, step, baseValue, onUserInput, routeIds }`

Tick loop runs three passes:
1. Reset effective `rate`/`depth` to base values.
2. Apply LFO→LFO chain routes (uses previous frame values, so chains are stable).
3. Advance all LFO phases, compute new `currentValue`.
4. Notify UI subscribers.
5. Apply element routes: `element.value = clamp(baseValue + lfoVal * depth * range/2, min, max)`.

**Chain auto-detection**: `addRoute('element', inputEl)` inspects `inputEl.dataset.lfoId`
and `inputEl.dataset.lfoParam`. If the element is an LFO param slider, the route is
auto-promoted to a `'lfo'` chain route.

**Base value tracking**: User `input`/`change` events update `ElementState.baseValue`
so the LFO always modulates relative to the user's last drag position.

### UI (lfo-ui.js)

**LFOWidget**: Canvas waveform display + shape buttons + 4 param sliders + connect handle.
- Canvas draws 2.5 cycles anchored to `currentPhase`, scrolling in real time.
- Shape buttons (SIN/TRI/SAW/RSW/SQR/S&H/SMO) toggle the LFO shape.
- Param sliders carry `data-lfo-id` and `data-lfo-param` for chain detection.
- Connect handle uses `setPointerCapture` + `document.elementsFromPoint()` for
  cross-element drag detection.

**ModIndicator**: Fixed-position floating badge anchored to a connected input.
- Depth label is drag-adjustable (ew-resize cursor, horizontal drag → depth %).
- Range arc canvas: 5px tall strip below range inputs showing sweep range and current position.
- Position updates every RAF frame via `getBoundingClientRect()`.

**DragWire**: Full-screen SVG (position:fixed) showing a bezier wire during assign drag.

### Public API (lfo-comp.js)

```js
createLFO(container?, opts?) → { lfoId, widget }
connect(widget, element, opts?) → routeId
disconnect(routeId)
getRoutes() → RouteState[]

// Re-exports:
engine, SHAPES, seededRand, smoothRand
LFOWidget, ModIndicator, injectStyles, LFO_COLORS
```

---

## Waveform Shapes

| ID       | Description                                    |
|----------|------------------------------------------------|
| `sine`   | Smooth sine wave                               |
| `triangle`| Linear ramp up then down                     |
| `saw`    | Rising sawtooth (-1 → +1 per cycle)            |
| `rsaw`   | Falling sawtooth (+1 → -1 per cycle)           |
| `square` | Hard square wave (±1)                          |
| `random` | Sample-and-hold (new random value each cycle)  |
| `smooth` | Cubic-interpolated random (smooth random walk) |

---

## LFO Parameters

| Param   | Range      | Description                                   |
|---------|------------|-----------------------------------------------|
| rate    | 0.01–20 Hz | Oscillation frequency                         |
| depth   | 0–1        | Modulation depth (scales the raw output)      |
| phase   | 0–1        | Phase offset (0=no offset, 0.5=180°)          |
| offset  | -1–1       | DC offset added to output                     |
| bipolar | bool       | true=output -1..1, false=output remapped 0..1 |

---

## Modulation Formula

```
modAmount  = lfo.currentValue × route.depth × (max - min) / 2
outputValue = clamp(baseValue + modAmount, min, max)
```

For LFO→LFO rate chain:
```
effectiveRate = baseRate × (1 + srcValue × depth)
```

---

## Coding Standards

### Zero External Dependencies (runtime)
All browser modules are plain ES6+. No npm packages at runtime.

### ES Module Pattern
```js
export const engine = new LFOEngine(); // singleton
export class LFOWidget { ... }
export function createLFO(container, opts) { ... }
```

### DOM Mutation Rules
- Never wrap or reparent existing user elements. Use fixed-position overlays.
- Inject styles once (guarded by `_stylesInjected` flag).
- Clean up all event listeners and DOM nodes in `destroy()`.

### Pointer Events for Drag
Use `pointer{down,move,up,cancel}` + `setPointerCapture` instead of mouse events
or HTML5 drag API, for consistent cross-device behaviour.

---

## Development Workflow

### Serving Locally
```bash
npm run serve
# Opens http://localhost:8080/demo.html
```

### Unit Tests
```bash
npm test        # run once
npm run test:watch
```
Tests live in `tests/`. Only pure-JS logic (engine math, route management) can be
tested without a DOM — use jsdom if DOM testing is needed.

### Spec-Driven Workflow
1. Write `specs/SPEC-<feature>.md` describing the change.
2. Review for completeness. Iterate until zero issues.
3. Implement with spec doc open.
4. Update `PROGRESS.md`.

### Adding a New Waveform Shape
1. Add name to `SHAPES` array in `lfo-engine.js`.
2. Add math function to `SHAPE_FN` map (or special-case in `_computeValue`).
3. Add label to `SHAPE_LABELS` in `lfo-ui.js`.
4. Add a unit test in `tests/engine.test.js`.

### Adding a New LFO Parameter
1. Add to `LFOState` default in `createLFO()`.
2. Handle in `setParam()` (keep base value in sync if needed).
3. Add a param slider in `LFOWidget._build()` via `_addParam()`.

---

## Known Limitations / Backlog

- No BPM sync / tempo-locked rates yet.
- No MIDI input for triggering LFO retrigger.
- `ModIndicator` position is not updated on scroll (only on RAF — acceptable for most layouts).
- Range arc overlay only works for `input[type=range]`. Number inputs get badge only.
- No persistence (save/load preset routing).
- No touch-specific UX for the depth drag handle.
