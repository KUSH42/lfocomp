/**
 * tests/comp.test.js — Unit tests for lfo-comp.js public API
 *
 * Covers: createLFO factory, color/label auto-assignment, connect/disconnect
 * helpers, and the _count color-index underflow fix.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { createLFO, connect, disconnect, getRoutes, LFO_COLORS } from '../lfo-comp.js';
import { engine } from '../lfo-engine.js';

// ── Mock RAF (queue-based — never auto-fires, preventing infinite loops) ──────

const rafQueue = new Map();
let _rafSeq = 0;

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(cb => {
    const id = ++_rafSeq;
    rafQueue.set(id, cb);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn(id => rafQueue.delete(id)));

  Element.prototype.setPointerCapture    = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture    = vi.fn(() => true);

  const fakeCtx = {
    clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
    arc: vi.fn(), fill: vi.fn(), drawImage: vi.fn(), stroke: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), setLineDash: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    shadowBlur: 0, shadowColor: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx);
});

// Track and clean up created widgets after each test
const _created = [];
beforeEach(() => { _created.length = 0; });
afterEach(() => { for (const w of _created) { try { w.destroy(); } catch (_) {} } });
function tracked(result) { _created.push(result.widget); return result; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRange(min = 0, max = 1, val = 0.5) {
  const el = document.createElement('input');
  el.type = 'range';
  el.setAttribute('min', String(min));
  el.setAttribute('max', String(max));
  el.value = String(val);
  document.body.appendChild(el);
  return el;
}

// ── createLFO ─────────────────────────────────────────────────────────────────

describe('createLFO', () => {
  it('returns lfoId and widget', () => {
    const { lfoId, widget } = tracked(createLFO({ label: 'Test', color: '#aabbcc' }));
    expect(typeof lfoId).toBe('string');
    expect(widget).toBeDefined();
  });

  it('auto-assigns a label if none provided', () => {
    const { widget } = tracked(createLFO({ color: '#111111' }));
    expect(widget.label).toMatch(/^LFO \d+$/);
  });

  it('auto-assigns a valid color when label is provided but color is not', () => {
    const { widget } = tracked(createLFO({ label: 'CustomLabel' }));
    expect(widget.color).toBeDefined();
    expect(LFO_COLORS).toContain(widget.color);
  });

  it('cycles through distinct colors for consecutive custom-label LFOs', () => {
    const { widget: w1 } = tracked(createLFO({ label: 'A' }));
    const { widget: w2 } = tracked(createLFO({ label: 'B' }));
    expect(LFO_COLORS).toContain(w1.color);
    expect(LFO_COLORS).toContain(w2.color);
    expect(w1.color).not.toBe(w2.color);
  });

  it('auto-assigns a valid color when neither label nor color provided', () => {
    const { widget } = tracked(createLFO());
    expect(widget.color).toBeDefined();
    expect(LFO_COLORS).toContain(widget.color);
  });

  it('respects provided color and label', () => {
    const { widget } = tracked(createLFO({ label: 'MyLFO', color: '#ff0000' }));
    expect(widget.label).toBe('MyLFO');
    expect(widget.color).toBe('#ff0000');
  });

  it('registers the LFO in the engine', () => {
    const { lfoId } = tracked(createLFO({ label: 'EngTest', color: '#aaaaaa' }));
    expect(engine.getLFO(lfoId)).toBeDefined();
  });

  it('appends widget to container when element is passed as first arg', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const { widget } = tracked(createLFO(div, { label: 'Cnt', color: '#bbbbbb' }));
    expect(div.contains(widget.element)).toBe(true);
    div.remove();
  });
});

// ── connect / disconnect helpers ──────────────────────────────────────────────

describe('connect / disconnect', () => {
  it('connect() creates a route and returns its id', () => {
    const { widget } = tracked(createLFO({ label: 'C1', color: '#cccccc' }));
    const slider = makeRange();
    const routeId = connect(widget, slider);
    expect(typeof routeId).toBe('string');
    expect(engine.getRoute(routeId)).toBeDefined();
    slider.remove();
    widget.disconnectRoute(routeId);
  });

  it('disconnect() removes the route via the registry', () => {
    const { widget } = tracked(createLFO({ label: 'C2', color: '#dddddd' }));
    const slider = makeRange();
    const routeId = connect(widget, slider);
    disconnect(routeId);
    expect(engine.getRoute(routeId)).toBeUndefined();
    slider.remove();
  });

  it('getRoutes() returns all active routes', () => {
    const { widget } = tracked(createLFO({ label: 'C3', color: '#eeeeee' }));
    const slider = makeRange();
    const routeId = connect(widget, slider);
    const routes = getRoutes();
    expect(routes.some(r => r.id === routeId)).toBe(true);
    disconnect(routeId);
    slider.remove();
  });
});
