/**
 * tests/widget.test.js — Unit tests for LFOWidget and ModIndicator (lfo-ui.js)
 *
 * Covers: connect/disconnect lifecycle, duplicate-connection guards, destroy,
 * onConnect/onDisconnect callbacks, and ModIndicator badge construction.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { engine } from '../lfo-engine.js';
import { LFOWidget, ModIndicator, injectStyles } from '../lfo-ui.js';

// ── Mock RAF (same pattern as engine.test.js) ──────────────────────────────

const rafQueue = new Map();
let _rafSeq = 0;

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(cb => {
    const id = ++_rafSeq;
    rafQueue.set(id, cb);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn(id => rafQueue.delete(id)));

  // jsdom does not implement pointer capture — stub the methods so drag
  // handler setup doesn't throw. hasPointerCapture returns true so the
  // end/move guards (which require capture) pass during tests.
  Element.prototype.setPointerCapture    = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture    = vi.fn(() => true);

  // jsdom does not implement canvas — stub getContext so widget construction
  // doesn't emit "Not implemented" warnings and canvas calls are no-ops.
  const fakeCtx = {
    clearRect:       vi.fn(),
    fillRect:        vi.fn(),
    beginPath:       vi.fn(),
    arc:             vi.fn(),
    fill:            vi.fn(),
    stroke:          vi.fn(),
    moveTo:          vi.fn(),
    lineTo:          vi.fn(),
    setLineDash:     vi.fn(),
    drawImage:       vi.fn(),
    getImageData:    vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData:    vi.fn(),
    createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx);
});

function flushRAF(ts = 16) {
  const entries = [...rafQueue.entries()];
  rafQueue.clear();
  for (const [, cb] of entries) cb(ts);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContainer() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

function makeRange(min = 0, max = 1, value = 0.5) {
  const el = document.createElement('input');
  el.type = 'range';
  el.setAttribute('min', String(min));
  el.setAttribute('max', String(max));
  el.value = String(value);
  document.body.appendChild(el);
  return el;
}

// ── Setup / teardown ───────────────────────────────────────────────────────

let container;
let lfoId;
let widget;

beforeEach(() => {
  rafQueue.clear();
  container = makeContainer();
  lfoId = engine.createLFO({ rate: 1, shape: 'sine' });
  widget = new LFOWidget(container, lfoId, { color: '#ff0000', label: 'LFO Test' });
});

afterEach(() => {
  // Guard against double-destroy (tests may call destroy themselves)
  try { widget.destroy(); } catch (_) {}
  container.remove();
});

// ── injectStyles ───────────────────────────────────────────────────────────

describe('injectStyles', () => {
  it('injects at most one <style id="lfo-ui-styles"> element', () => {
    // injectStyles is idempotent: the module-level flag prevents double injection.
    // After LFOWidget construction in beforeEach the style is already present.
    injectStyles();
    injectStyles();
    const styles = document.head.querySelectorAll('style#lfo-ui-styles');
    expect(styles.length).toBe(1);
  });
});

// ── LFOWidget construction ─────────────────────────────────────────────────

describe('LFOWidget construction', () => {
  it('appends a root element to the container', () => {
    expect(container.querySelector('.lfo-widget')).not.toBeNull();
  });

  it('exposes lfoId, color, label getters', () => {
    expect(widget.lfoId).toBe(lfoId);
    expect(widget.color).toBe('#ff0000');
    expect(widget.label).toBe('LFO Test');
  });

  it('exposes an .element getter returning the root element', () => {
    expect(widget.element).toBeInstanceOf(Element);
  });

  it('registers the LFO in the engine', () => {
    const lfo = engine.getLFO(lfoId);
    expect(lfo).not.toBeNull();
  });
});

// ── connect / disconnectRoute ──────────────────────────────────────────────

describe('LFOWidget.connect', () => {
  it('returns a routeId string on success', () => {
    const slider = makeRange();
    const routeId = widget.connect(slider);
    expect(typeof routeId).toBe('string');
    slider.remove();
    widget.disconnectRoute(routeId);
  });

  it('creates a route in the engine', () => {
    const slider = makeRange();
    const routeId = widget.connect(slider);
    expect(engine.getRoute(routeId)).not.toBeNull();
    slider.remove();
    widget.disconnectRoute(routeId);
  });

  it('fires onConnect with (lfoId, element, routeId)', () => {
    const slider = makeRange();
    const onConnect = vi.fn();
    const c2 = makeContainer();
    const lfoId2 = engine.createLFO({});
    const w2 = new LFOWidget(c2, lfoId2, { color: '#00ff00', label: 'LFO 2', onConnect });
    const routeId = w2.connect(slider);
    expect(onConnect).toHaveBeenCalledWith(lfoId2, slider, routeId);
    slider.remove();
    w2.destroy();
    c2.remove();
  });

  it('rejects duplicate connection to the same element and returns null', () => {
    const slider = makeRange();
    const r1 = widget.connect(slider);
    const r2 = widget.connect(slider);
    expect(r1).not.toBeNull();
    expect(r2).toBeNull();
    slider.remove();
    widget.disconnectRoute(r1);
  });

  it('respects custom depth option', () => {
    const slider = makeRange();
    const routeId = widget.connect(slider, { depth: 0.3 });
    const route = engine.getRoute(routeId);
    expect(route.depth).toBeCloseTo(0.3);
    slider.remove();
    widget.disconnectRoute(routeId);
  });
});

describe('LFOWidget.disconnectRoute', () => {
  it('removes the route from the engine', () => {
    const slider = makeRange();
    const routeId = widget.connect(slider);
    widget.disconnectRoute(routeId);
    expect(engine.getRoute(routeId)).toBeUndefined();
    slider.remove();
  });

  it('fires onDisconnect with the routeId', () => {
    const slider = makeRange();
    const onDisconnect = vi.fn();
    const c2 = makeContainer();
    const lfoId2 = engine.createLFO({});
    const w2 = new LFOWidget(c2, lfoId2, { color: '#0000ff', label: 'LFO 3', onDisconnect });
    const routeId = w2.connect(slider);
    w2.disconnectRoute(routeId);
    expect(onDisconnect).toHaveBeenCalledWith(routeId);
    slider.remove();
    w2.destroy();
    c2.remove();
  });

  it('is idempotent — calling disconnectRoute twice does not throw', () => {
    const slider = makeRange();
    const routeId = widget.connect(slider);
    expect(() => {
      widget.disconnectRoute(routeId);
      widget.disconnectRoute(routeId);
    }).not.toThrow();
    slider.remove();
  });
});

// ── disconnectAll ──────────────────────────────────────────────────────────

describe('LFOWidget.disconnectAll', () => {
  it('removes all connected routes from the engine', () => {
    const s1 = makeRange(0, 1, 0.5);
    const s2 = makeRange(0, 2, 1);
    const r1 = widget.connect(s1);
    const r2 = widget.connect(s2);
    widget.disconnectAll();
    expect(engine.getRoute(r1)).toBeUndefined();
    expect(engine.getRoute(r2)).toBeUndefined();
    s1.remove();
    s2.remove();
  });
});

// ── destroy ────────────────────────────────────────────────────────────────

describe('LFOWidget.destroy', () => {
  it('removes the LFO from the engine', () => {
    const lid = engine.createLFO({});
    const c = makeContainer();
    const w = new LFOWidget(c, lid, { color: '#aaa', label: 'Tmp' });
    w.destroy();
    expect(engine.getLFO(lid)).toBeUndefined();
    c.remove();
  });

  it('removes all routes for the widget', () => {
    const slider = makeRange();
    const lid = engine.createLFO({});
    const c = makeContainer();
    const w = new LFOWidget(c, lid, { color: '#bbb', label: 'Tmp2' });
    const routeId = w.connect(slider);
    w.destroy();
    expect(engine.getRoute(routeId)).toBeUndefined();
    slider.remove();
    c.remove();
  });

  it('removes the root element from the DOM', () => {
    const lid = engine.createLFO({});
    const c = makeContainer();
    const w = new LFOWidget(c, lid, { color: '#ccc', label: 'Tmp3' });
    const root = w.element;
    document.body.appendChild(root);
    w.destroy();
    expect(document.body.contains(root)).toBe(false);
    c.remove();
  });
});

// ── _pruneDeadRoutes: stale badge cleanup after external route removal ─────

describe('LFOWidget._pruneDeadRoutes', () => {
  it('removes stale indicator when its route is deleted externally', () => {
    const slider = makeRange();
    const routeId = widget.connect(slider);
    expect(widget._indicators.has(routeId)).toBe(true);

    // Remove the route directly from the engine (simulating destroyLFO on target)
    engine.removeRoute(routeId);
    expect(engine.getRoute(routeId)).toBeUndefined();

    // Simulate a tick so the subscriber fires _pruneDeadRoutes
    flushRAF(16);
    flushRAF(32);

    expect(widget._indicators.has(routeId)).toBe(false);
    slider.remove();
  });

  it('fires onDisconnect when pruning a dead route', () => {
    const slider = makeRange();
    const onDisconnect = vi.fn();
    const c = makeContainer();
    const lid = engine.createLFO({});
    const w = new LFOWidget(c, lid, { color: '#123456', label: 'PruneTest', onDisconnect });
    const routeId = w.connect(slider);

    engine.removeRoute(routeId);
    flushRAF(16);
    flushRAF(32);

    expect(onDisconnect).toHaveBeenCalledWith(routeId);
    w.destroy();
    c.remove();
    slider.remove();
  });
});

// ── Drag-to-assign: pointercancel cleanup (M1) ────────────────────────────

describe('drag handle pointercancel', () => {
  it('removes the SVG wire overlay on pointercancel — no DOM leak', () => {
    const handle = widget.element.querySelector('.lfo-connect-handle');
    expect(handle).not.toBeNull();

    // Simulate pointerdown to start the drag (creates wire SVG)
    handle.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: 1, clientX: 50, clientY: 50,
    }));

    // The wire SVG should now be in the document
    expect(document.getElementById('lfo-drag-wire-svg')).not.toBeNull();

    // Simulate pointercancel — browser cancels the gesture (e.g. touch interrupted)
    handle.dispatchEvent(new PointerEvent('pointercancel', {
      bubbles: true, pointerId: 1,
    }));

    // Wire SVG must be removed from the DOM
    expect(document.getElementById('lfo-drag-wire-svg')).toBeNull();
  });
});

// ── ModIndicator construction ──────────────────────────────────────────────

describe('ModIndicator', () => {
  it('appends a badge element to document.body', () => {
    const slider = makeRange();
    const lid = engine.createLFO({});
    const routeId = engine.addRoute(lid, 'element', slider, null, { depth: 0.5 });
    const before = document.body.querySelectorAll('.lfo-mod-badge').length;
    const ind = new ModIndicator(slider, routeId, lid, '#ff0000', 'LFO X', () => {});
    const after = document.body.querySelectorAll('.lfo-mod-badge').length;
    expect(after).toBe(before + 1);
    ind.destroy();
    engine.removeRoute(routeId);
    engine.destroyLFO(lid);
    slider.remove();
  });

  it('destroy() removes the badge from document.body', () => {
    const slider = makeRange();
    const lid = engine.createLFO({});
    const routeId = engine.addRoute(lid, 'element', slider, null, { depth: 0.5 });
    const ind = new ModIndicator(slider, routeId, lid, '#ff0000', 'LFO X', () => {});
    ind.destroy();
    // Badge should be gone
    const badge = document.body.querySelector('.lfo-mod-badge');
    // May be null or other badges exist from other tests — just confirm this badge is detached
    expect(document.body.contains(ind._badge)).toBe(false);
    engine.removeRoute(routeId);
    engine.destroyLFO(lid);
    slider.remove();
  });

  it('exposes routeId getter', () => {
    const slider = makeRange();
    const lid = engine.createLFO({});
    const routeId = engine.addRoute(lid, 'element', slider, null, { depth: 0.5 });
    const ind = new ModIndicator(slider, routeId, lid, '#00ff00', 'LFO Y', () => {});
    expect(ind.routeId).toBe(routeId);
    ind.destroy();
    engine.removeRoute(routeId);
    engine.destroyLFO(lid);
    slider.remove();
  });
});
