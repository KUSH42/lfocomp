# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
