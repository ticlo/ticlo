import {describe, it, expect, beforeEach} from 'vitest';
import {CssSheet} from '../CssSheet.js';

describe('CssSheet', () => {
  let sheet: CssSheet;

  beforeEach(() => {
    sheet = new CssSheet();
  });

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  it('should add a basic rule after flush', async () => {
    sheet.addRule('.test', {color: 'red'});

    // Check sheet content before flush (should be empty if batching works)
    // Actually, we can't easily check internal #sheet content from outside,
    // but we can check document.adoptedStyleSheets if we wanted to be very intrusive.
    // However, the requested behavior is that it's grouped next frame.

    await nextFrame();

    // We can use document.styleSheets or look at document.adoptedStyleSheets
    const adopted = document.adoptedStyleSheets;
    const s = adopted[adopted.length - 1];
    expect(s.cssRules.length).toBe(1);
    expect(s.cssRules[0].cssText).toContain('color: red');
  });

  it('should implement addRuleGroup with hash and &', async () => {
    const handle = sheet.addRuleGroup('my-?-class', {color: 'blue'}, [
      {selector: '&:hover', styles: {color: 'green'}},
      {selector: 'div &', styles: {padding: '10px'}},
    ]);

    expect(handle.className).toMatch(/^my-.*-class$/);
    const cls = handle.className;

    await nextFrame();

    const adopted = document.adoptedStyleSheets;
    const s = adopted[adopted.length - 1];

    // 3 rules total
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
    expect(s.cssRules.length).toBe(1); // Still there because of h2

    h2.remove();
    await nextFrame();
    expect(s.cssRules.length).toBe(0); // Finally gone
  });

  it('should optimize add/remove in same frame', async () => {
    const h = sheet.addRule('.temp', {margin: '5px'});
    h.remove();

    await nextFrame();
    const adopted = document.adoptedStyleSheets;
    const s = adopted[adopted.length - 1];
    expect(s.cssRules.length).toBe(0); // Should never have been added
  });

  it('should batch destroy', async () => {
    const s2 = new CssSheet();
    s2.addRule('.gone', {opacity: 0});
    s2.destroy();

    const beforeAdopted = document.adoptedStyleSheets.length;
    await nextFrame();
    const afterAdopted = document.adoptedStyleSheets.length;

    expect(afterAdopted).toBe(beforeAdopted - 1);
  });

  it('should support stable hash for same styles in addRuleGroup', () => {
    const h1 = sheet.addRuleGroup('?-box', {display: 'flex', color: 'red'}, []);
    const h2 = sheet.addRuleGroup('?-box', {color: 'red', display: 'flex'}, []);

    expect(h1.className).toBe(h2.className);

    h1.remove();
    h2.remove();
  });
});
