import {Root} from '@ticlo/core';
import {usesDesignerStage} from './designer-flow.ts';

it('routes pages and empty flows to Designer and flows with existing child blocks to Dataflow', () => {
  const root = new Root();
  try {
    const flow = root.addFlow('test', {value: 42});
    expect(usesDesignerStage(flow)).toBe(true);

    flow.createBlock('calculation').setValue('#is', 'add');
    expect(usesDesignerStage(flow)).toBe(false);

    flow.createBlock('#main').setValue('#is', 'react:vertical');
    expect(usesDesignerStage(flow)).toBe(true);
  } finally {
    root.destroy();
  }
});

it('ignores a reference to a block owned by another flow when checking for child blocks', () => {
  const root = new Root();
  try {
    const other = root.addFlow('other', {calculation: {'#is': 'add'}});
    const flow = root.addFlow('test');
    flow.setBinding('reference', '##.other.calculation');
    expect(flow.getValue('reference')).toBe(other.getValue('calculation'));
    expect(usesDesignerStage(flow)).toBe(true);
  } finally {
    root.destroy();
  }
});
