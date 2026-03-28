/**
 * tests/engine.test.js — Unit tests for lfo-engine.js
 *
 * Covers: pure math functions, LFOEngine lifecycle, route management,
 * tick behaviour, and all bugs addressed in the review pass.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  seededRand, smoothRand, applySkew,
  SHAPE_FN, SHAPES,
  LFOEngine,
} from '../lfo-engine.js';

// ── Mock browser RAF APIs ──────────────────────────────────────────────────────
// jsdom provides requestAnimationFrame but it never fires automatically;
// we replace it with a manually-flushed queue for deterministic tests.

const rafQueue = new Map();
let _rafSeq = 0;

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(cb => {
    const id = ++_rafSeq;
    rafQueue.set(id, cb);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn(id => rafQueue.delete(id)));
});

/** Fire every pending RAF callback with the given timestamp (ms). */
function flushRAF(ts = 16) {
  const entries = [...rafQueue.entries()];
  rafQueue.clear();
  for (const [, cb] of entries) cb(ts);
}

// Each test gets a fresh engine; clear the queue so no stale callbacks leak.
let eng;
beforeEach(() => {
  rafQueue.clear();
  eng = new LFOEngine();
});
afterEach(() => {
  eng.stop();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRange(min, max, value) {
  const el = document.createElement('input');
  el.type = 'range';
  el.setAttribute('min',   String(min));
  el.setAttribute('max',   String(max));
  el.value = String(value);
  return el;
}

// ── Pure functions ─────────────────────────────────────────────────────────────

describe('seededRand', () => {
  it('is deterministic', () => {
    expect(seededRand(42)).toBe(seededRand(42));
    expect(seededRand(0)).toBe(seededRand(0));
    expect(seededRand(9999)).toBe(seededRand(9999));
  });

  it('returns values in [-1, 1]', () => {
    for (let i = 0; i < 200; i++) {
      const v = seededRand(i * 137 + 3);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('different seeds produce different values', () => {
    expect(seededRand(0)).not.toBe(seededRand(1));
    expect(seededRand(100)).not.toBe(seededRand(101));
  });
});

describe('smoothRand', () => {
  it('returns values in [-1, 1]', () => {
    for (let i = 0; i < 100; i++) {
      const v = smoothRand(7, i * 0.13);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('matches seededRand at integer phase boundaries', () => {
    const seed = 5;
    // At phase exactly = integer N, smoothRand interpolates between
    // seededRand(seed+N-1) and seededRand(seed+N) at t=1 → equals seededRand(seed+N).
    expect(smoothRand(seed, 1)).toBeCloseTo(seededRand(seed + 1), 10);
    expect(smoothRand(seed, 3)).toBeCloseTo(seededRand(seed + 3), 10);
  });
});

describe('applySkew', () => {
  it('is identity at skew=0.5', () => {
    for (const frac of [0, 0.1, 0.25, 0.5, 0.75, 0.99]) {
      expect(applySkew(frac, 0.5)).toBeCloseTo(frac, 10);
    }
  });

  it('midpoint shifts left for skew < 0.5', () => {
    // At frac = skew value, applySkew maps to exactly 0.5
    expect(applySkew(0.25, 0.25)).toBeCloseTo(0.5, 10);
  });

  it('midpoint shifts right for skew > 0.5', () => {
    expect(applySkew(0.75, 0.75)).toBeCloseTo(0.5, 10);
  });

  it('handles degenerate edge values without throwing', () => {
    expect(() => applySkew(0.5, 0)).not.toThrow();
    expect(() => applySkew(0.5, 1)).not.toThrow();
  });

  it('output stays in [0, 1) for inputs in [0, 1)', () => {
    for (const frac of [0, 0.1, 0.49, 0.5, 0.9, 0.99]) {
      const out = applySkew(frac, 0.3);
      expect(out).toBeGreaterThanOrEqual(0);
      expect(out).toBeLessThan(1);
    }
  });
});

describe('SHAPE_FN', () => {
  it('sine: correct values at quarter-cycle points', () => {
    expect(SHAPE_FN.sine(0)).toBeCloseTo(0, 10);
    expect(SHAPE_FN.sine(0.25)).toBeCloseTo(1, 10);
    expect(SHAPE_FN.sine(0.5)).toBeCloseTo(0, 10);
    expect(SHAPE_FN.sine(0.75)).toBeCloseTo(-1, 10);
  });

  it('triangle: reaches ±1 at quarter/three-quarter points', () => {
    expect(SHAPE_FN.triangle(0.25)).toBeCloseTo(1, 10);
    expect(SHAPE_FN.triangle(0.75)).toBeCloseTo(-1, 10);
    expect(SHAPE_FN.triangle(0)).toBeCloseTo(0, 5);
  });

  it('saw: rises from -1 to near +1 across one cycle', () => {
    expect(SHAPE_FN.saw(0)).toBeCloseTo(-1, 5);
    expect(SHAPE_FN.saw(0.5)).toBeCloseTo(0, 5);
    expect(SHAPE_FN.saw(0.999)).toBeCloseTo(1, 2);
  });

  it('square: only produces ±1', () => {
    for (let p = 0.001; p < 1; p += 0.01) {
      expect(Math.abs(SHAPE_FN.square(p))).toBe(1);
    }
  });

  it('SHAPES array contains all shape keys', () => {
    for (const name of ['sine', 'triangle', 'saw', 'rsaw', 'square']) {
      expect(SHAPES).toContain(name);
      expect(typeof SHAPE_FN[name]).toBe('function');
    }
    expect(SHAPES).toContain('random');
    expect(SHAPES).toContain('smooth');
  });
});

// ── LFOEngine ──────────────────────────────────────────────────────────────────

describe('LFOEngine.createLFO', () => {
  it('returns a namespaced string id', () => {
    const id = eng.createLFO();
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^lfo_/);
  });

  it('each call returns a unique id', () => {
    const id1 = eng.createLFO();
    const id2 = eng.createLFO();
    expect(id1).not.toBe(id2);
  });

  it('applies default parameter values', () => {
    const id = eng.createLFO();
    expect(eng.getParam(id, 'shape')).toBe('sine');
    expect(eng.getParam(id, 'baseRate')).toBe(1);
    expect(eng.getParam(id, 'baseDepth')).toBe(1);
    expect(eng.getParam(id, 'bipolar')).toBe(true);
    expect(eng.getParam(id, 'jitter')).toBe(0);
    expect(eng.getParam(id, 'skew')).toBe(0.5);
  });

  it('applies custom options', () => {
    const id = eng.createLFO({ shape: 'square', rate: 2.5, depth: 0.3, bipolar: false });
    expect(eng.getParam(id, 'shape')).toBe('square');
    expect(eng.getParam(id, 'baseRate')).toBe(2.5);
    expect(eng.getParam(id, 'baseDepth')).toBe(0.3);
    expect(eng.getParam(id, 'bipolar')).toBe(false);
  });

  it('starts the RAF loop', () => {
    vi.clearAllMocks();
    eng.createLFO();
    expect(requestAnimationFrame).toHaveBeenCalled();
    expect(eng._running).toBe(true);
  });
});

describe('LFOEngine.destroyLFO', () => {
  it('removes the LFO', () => {
    const id = eng.createLFO();
    eng.destroyLFO(id);
    expect(eng.getLFO(id)).toBeUndefined();
  });

  it('removes all routes originating from the destroyed LFO', () => {
    const id = eng.createLFO();
    const el = makeRange(0, 1, 0.5);
    const routeId = eng.addRoute(id, 'element', el, null);
    eng.destroyLFO(id);
    expect(eng.getRoute(routeId)).toBeUndefined();
  });

  it('stops the engine when the last LFO is destroyed (H5)', () => {
    const id1 = eng.createLFO();
    const id2 = eng.createLFO();
    expect(eng._running).toBe(true);
    eng.destroyLFO(id1);
    expect(eng._running).toBe(true);  // one LFO remains
    eng.destroyLFO(id2);
    expect(eng._running).toBe(false); // all gone
  });

  it('engine keeps running if LFOs remain', () => {
    const id1 = eng.createLFO();
    eng.createLFO();
    eng.destroyLFO(id1);
    expect(eng._running).toBe(true);
  });
});

describe('LFOEngine.setParam / getParam', () => {
  it('sets and retrieves an arbitrary param', () => {
    const id = eng.createLFO();
    eng.setParam(id, 'shape', 'saw');
    expect(eng.getParam(id, 'shape')).toBe('saw');
  });

  it('syncs rate → baseRate', () => {
    const id = eng.createLFO({ rate: 1 });
    eng.setParam(id, 'rate', 3);
    expect(eng.getParam(id, 'baseRate')).toBe(3);
  });

  it('syncs depth → baseDepth', () => {
    const id = eng.createLFO({ depth: 1 });
    eng.setParam(id, 'depth', 0.4);
    expect(eng.getParam(id, 'baseDepth')).toBe(0.4);
  });

  it('syncs baseRate → rate (M2)', () => {
    const id = eng.createLFO({ rate: 1 });
    eng.setParam(id, 'baseRate', 5);
    expect(eng.getParam(id, 'rate')).toBe(5);
  });

  it('syncs baseDepth → depth (M2)', () => {
    const id = eng.createLFO({ depth: 1 });
    eng.setParam(id, 'baseDepth', 0.7);
    expect(eng.getParam(id, 'depth')).toBe(0.7);
  });

  it('does nothing silently for an unknown lfoId', () => {
    expect(() => eng.setParam('nonexistent_id', 'rate', 1)).not.toThrow();
  });

  it('getParam returns undefined for unknown lfoId', () => {
    expect(eng.getParam('nonexistent_id', 'rate')).toBeUndefined();
  });
});

describe('LFOEngine.addRoute', () => {
  it('returns a string routeId for element routes', () => {
    const id = eng.createLFO();
    const el = makeRange(0, 1, 0.5);
    const routeId = eng.addRoute(id, 'element', el, null);
    expect(typeof routeId).toBe('string');
    expect(eng.getRoute(routeId)).toBeTruthy();
  });

  it('returns null for self-modulation', () => {
    const id = eng.createLFO();
    expect(eng.addRoute(id, 'lfo', id, 'rate')).toBeNull();
  });

  it('creates and populates elementState on first route', () => {
    const id = eng.createLFO();
    const el = makeRange(10, 100, 50);
    eng.addRoute(id, 'element', el, null);
    const meta = eng.getElementMeta(el);
    expect(meta).toBeTruthy();
    expect(meta.min).toBe(10);
    expect(meta.max).toBe(100);
    expect(meta.baseValue).toBe(50);
  });

  it('uses default depth 0.5', () => {
    const id = eng.createLFO();
    const el = makeRange(0, 1, 0.5);
    const routeId = eng.addRoute(id, 'element', el, null);
    expect(eng.getRoute(routeId).depth).toBe(0.5);
  });

  it('accepts custom depth via opts', () => {
    const id = eng.createLFO();
    const el = makeRange(0, 1, 0.5);
    const routeId = eng.addRoute(id, 'element', el, null, { depth: 0.8 });
    expect(eng.getRoute(routeId).depth).toBe(0.8);
  });
});

describe('LFOEngine.removeRoute', () => {
  it('removes the route', () => {
    const id = eng.createLFO();
    const el = makeRange(0, 1, 0.5);
    const routeId = eng.addRoute(id, 'element', el, null);
    eng.removeRoute(routeId);
    expect(eng.getRoute(routeId)).toBeUndefined();
  });

  it('cleans up elementState when the last route to an element is removed', () => {
    const id = eng.createLFO();
    const el = makeRange(0, 1, 0.5);
    const r1 = eng.addRoute(id, 'element', el, null);
    const r2 = eng.addRoute(id, 'element', el, null);
    expect(eng.getElementMeta(el)).toBeTruthy();
    eng.removeRoute(r1);
    expect(eng.getElementMeta(el)).toBeTruthy(); // r2 still active
    eng.removeRoute(r2);
    expect(eng.getElementMeta(el)).toBeUndefined();
  });

  it('is a no-op for an unknown routeId', () => {
    expect(() => eng.removeRoute('no_such_route')).not.toThrow();
  });
});

describe('LFOEngine.setRouteDepth', () => {
  it('updates route depth', () => {
    const id = eng.createLFO();
    const routeId = eng.addRoute(id, 'element', makeRange(0, 1, 0.5), null);
    eng.setRouteDepth(routeId, 0.8);
    expect(eng.getRoute(routeId).depth).toBe(0.8);
  });

  it('clamps depth to [0, 1]', () => {
    const id = eng.createLFO();
    const routeId = eng.addRoute(id, 'element', makeRange(0, 1, 0.5), null);
    eng.setRouteDepth(routeId, 1.5);
    expect(eng.getRoute(routeId).depth).toBe(1);
    eng.setRouteDepth(routeId, -0.3);
    expect(eng.getRoute(routeId).depth).toBe(0);
  });
});

describe('LFOEngine._tick', () => {
  it('dt=0 on the very first tick: phase does not advance', () => {
    const id = eng.createLFO({ rate: 1 });
    const lfo = eng._lfos.get(id);
    const phaseBefore = lfo.currentPhase;
    flushRAF(100);
    expect(lfo.currentPhase).toBe(phaseBefore);
  });

  it('phase advances proportionally to dt on subsequent ticks', () => {
    // The engine caps dt at 0.1s per tick to survive tab backgrounding.
    // Use a step within the cap so phase = rate × dt exactly.
    const id = eng.createLFO({ rate: 1 });
    const lfo = eng._lfos.get(id);
    flushRAF(0);   // first tick, dt=0, _lastTs=0
    flushRAF(100); // dt=0.1s (within 0.1s cap) → phase += 1 × 0.1 = 0.1
    expect(lfo.currentPhase).toBeCloseTo(0.1, 5);
  });

  it('applies element route: value moves off the base', () => {
    const id = eng.createLFO({ rate: 1, shape: 'sine', depth: 1, bipolar: true });
    const el = makeRange(0, 100, 50);
    eng.addRoute(id, 'element', el, null, { depth: 1 });
    flushRAF(0);
    flushRAF(250); // sine at 0.25 phase ≈ 1 → val = 50 + 1*1*100*0.5 = 100
    expect(parseFloat(el.value)).toBeGreaterThan(50);
  });

  it('clamps element value to [min, max]', () => {
    const id = eng.createLFO({ rate: 1, shape: 'sine', depth: 1 });
    const el = makeRange(0, 10, 10); // base at max; positive swing would exceed max
    eng.addRoute(id, 'element', el, null, { depth: 1 });
    flushRAF(0);
    flushRAF(250);
    expect(parseFloat(el.value)).toBeLessThanOrEqual(10);
    expect(parseFloat(el.value)).toBeGreaterThanOrEqual(0);
  });

  it('disabled route: element value does not change', () => {
    const id = eng.createLFO({ rate: 1, shape: 'sine', depth: 1 });
    const el = makeRange(0, 100, 50);
    const routeId = eng.addRoute(id, 'element', el, null, { depth: 1 });
    eng.setRouteEnabled(routeId, false);
    flushRAF(0);
    flushRAF(250);
    expect(el.value).toBe('50');
  });

  it('chain route modulates target LFO effective rate', () => {
    const srcId = eng.createLFO({ rate: 1, shape: 'sine', depth: 1 });
    const tgtId = eng.createLFO({ rate: 2 });
    eng.addRoute(srcId, 'lfo', tgtId, 'rate', { depth: 0.5 });
    // Three ticks: t=0 (dt=0), t=250ms (src advances → ≈1), t=500ms (chain uses src≈1)
    flushRAF(0);
    flushRAF(250);
    flushRAF(500);
    const tgt = eng._lfos.get(tgtId);
    // effective rate = 2 × (1 + 1 × 0.5) = 3
    expect(tgt.rate).toBeGreaterThan(2);
  });

  it('effective rate resets to baseRate each tick (chain does not accumulate)', () => {
    // The invariant: each tick, tgt.rate is reset to baseRate before chain
    // modulation is applied. Disabling the route must restore it to exactly baseRate.
    const srcId = eng.createLFO({ rate: 1, shape: 'sine', depth: 1 });
    const tgtId = eng.createLFO({ rate: 2 });
    const routeId = eng.addRoute(srcId, 'lfo', tgtId, 'rate', { depth: 0.5 });
    // Advance a few ticks so src is positive and tgt.rate drifts above base
    flushRAF(0);
    flushRAF(100);
    flushRAF(200);
    flushRAF(300);
    expect(eng._lfos.get(tgtId).rate).toBeGreaterThan(2); // chain is active
    // Disable the route — next tick must reset rate to exactly baseRate
    eng.setRouteEnabled(routeId, false);
    flushRAF(400);
    expect(eng._lfos.get(tgtId).rate).toBe(2);
  });
});

describe('LFOEngine.subscribe / unsubscribe', () => {
  it('subscriber is called on each tick', () => {
    const id = eng.createLFO();
    const seen = new Set();
    eng.subscribe((lfoId) => seen.add(lfoId));
    flushRAF(0);
    expect(seen.has(id)).toBe(true);
  });

  it('subscriber receives current LFO value', () => {
    const id = eng.createLFO({ rate: 1, shape: 'sine' });
    let lastValue = null;
    eng.subscribe((lfoId, value) => { if (lfoId === id) lastValue = value; });
    flushRAF(0);
    expect(typeof lastValue).toBe('number');
  });

  it('unsubscribe stops delivery', () => {
    const id = eng.createLFO();
    const calls = [];
    const unsub = eng.subscribe((lfoId) => calls.push(lfoId));
    flushRAF(0);
    const countBefore = calls.length;
    unsub();
    flushRAF(500);
    expect(calls.length).toBe(countBefore);
  });
});

describe('LFOEngine inspection helpers', () => {
  it('getLFOs returns all LFO state objects', () => {
    const id1 = eng.createLFO();
    const id2 = eng.createLFO();
    const lfos = eng.getLFOs();
    expect(lfos.map(l => l.id)).toContain(id1);
    expect(lfos.map(l => l.id)).toContain(id2);
  });

  it('getAllRoutes returns all routes', () => {
    const id = eng.createLFO();
    const el = makeRange(0, 1, 0.5);
    eng.addRoute(id, 'element', el, null);
    expect(eng.getAllRoutes().length).toBeGreaterThanOrEqual(1);
  });

  it('getRoutesByElement returns routes for a specific element', () => {
    const id = eng.createLFO();
    const el = makeRange(0, 1, 0.5);
    const routeId = eng.addRoute(id, 'element', el, null);
    const routes = eng.getRoutesByElement(el);
    expect(routes.map(r => r.id)).toContain(routeId);
  });
});

describe('Jitter determinism (M3)', () => {
  it('produces identical jitterRateMult for same seed at same cycle', () => {
    const e1 = new LFOEngine();
    const e2 = new LFOEngine();
    const id1 = e1.createLFO({ rate: 4, jitter: 1 });
    const id2 = e2.createLFO({ rate: 4, jitter: 1 });

    // Force identical seeds
    e1._lfos.get(id1).seed = 12345;
    e2._lfos.get(id2).seed = 12345;

    // Advance both engines by the same wall-clock timestamps
    flushRAF(0);
    flushRAF(400); // ~1.6 cycles at 4Hz — enough to trigger a jitter sample

    const mult1 = e1._lfos.get(id1).jitterRateMult;
    const mult2 = e2._lfos.get(id2).jitterRateMult;

    expect(mult1).toBe(mult2);
    expect(mult1).not.toBe(1); // jitter should have fired

    e1.stop();
    e2.stop();
  });
});
