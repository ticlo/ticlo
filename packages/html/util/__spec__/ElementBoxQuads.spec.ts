import {vi} from 'vitest';
import {getElementBoxQuads, getElementGeometry} from '../ElementBoxQuads.ts';

describe('getElementBoxQuads', () => {
  let host: HTMLDivElement;
  let stage: HTMLDivElement;

  function box(parent: HTMLElement, css = '') {
    const element = document.createElement('div');
    element.style.cssText = `position: relative; width: 200px; height: 150px; ${css}`;
    parent.appendChild(element);
    return element;
  }

  beforeEach(() => {
    host = document.createElement('div');
    host.style.cssText = 'position: absolute; left: 31px; top: 47px;';
    document.body.appendChild(host);
    stage = box(host, 'width: 600px; height: 400px;');
  });

  afterEach(() => {
    host.remove();
    vi.restoreAllMocks();
  });

  function points(quad: DOMQuad) {
    return [quad.p1, quad.p2, quad.p3, quad.p4];
  }

  // Test-only zero-size markers let the browser independently project each
  // border corner. Production measurement never inserts any elements.
  function expectCorners(element: HTMLElement, tolerance = 0.02, viewport = false) {
    const quad = viewport
      ? getElementGeometry([element]).get(element)?.quad
      : getElementBoxQuads([element], stage).get(element);
    expect(quad).toBeInstanceOf(DOMQuad);
    const style = getComputedStyle(element);
    const borderLeft = parseFloat(style.borderLeftWidth);
    const borderTop = parseFloat(style.borderTopWidth);
    let width = parseFloat(style.width);
    let height = parseFloat(style.height);
    if (style.boxSizing !== 'border-box') {
      width +=
        borderLeft +
        parseFloat(style.borderRightWidth) +
        parseFloat(style.paddingLeft) +
        parseFloat(style.paddingRight);
      height +=
        borderTop +
        parseFloat(style.borderBottomWidth) +
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom);
    }
    const origin = viewport ? {x: 0, y: 0} : stage.getBoundingClientRect();
    const markers = [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ].map(([x, y]) => {
      const marker = document.createElement('div');
      marker.style.cssText = `position:absolute;left:${x - borderLeft}px;top:${y - borderTop}px;width:0;height:0;`;
      element.appendChild(marker);
      return marker;
    });
    try {
      const actual = markers.map((marker) => marker.getBoundingClientRect());
      points(quad).forEach((point, i) => {
        expect(Math.abs(point.x - (actual[i].x - origin.x))).toBeLessThan(tolerance);
        expect(Math.abs(point.y - (actual[i].y - origin.y))).toBeLessThan(tolerance);
      });
    } finally {
      markers.forEach((marker) => marker.remove());
    }
  }

  it('projects rotated/scaled siblings and reuses ancestors across different branches', () => {
    const common = box(stage, 'left: 15px; top: 20px; transform: scale(1.2, .8) rotate(15deg);');
    const first = box(common, 'left: 20px; top: 15px; transform: rotate(-20deg);');
    const second = box(common, 'left: 10px; top: -50px; transform: skewX(10deg);');
    const a = box(first, 'position:absolute;left:12px;top:23px;transform:rotate(30deg);');
    const b = box(first, 'position:absolute;left:80px;top:50px;');
    const c = box(second, 'position:absolute;left:15px;top:17px;scale: .7 1.3;');
    for (const element of [a, b, c]) expectCorners(element);
    const read = vi.spyOn(window, 'getComputedStyle');
    const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect');
    const mutations = new MutationObserver(() => {});
    mutations.observe(stage, {subtree: true, childList: true, attributes: true});
    const result = getElementBoxQuads([a, b, c, a], stage);
    expect([...result.keys()]).toEqual([a, b, c]);
    expect(read.mock.calls.map(([element]) => element)).toEqual([stage, common, first, a, b, second, c]);
    expect(bounds).not.toHaveBeenCalled();
    expect(mutations.takeRecords()).toEqual([]);
    mutations.disconnect();
  });

  it('reads shared parents once for a large sibling batch', () => {
    let parent = stage;
    const ancestors = [stage];
    for (let i = 0; i < 10; ++i) {
      parent = box(parent, 'transform: translate(2px, 3px);');
      ancestors.push(parent);
    }
    const children = Array.from({length: 100}, (_, i) => box(parent, `position:absolute;left:${i}px;top:${i}px;`));
    const read = vi.spyOn(window, 'getComputedStyle');
    const result = getElementBoxQuads(children, stage);
    expect(result.size).toBe(100);
    expect([...result.values()].every(Boolean)).toBe(true);
    expect(read).toHaveBeenCalledTimes(ancestors.length + children.length);
    for (const ancestor of ancestors)
      expect(read.mock.calls.filter(([element]) => element === ancestor)).toHaveLength(1);
  });

  it('handles skipped static offset parents, borders, padding, and nested scrolling', () => {
    stage.style.border = '5px solid';
    stage.style.padding = '10px';
    const scroller = box(stage, 'overflow: auto; width: 180px; height: 100px; border:3px solid; padding:7px;');
    const intermediate = box(scroller, 'position:static; margin:11px; width:400px; height:300px;');
    const target = box(intermediate, 'position:absolute;left:120px;top:90px; width:250px;height:180px;');
    scroller.scrollLeft = 30;
    scroller.scrollTop = 20;
    stage.scrollLeft = 5;
    stage.scrollTop = 7;
    expect(target.offsetParent).toBe(scroller);
    expectCorners(target);
  });

  it('ignores intervening static scrollers below an absolute containing block', () => {
    const scroller = box(stage, 'position:static;overflow:auto;width:100px;height:70px;');
    const spacer = box(scroller, 'width:500px;height:400px;position:static;');
    const target = box(spacer, 'position:absolute;left:25px;top:35px;');
    scroller.scrollLeft = 20;
    scroller.scrollTop = 130;
    expectCorners(target);
  });

  it('handles fixed positioning inside a transformed scroller and sticky positioning', () => {
    const scroller = box(stage, 'overflow:auto;width:100px;height:70px;transform:translate(0);');
    box(scroller, 'width:500px;height:400px;');
    const fixed = box(scroller, 'position:fixed;left:25px;top:35px;');
    const sticky = box(scroller, 'position:sticky;left:0;top:0;margin-top:100px;');
    scroller.scrollLeft = 20;
    scroller.scrollTop = 430;
    expectCorners(fixed);
    expectCorners(sticky);
  });

  it.each(['display:flex;gap:10px;align-items:center;', 'display:grid;grid-template-columns:80px 1fr;gap:10px;'])(
    'uses native layout offsets for custom layouts: %s',
    (layout) => {
      const parent = box(stage, layout);
      box(parent, 'width:60px;height:40px;');
      const target = box(parent, 'width:100px;height:60px;transform:rotate(25deg);');
      expectCorners(target, 0.6);
    }
  );

  it('uses fractional border-box sizes and percentage/calc individual transforms', () => {
    const parent = box(stage, 'transform:scale(2) rotate(30deg);');
    const target = box(
      parent,
      'position:absolute;left:20.25px;top:30.5px;width:100.4px;height:60.6px;border:2px solid;padding:3px;' +
        'translate:calc(50% + 3px) 25%;rotate:20deg;scale:.8 1.2;transform:skewY(5deg);'
    );
    expectCorners(target);
    target.style.boxSizing = 'border-box';
    expectCorners(target);
  });

  it('resolves right/bottom anchoring with border, padding, and zoom', () => {
    const parent = box(stage, 'border:3px solid;padding:7px;zoom:2;');
    const target = box(parent, 'position:absolute;right:20.25px;bottom:30.5px;width:50px;height:40px;zoom:1.5;');
    expectCorners(target, 0.6);
  });

  it('accounts for nested zoom, including a zoomed child of a static parent', () => {
    const parent = box(stage, 'zoom:1.5; margin:10px; border:3px solid; padding:7px;');
    const target = box(parent, 'position:absolute;left:20.25px;top:30.5px;zoom:2;transform:rotate(25deg);');
    expectCorners(target, 0.6);
    parent.style.position = 'static';
    expectCorners(target, 0.6);
  });

  it('maps viewport geometry and position changes through every ancestor without probes', () => {
    host.style.zoom = '1.5';
    host.style.transform = 'scale(1.2, .8) rotate(15deg)';
    stage.style.zoom = '1.25';
    const target = box(stage, 'position:absolute;left:20px;top:30px;zoom:2;transform:rotate(25deg);');
    const geometry = getElementGeometry([target]).get(target);
    const before = target.getBoundingClientRect();
    const bounds = geometry.quad.getBounds();
    // Computed transform serialization rounds coefficients, so large projected
    // boxes need the same subpixel tolerance as the corner-marker fixtures.
    expect(bounds.left).toBeCloseTo(before.left, 2);
    expect(bounds.top).toBeCloseTo(before.top, 2);
    expect(bounds.width).toBeCloseTo(before.width, 2);
    target.style.left = '28px';
    target.style.top = '42px';
    const after = target.getBoundingClientRect();
    expect(after.left - before.left).toBeCloseTo(geometry.positionMatrix.a * 8 + geometry.positionMatrix.c * 12, 3);
    expect(after.top - before.top).toBeCloseTo(geometry.positionMatrix.b * 8 + geometry.positionMatrix.d * 12, 3);
    expect(geometry.transform).toBeInstanceOf(DOMMatrix);
  });

  it('projects viewport corners through nested 3D transforms and perspective', () => {
    host.style.transform = 'perspective(700px) rotateY(15deg)';
    host.style.transformStyle = 'preserve-3d';
    stage.style.transform = 'rotateX(20deg)';
    stage.style.transformStyle = 'preserve-3d';
    const target = box(stage, 'position:absolute;left:20px;top:30px;transform:rotateY(25deg) translateZ(30px);');
    expectCorners(target, 0.03, true);
  });

  it('includes document-element zoom/transforms and document scrolling in viewport coordinates', () => {
    const html = document.documentElement;
    const savedStyle = html.style.cssText;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const spacer = document.createElement('div');
    spacer.style.height = '2000px';
    document.body.appendChild(spacer);
    try {
      html.style.zoom = '1.25';
      html.style.transform = 'translate(7px,11px)';
      window.scrollTo(0, 80);
      const target = box(stage, 'position:absolute;left:20px;top:30px;transform:rotate(25deg);');
      expectCorners(target, 0.03, true);
    } finally {
      html.style.cssText = savedStyle;
      spacer.remove();
      window.scrollTo(scrollX, scrollY);
    }
  });

  it('keeps position matrices available for zero-sized static parents and excludes child transforms from movement', () => {
    stage.style.transform = 'scale(2,3)';
    const parent = box(stage, 'position:static;width:0;height:0;');
    const target = box(parent, 'position:absolute;left:20px;top:30px;transform:scale(4) rotate(25deg);');
    const geometry = getElementGeometry([target], stage).get(target);
    expect(geometry.positionMatrix.a).toBe(1);
    expect(geometry.positionMatrix.d).toBe(1);
    const viewport = getElementGeometry([target]).get(target);
    expect(viewport.positionMatrix.a).toBe(2);
    expect(viewport.positionMatrix.d).toBe(3);
  });

  it.each(['flat', 'preserve-3d'])('supports parent perspective with transform-style %s', (transformStyle) => {
    const parent = box(
      stage,
      `left:20px;top:30px; perspective:500px; perspective-origin:20% 70%; transform-style:${transformStyle};`
    );
    const target = box(
      parent,
      'position:absolute;left:25px;top:35px;transform:translateZ(40px) rotateY(45deg);transform-origin:30% 70% 10px;'
    );
    expectCorners(target);
  });

  it('supports individual 3D translation, axis-angle rotation, and scale', () => {
    const parent = box(stage, 'perspective:600px;transform-style:preserve-3d;');
    const target = box(
      parent,
      'position:absolute;left:20px;top:30px;translate:5px 10px 30px;rotate:x 45deg;scale:1.2 .8 1.5;'
    );
    expectCorners(target);
    target.style.rotate = '1 2 3 35deg';
    expectCorners(target);
  });

  it.each(['', 'opacity:.5;', 'overflow:hidden;', 'filter:blur(0);', 'isolation:isolate;'])(
    'respects flattening in a nested 3D scene: %s',
    (grouping) => {
      const scene = box(stage, 'perspective:600px;transform-style:preserve-3d;');
      const parent = box(scene, `left:20px;top:30px;transform:rotateY(30deg);transform-style:preserve-3d;${grouping}`);
      const target = box(parent, 'position:absolute;left:25px;top:35px;transform:rotateX(30deg);');
      expectCorners(target);
    }
  );

  it('returns null for descendants across an ambiguous 3D paint containment boundary', () => {
    const scene = box(stage, 'perspective:600px;transform-style:preserve-3d;');
    const parent = box(scene, 'transform:rotateY(30deg);transform-style:preserve-3d;contain:paint;');
    const target = box(parent, 'transform:rotateX(30deg);');
    const measured = getElementBoxQuads([parent, target], stage);
    expect(measured.get(parent)).toBeInstanceOf(DOMQuad);
    expect(measured.get(target)).toBeNull();
  });

  it('flattens a plain wrapper between a perspective scene and a 3D child', () => {
    const scene = box(stage, 'perspective:600px;transform-style:preserve-3d;');
    const parent = box(scene);
    const target = box(parent, 'position:absolute;left:25px;top:35px;transform:rotateY(35deg) translateZ(30px);');
    expectCorners(target);
  });

  it.each(['absolute', 'fixed'])('uses a static preserve-3d parent as a %s containing block', (position) => {
    const parent = box(stage, 'position:static;margin:20px;transform-style:preserve-3d;');
    const target = box(parent, `position:${position};left:25px;top:35px;`);
    expectCorners(target);
  });

  it('excludes root and external transforms without reading ancestors above root', () => {
    const parent = box(stage, 'left:10px;top:20px;transform:rotate(25deg);');
    const target = box(parent, 'position:absolute;left:20px;top:30px;');
    const before = getElementBoxQuads([target, stage], stage);
    host.style.transform = 'perspective(500px) rotateY(35deg)';
    host.style.zoom = '1.5';
    stage.style.transform = 'rotate(20deg)';
    stage.style.zoom = '2';
    stage.style.transformBox = 'content-box';
    stage.style.offsetPath = 'path("M0,0 L100,100")';
    const read = vi.spyOn(window, 'getComputedStyle');
    const after = getElementBoxQuads([target, stage], stage);
    for (const element of [target, stage]) {
      points(after.get(element)).forEach((point, i) => {
        expect(point.x).toBeCloseTo(points(before.get(element))[i].x, 3);
        expect(point.y).toBeCloseTo(points(before.get(element))[i].y, 3);
      });
    }
    expect(read.mock.calls.map(([element]) => element)).toEqual([stage, parent, target]);
  });

  it('takes fresh snapshots and returns null for unavailable or unsupported geometry', () => {
    const target = box(stage, 'position:absolute;left:20px;top:30px;');
    const before = getElementBoxQuads([target], stage).get(target);
    target.style.left = '50px';
    const after = getElementBoxQuads([target], stage).get(target);
    expect(after.p1.x - before.p1.x).toBe(30);
    target.style.display = 'none';
    const detached = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    stage.appendChild(svg);
    expect(getElementBoxQuads([target, detached, host, svg], stage)).toEqual(
      new Map<Element, DOMQuad | null>([
        [target, null],
        [detached, null],
        [host, null],
        [svg, null],
      ])
    );
    expect(getElementBoxQuads([], stage)).toEqual(new Map());
    target.style.display = '';
    target.style.offsetPath = 'path("M0,0 L100,100")';
    expect(getElementBoxQuads([target], stage).get(target)).toBeNull();
    target.style.offsetPath = '';
    target.style.transformBox = 'content-box';
    target.style.transform = 'rotate(25deg)';
    expect(getElementBoxQuads([target], stage).get(target)).toBeNull();
    target.style.transformBox = '';
    target.style.transform = '';
    target.style.display = 'inline';
    target.style.position = 'static';
    expect(getElementBoxQuads([target], stage).get(target)).toBeNull();
    target.style.display = '';
    target.style.position = 'fixed';
    expect(getElementBoxQuads([target], stage).get(target)).toBeNull();
    stage.style.transform = 'translate(0)';
    expect(getElementBoxQuads([target], stage).get(target)).toBeInstanceOf(DOMQuad);
    stage.style.perspective = '100px';
    target.style.transform = 'translateZ(110px)';
    expect(getElementBoxQuads([target], stage).get(target)).toBeNull();
    host.style.display = 'none';
    expect(getElementBoxQuads([stage, target], stage)).toEqual(
      new Map([
        [stage, null],
        [target, null],
      ])
    );
    host.remove();
    expect(getElementBoxQuads([stage, target], stage)).toEqual(
      new Map([
        [stage, null],
        [target, null],
      ])
    );
  });
});
