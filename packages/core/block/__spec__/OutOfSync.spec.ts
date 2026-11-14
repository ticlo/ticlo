import {Block} from '../Block.ts';
import {BaseFunction} from '../BlockFunction.ts';
import {DoneEvent, ErrorEvent, WAIT, WarningEvent} from '../Event.ts';
import {Flow, Root} from '../Flow.ts';
import {globalFunctions} from '../FunctionModule.ts';
import {TestFunctionRunner} from './TestFunction.ts';

describe('Out of sync', () => {
  let root: Root;
  let flow: Flow;

  beforeEach(() => {
    root = new Root();
    flow = new Flow(root);
    TestFunctionRunner.clearLog();
  });

  afterEach(() => {
    flow.destroy();
    TestFunctionRunner.clearLog();
  });

  function runner(name: string, mode: 'onChange' | 'onCall', priority = 1): Block {
    const block = flow.createBlock(name);
    block.setValue('#mode', mode);
    block.setValue('#priority', priority);
    block.setValue('#-log', name);
    block.setValue('#is', 'test-runner');
    return block;
  }

  it.each(['none', 'sync', 'queued'] as const)(
    'reports only requests left unhandled by the end of the round (%s)',
    (recovery) => {
      const source = runner('source', 'onChange');
      const update = runner('update', 'onCall');
      const observer = recovery === 'none' ? runner('observer', 'onChange') : undefined;
      const warnings: WarningEvent[] = [];
      if (recovery === 'sync') source.setValue('#sync', true);
      const later = recovery === 'queued' ? runner('later', 'onCall', 2) : undefined;
      later?.getProperty('#emit').listen({
        onChange(value) {
          if (value instanceof DoneEvent) source.updateValue('input', 5);
        },
      });
      source.getProperty('#emit').listen({
        onChange(value) {
          if (value instanceof DoneEvent && update.getValue('#call') === undefined) update.updateValue('#call', true);
          if (value instanceof WarningEvent) {
            warnings.push(value);
            observer?.updateValue('input', value);
          }
        },
      });
      update.getProperty('#emit').listen({
        onChange(value) {
          if (!(value instanceof DoneEvent)) return;
          source.updateValue('input', 3);
          source.updateValue('input', 4);
          expect(source.getValue('#emit')).toBeInstanceOf(DoneEvent);
          if (recovery === 'sync') source.updateValue('#call', true);
          later?.updateValue('#call', true);
        },
      });

      source.updateValue('input', 1);
      source.updateValue('input', 2);
      root.runAll();

      if (recovery === 'none') {
        expect(TestFunctionRunner.logs).toEqual(['source', 'update', 'observer']);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].type).toBe(WarningEvent.OutOfSync);
      } else {
        expect(TestFunctionRunner.logs).toEqual(
          recovery === 'sync' ? ['source', 'update', 'source'] : ['source', 'update', 'later', 'source']
        );
        expect(warnings).toEqual([]);
      }
    }
  );

  it('publishes a warning when a synchronous call drops an update outside a resolver round', () => {
    const source = runner('source', 'onChange');
    source.setValue('#sync', true);
    source.getProperty('#emit').listen({
      onChange(value) {
        if (value instanceof DoneEvent) source.updateValue('input', 1);
      },
    });

    source.updateValue('#call', true);
    expect(source.getValue('#emit')).toBeInstanceOf(DoneEvent);
    root.runAll();
    expect(source.getValue('#emit')).toBeInstanceOf(WarningEvent);
    expect(TestFunctionRunner.logs).toEqual(['source']);
  });

  it('preserves wait and error state and skips downstream call hooks for warnings', () => {
    const source = flow.createBlock('source');
    const sink = flow.createBlock('sink');
    const onCall = vi.fn(() => true);
    class OnLoad extends BaseFunction {
      onCall = onCall;
    }
    const name = 'test-out-of-sync-on-load';
    globalFunctions.addFactory(OnLoad, {name, mode: 'onLoad'});
    try {
      const warning = new WarningEvent(WarningEvent.OutOfSync);
      source.emit(WAIT);
      expect(source.getProperty('#emit', false)).toBeNull();
      source.emit(warning);
      expect(source.getValue('#emit')).toBe(warning);
      expect(source.getValue('#wait')).toBe(true);
      sink.setBinding('#call', '##.source.#emit');
      sink.setValue('#is', name);
      source.emitOnly(new WarningEvent(WarningEvent.OutOfSync));
      expect(onCall).not.toHaveBeenCalled();

      const error = new ErrorEvent('test failure');
      source.emitOnly(error);
      source.emit(warning);
      source.emitOnly(warning);
      expect(source.getValue('#emit')).toBe(error);
      expect(source.getValue('#wait')).toBe(true);
    } finally {
      globalFunctions.delete(name);
    }
  });
});
