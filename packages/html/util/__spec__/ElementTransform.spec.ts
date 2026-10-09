import {vi} from 'vitest';
import {getChildrenScreenCTM} from '../ElementTransform.ts';

describe('getChildrenScreenCTM', () => {
  let host: HTMLDivElement;
  let parent: HTMLDivElement;
  let child: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    host.style.cssText = 'position: absolute; left: 31px; top: 47px; width: 600px; height: 400px;';
    parent = document.createElement('div');
    parent.style.cssText = 'position: relative; width: 200px; height: 100px;';
    child = document.createElement('div');
    child.style.cssText = 'position: absolute; left: 10px; top: 20px; width: 30px; height: 10px;';
    parent.appendChild(child);
    host.appendChild(parent);
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
    vi.restoreAllMocks();
  });

  function expectMovement(matrix: DOMMatrix, dx: number, dy: number) {
    const before = child.getBoundingClientRect();
    child.style.left = `${parseFloat(child.style.left) + dx}px`;
    child.style.top = `${parseFloat(child.style.top) + dy}px`;
    const after = child.getBoundingClientRect();
    expect(after.x - before.x).toBeCloseTo(matrix.a * dx + matrix.c * dy, 4);
    expect(after.y - before.y).toBeCloseTo(matrix.b * dx + matrix.d * dy, 4);
  }

  it('maps position and movement through nested zoom and fractional X/Y scales', () => {
    host.style.zoom = '1.5';
    host.style.transform = 'scale(1.2, .8)';
    parent.style.zoom = '1.25';
    parent.style.border = '3px solid';
    parent.style.padding = '7px';
    const matrix = getChildrenScreenCTM(parent);
    expect(matrix).toBeInstanceOf(DOMMatrix);
    expect(matrix.a).toBeCloseTo(2.25, 5);
    expect(matrix.d).toBeCloseTo(1.5, 5);
    const point = new DOMPoint(10, 20).matrixTransform(matrix);
    const bounds = child.getBoundingClientRect();
    expect(point.x).toBeCloseTo(bounds.x, 4);
    expect(point.y).toBeCloseTo(bounds.y, 4);
    expectMovement(matrix, 8, 12);
  });

  it('converts movement through ancestor rotation and standalone scale/rotate', () => {
    host.style.transform = 'scale(1.5, .75) rotate(15deg)';
    parent.style.rotate = '30deg';
    parent.style.scale = '1.2 .8';
    const matrix = getChildrenScreenCTM(parent);
    expect(Math.abs(matrix.b)).toBeGreaterThan(0.1);
    expect(Math.abs(matrix.c)).toBeGreaterThan(0.1);
    expectMovement(matrix, 8, 12);
    const inverse = matrix.inverse();
    const dx = matrix.a * 8 + matrix.c * 12;
    const dy = matrix.b * 8 + matrix.d * 12;
    expect(inverse.a * dx + inverse.c * dy).toBeCloseTo(8, 5);
    expect(inverse.b * dx + inverse.d * dy).toBeCloseTo(12, 5);
  });

  it('excludes the child transform and measures zero-sized, static parents', () => {
    host.style.zoom = '1.5';
    host.style.transform = 'scale(1.2, .8)';
    parent.style.cssText = 'position: static; width: 0; height: 0; zoom: 1.25;';
    child.style.transform = 'scale(2) rotate(25deg)';
    expect(child.offsetParent).toBe(host);
    const matrix = getChildrenScreenCTM(parent);
    expect(matrix.a).toBeCloseTo(2.25, 5);
    expect(matrix.d).toBeCloseTo(1.5, 5);
    expectMovement(matrix, 8, 12);
  });

  it('returns fresh snapshots without retaining probes or cached transforms', () => {
    const children = [...parent.childNodes];
    const first = getChildrenScreenCTM(parent);
    expect([...parent.childNodes]).toEqual(children);
    parent.style.transform = 'scale(2, 3)';
    const second = getChildrenScreenCTM(parent);
    expect(second).not.toBe(first);
    expect(first.a).toBe(1);
    expect(first.d).toBe(1);
    expect(second.a).toBe(2);
    expect(second.d).toBe(3);
    expect([...parent.childNodes]).toEqual(children);
  });

  it('isolates the probe from application styles applied to children', () => {
    const style = document.createElement('style');
    style.textContent = '.transform-probe-test > * { transform: scale(9) !important; zoom: 4 !important; }';
    host.appendChild(style);
    parent.className = 'transform-probe-test';
    parent.style.transform = 'scale(2, 3)';
    const matrix = getChildrenScreenCTM(parent);
    expect(matrix.a).toBe(2);
    expect(matrix.d).toBe(3);
  });

  it('returns null for a disconnected parent or an unavailable matrix', () => {
    host.remove();
    expect(getChildrenScreenCTM(parent)).toBeNull();
    document.body.appendChild(host);
    vi.spyOn(SVGSVGElement.prototype, 'getScreenCTM').mockReturnValue(null);
    expect(getChildrenScreenCTM(parent)).toBeNull();
    expect([...parent.childNodes]).toEqual([child]);
  });

  it('removes the probe when measuring throws', () => {
    const error = new Error('Matrix unavailable');
    vi.spyOn(SVGSVGElement.prototype, 'getScreenCTM').mockImplementation(() => {
      throw error;
    });
    expect(() => getChildrenScreenCTM(parent)).toThrow(error);
    expect([...parent.childNodes]).toEqual([child]);
  });

  it('keeps all unique parents probed throughout batch measurement', () => {
    host.style.zoom = '1.5';
    parent.style.transform = 'scale(2, 3)';
    const before = [host, parent].map((element) => [...element.childNodes]);
    const expected = [host, parent].map((element) => getChildrenScreenCTM(element).toString());
    const getScreenCTM = SVGSVGElement.prototype.getScreenCTM;
    const read = vi.spyOn(SVGSVGElement.prototype, 'getScreenCTM').mockImplementation(function () {
      expect(host.querySelectorAll(':scope > svg')).toHaveLength(1);
      expect(parent.querySelectorAll(':scope > svg')).toHaveLength(1);
      return getScreenCTM.call(this);
    });
    const matrices = getChildrenScreenCTM([host, parent, host] as const);
    expect([...matrices.keys()]).toEqual([host, parent]);
    expect(read).toHaveBeenCalledTimes(2);
    expect([host, parent].map((element) => matrices.get(element).toString())).toEqual(expected);
    expect([host, parent].map((element) => [...element.childNodes])).toEqual(before);
  });

  it('keeps unavailable parents in the batch and supports empty input', () => {
    const detached = document.createElement('div');
    vi.spyOn(SVGSVGElement.prototype, 'getScreenCTM').mockReturnValue(null);
    expect(getChildrenScreenCTM([parent, detached])).toEqual(
      new Map([
        [parent, null],
        [detached, null],
      ])
    );
    expect(getChildrenScreenCTM([])).toEqual(new Map());
    expect([...parent.childNodes]).toEqual([child]);
  });

  it('removes every probe when a later batch measurement throws', () => {
    const before = [host, parent].map((element) => [...element.childNodes]);
    const error = new Error('Matrix unavailable');
    vi.spyOn(SVGSVGElement.prototype, 'getScreenCTM')
      .mockReturnValueOnce(new DOMMatrix())
      .mockImplementationOnce(() => {
        throw error;
      });
    expect(() => getChildrenScreenCTM([host, parent])).toThrow(error);
    expect([host, parent].map((element) => [...element.childNodes])).toEqual(before);
  });

  it('removes earlier probes when inserting a later probe throws', () => {
    const before = [host, parent].map((element) => [...element.childNodes]);
    const error = new Error('Insertion failed');
    vi.spyOn(parent, 'appendChild').mockImplementation(() => {
      throw error;
    });
    expect(() => getChildrenScreenCTM([host, parent])).toThrow(error);
    expect([host, parent].map((element) => [...element.childNodes])).toEqual(before);
  });
});
