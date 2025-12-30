import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {CssSheet} from '../CssSheet.js';

describe('CssSheet', () => {
  let sheet: CssSheet;
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  beforeEach(async () => {
    sheet = new CssSheet();
    await nextFrame(); // Ensure the sheet from beforeEach is adopted
  });

  afterEach(async () => {
    sheet.destroy();
    await nextFrame(); // Ensure cleanup happens
  });

  it('should add a basic rule after flush', async () => {
    sheet.addRule('.test', {color: 'red'});
    await nextFrame();

    const adopted = document.adoptedStyleSheets;
    const s = adopted[adopted.length - 1];
    expect(s.cssRules.length).toBe(1);
    expect(s.cssRules[0].cssText).toContain('color: red');
  });

  it('should implement addRuleGroup with hash and &', async () => {
    const handle = sheet.addRuleGroup('my-?-class', {color: 'blue'}, [
      {selector: '&:hover', style: {color: 'green'}},
      {selector: 'div &', style: {padding: '10px'}},
    ]);

    expect(handle.className).toMatch(/^my-.*-class$/);
    const cls = handle.className;

    await nextFrame();

    const adopted = document.adoptedStyleSheets;
    const s = adopted[adopted.length - 1];

    expect(s.cssRules.length).toBe(3);

    const texts = Array.from(s.cssRules).map((r) => r.cssText);
    expect(texts).toContain(`.${cls} { color: blue; }`);
    expect(texts).toContain(`.${cls}:hover { color: green; }`);
    expect(texts).toContain(`div .${cls} { padding: 10px; }`);
  });

  it('should handle reference counting for exact same rules', async () => {
    const h1 = sheet.addCssText('.shared { display: block; }');
    const h2 = sheet.addCssText('.shared { display: block; }');

    await nextFrame();
    const adopted = document.adoptedStyleSheets;
    const s = adopted[adopted.length - 1];
    expect(s.cssRules.length).toBe(1);

    h1.remove();
    await nextFrame();
    expect(s.cssRules.length).toBe(1);

    h2.remove();
    await nextFrame();
    expect(s.cssRules.length).toBe(0);
  });

  it('should optimize add/remove in same frame', async () => {
    const h = sheet.addRule('.temp', {margin: '5px'});
    h.remove();

    await nextFrame();
    const adopted = document.adoptedStyleSheets;
    const s = adopted[adopted.length - 1];
    expect(s.cssRules.length).toBe(0);
  });

  it('should batch destroy', async () => {
    const beforeCount = document.adoptedStyleSheets.length;

    // 1. Immediate destruction should cancel adoption
    const s2 = new CssSheet();
    s2.addRule('.test2', {color: 'red'});
    s2.destroy();
    await nextFrame();
    expect(document.adoptedStyleSheets.length).toBe(beforeCount);

    // 2. Destruction after adoption should remove it
    const s3 = new CssSheet();
    s3.addRule('.test3', {color: 'blue'});
    await nextFrame();
    expect(document.adoptedStyleSheets.length).toBe(beforeCount + 1);

    s3.destroy();
    await nextFrame();
    expect(document.adoptedStyleSheets.length).toBe(beforeCount);
  });

  it('should support stable hash for same style in addRuleGroup', () => {
    const h1 = sheet.addRuleGroup('?-box', {display: 'flex', color: 'red'}, []);
    const h2 = sheet.addRuleGroup('?-box', {color: 'red', display: 'flex'}, []);

    expect(h1.className).toBe(h2.className);

    h1.remove();
    h2.remove();
  });

  it('should use default class name pattern if none provided', async () => {
    const handle = sheet.addRuleGroup('', {color: 'purple'}, []);
    expect(handle.className).toMatch(/^ticl-c-.*$/);

    // Validate it actually applies
    await nextFrame();
    const adopted = document.adoptedStyleSheets;
    const s = adopted[adopted.length - 1];

    const cls = handle.className;
    const texts = Array.from(s.cssRules).map((r) => r.cssText);
    expect(texts).toContain(`.${cls} { color: purple; }`);
  });
});
