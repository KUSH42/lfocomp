# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.1] - 2026-03-28

### Fixed
- LFO widget param sliders overflowing their containers (`min-width: 0` on grid cells)
- LFO widgets too narrow (~213 px) on typical viewports — panel moved above main grid, each widget now ~343 px
- `destroyLFO` now removes incoming LFO-chain routes as well as outgoing ones
- `ModIndicator._reposition` crash due to undefined `badge` variable
- Arc canvas height mismatch between construction and draw path
- `pointercancel` during drag left SVG wire overlay in the DOM
- Color-cycling underflow (`LFO_COLORS[-1] === undefined`) when label provided but color omitted on first `createLFO` call
- Stale `ModIndicator` badges persisting after routes deleted externally — `_pruneDeadRoutes()` runs each tick
- Escape key in click-to-type param editor no longer commits the value

### Added
- LFO widget params split into two visual groups: Rate/Depth (primary) and Phase/Offs./Jitter/Skew (secondary)
- 91-test suite across three files: `engine.test.js`, `widget.test.js`, `comp.test.js`
- Coverage thresholds in `vitest.config.js` (60 % lines/functions, 50 % branches)

## [0.1.0] - 2026-03-28

### Added
- 7 waveform shapes: sine, triangle, saw, rsaw, square, S&H, smooth random
- Drag-to-assign handle with pointer capture and cross-element detection
- LFO chaining — drag onto another LFO's Rate or Depth slider; rate modulation is multiplicative so it never reaches zero
- Per-cycle jitter and waveform skew parameters
- ModIndicator badges with drag-adjustable depth and range arc overlay
- Modulation matrix with live depth sliders and one-click delete
- Bipolar / unipolar toggle (BI/UNI button)
- Click-to-type on any param value readout; Enter commits, Escape cancels
- Float32Array ring buffer oscilloscope with fixed wall-clock time axis
- Log-scaled rate slider (0.01 Hz – 10 Hz)
- Zero runtime dependencies

[Unreleased]: https://github.com/KUSH42/lfocomp/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/KUSH42/lfocomp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/KUSH42/lfocomp/releases/tag/v0.1.0
