import {expect} from 'vitest';
import {Flow, Root} from '../Flow.ts';
import {Library} from '../Library.ts';

describe('LibraryConfig', function () {
  it('get #+ value', function () {
    const flowLibrary = Root.instance.addFlowFolder('+libraryConfig1');
    const flowTest = Root.instance.addFlow('libraryConfigTest1');
    flowTest.load({}, null, null, null, '+libraryConfig1');
    expect(flowTest.getValue('#+')).toBe(flowLibrary);

    Root.instance.deleteValue('libraryConfigTest1');
    Root.instance.deleteValue('libraryConfig1');
  });

  it('bind #+ value', function () {
    const flowTest = Root.instance.addFlow('libraryConfigTest2');
    flowTest.load({}, null, null, null, '+libraryConfig2');
    expect(flowTest.getValue('#+')).toBeUndefined();

    const flowLibrary = Root.instance.addFlowFolder('+libraryConfig2');
    expect(flowTest.getValue('#+')).toBe(flowLibrary);

    Root.instance.deleteValue('libraryConfigTest2');
    Root.instance.deleteValue('libraryConfig2');
  });

  it('resolves the current library shorthand', function () {
    const libraryName = '+libraryConfigRelative';
    const module = Library.getLibrary(libraryName).getModule('workers');
    const flow = new Flow();
    flow._library = libraryName;

    expect(Library.getFunctions('+:workers:item', flow)).toBe(module);
    expect(Library.getFunctions('+:workers:item', undefined, libraryName)).toBe(module);

    flow.destroy();
    Root.instance.deleteValue(libraryName);
  });
});
