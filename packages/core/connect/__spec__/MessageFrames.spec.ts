import {expect} from 'vitest';
import {Root} from '../../block/Flow.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import {AsyncClientPromise} from './AsyncClientPromise.ts';
import {VoidListeners, TestFunctionRunner} from '../../block/__spec__/TestFunction.ts';
import {FunctionDesc} from '../../block/Descriptor.ts';
import {shouldHappen} from '../../util/test-util.ts';
import {JsFunction} from '../../functions/script/Js.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import {DataMap} from '../../util/DataTypes.ts';
import {BaseFunction} from '../../block/BlockFunction.ts';
import {addTestTypes, removeTestTypes} from './BulkTypes.ts';
import {Connection, ConnectionSend} from '../Connection.ts';

describe('Connection Message Frames', function () {
  it('splits at the instance budget and drains all messages through acknowledgements', async () => {
    async function send(maxMessageSize: number) {
      const sender = new Connection({maxMessageSize, maxValueSize: 8});
      const receiver = new Connection();
      const frames: DataMap[][] = [];
      const received: number[] = [];
      sender.doSend = (data) => {
        frames.push(data);
        receiver.onReceive(data);
      };
      receiver.doSend = (data) => sender.onReceive(data);
      receiver.onData = (data) => received.push(data.index as number);
      sender.onData = () => {};
      sender.onConnect();
      receiver.onConnect();
      try {
        for (let index = 0; index < 16; ++index) sender.addSend(new ConnectionSend({index, text: '12345678'}));
        await shouldHappen(() => received.length === 16);
        expect(received).toEqual(Array.from({length: 16}, (_, i) => i));
        return frames.length;
      } finally {
        sender.destroy();
        receiver.destroy();
      }
    }
    expect(await send(32)).toBeGreaterThan(await send(128));
  });

  it('desc frames', async function () {
    addTestTypes('a', 4000);
    const [server, client] = makeLocalConnection(Root.instance);

    await shouldHappen(() => client.watchDesc('a100'));

    expect(client.watchDesc('a1000') != null).toBe(true);
    expect(client.watchDesc('a3999') == null).toBe(true);
    await shouldHappen(() => client.watchDesc('a3999'), 1000);

    addTestTypes('b', 4000);

    await shouldHappen(() => client.watchDesc('b3999'), 1000);

    client.destroy();

    removeTestTypes('a', 4000);
    removeTestTypes('b', 4000);

    expect(globalFunctions.getAllFunctionIds().length < 4000).toBe(true);
  });
});
