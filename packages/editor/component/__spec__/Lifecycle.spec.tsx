import {blankFuncDesc} from '@ticlo/core/editor.js';
import type {ClientConn} from '@ticlo/core/editor.js';
import {BlockWidget} from '../../block/view/BlockWidget.js';
import '../../block/view/NoteWidget.js';
import {NodeTreeItem, NodeTreeRenderer} from '../../node-tree/NodeRenderer.js';
import {ObjectTree} from '../../object-tree/ObjectTree.js';

function createConnection() {
  const subscriptions = new Map<object, string>();
  const conn = {
    lockImmediate() {},
    unlockImmediate() {},
    subscribe(path: string, callback: object) {
      subscriptions.set(callback, path);
    },
    unsubscribe(path: string, callback: object) {
      subscriptions.delete(callback);
    },
    watchDesc() {},
    unwatchDesc() {},
    getBaseConn() {
      return conn;
    },
  } as unknown as ClientConn;
  return {conn, subscriptions};
}

describe('editor component lifecycle', function () {
  it('unsubscribes every note widget value on unmount', function () {
    const {conn, subscriptions} = createConnection();
    const NoteWidget = BlockWidget.get('note');
    const widget = new NoteWidget({conn, path: 'flow.note', updateViewHeight() {}});

    expect(Array.from(subscriptions.values()).sort()).toEqual(['flow.note.@b-note', 'flow.note.@b-note-mode']);
    widget.componentWillUnmount();
    expect(subscriptions.size).toBe(0);
  });

  it('unsubscribes every node renderer value on unmount', function () {
    const {conn, subscriptions} = createConnection();
    const item = new NodeTreeItem('node', '1');
    item.connection = conn;
    const renderer = new NodeTreeRenderer({item, style: {}, selected: false, onClick() {}});
    renderer.attachedItem = item;
    renderer.descCallback({...blankFuncDesc, dynamicStyle: true});

    expect(subscriptions.size).toBe(5);
    renderer.componentWillUnmount();
    expect(subscriptions.size).toBe(0);
  });

  it('can unmount an object tree before its asynchronous root is built', function () {
    const tree = Object.create(ObjectTree.prototype) as ObjectTree;
    expect(() => tree.componentWillUnmount()).not.toThrow();
  });
});
