import {expect, describe, it} from 'vitest';
import '../CssClass.js';
import '../CreateStyle.js';
import '../CssSheet.js';
import {Flow, Root} from '@ticlo/core';

describe('CssClass', function () {
  it('generate class', function () {
    const flow = new Flow();

    // Create sheet
    const sheetBlock = flow.createBlock('sheet');
    sheetBlock.setValue('#is', 'html:css-sheet');
    sheetBlock.setValue('prefix', 'p-');
    sheetBlock.setValue('enabled', true);

    // Create style
    const styleBlock = flow.createBlock('style');
    styleBlock.setValue('#is', 'html:create-style');
    styleBlock.setValue('color', 'blue');

    // Generic CssClass block
    const classBlock = flow.createBlock('class');
    classBlock.setValue('#is', 'html:css-class');
    classBlock.setValue('name', 'my-class');

    Root.run();

    const sheet = sheetBlock.getValue('#output');
    const style = styleBlock.getValue('#output');

    classBlock.setBinding('cssSheet', '##.sheet.#output');
    classBlock.setValue('style', style);

    Root.run();

    const className = classBlock.getValue('#output') as string;
    expect(typeof className).toBe('string');
    expect(className.startsWith('my-class')).toBe(true);
  });

  it('default sheet', function () {
    const flow = new Flow();
    const styleBlock = flow.createBlock('style');
    styleBlock.setValue('#is', 'html:create-style');
    styleBlock.setValue('color', 'red');

    const classBlock = flow.createBlock('class');
    classBlock.setValue('#is', 'html:css-class');
    classBlock.setValue('name', 'default-test');

    Root.run();

    const style = styleBlock.getValue('#output');
    classBlock.setValue('style', style);

    Root.run();

    const className = classBlock.getValue('#output');
    expect(typeof className).toBe('string');
    expect(className).toContain('default-test');
  });

  it('selector group', function () {
    const flow = new Flow();
    const classBlock = flow.createBlock('class');
    classBlock.setValue('#is', 'html:css-class');
    classBlock.setValue('name', 'hover-test');

    const hoverStyleBlock = flow.createBlock('hover-style');
    hoverStyleBlock.setValue('#is', 'html:create-style');
    hoverStyleBlock.setValue('color', 'red');

    Root.run();

    // Passing selector and explicit style1 to avoid index 0 collision with main style
    classBlock.setValue('selector1', '&:hover');
    classBlock.setValue('style1', hoverStyleBlock.getValue('#output'));

    Root.run();

    const className = classBlock.getValue('#output');
    expect(className).toContain('hover-test');
  });
});
