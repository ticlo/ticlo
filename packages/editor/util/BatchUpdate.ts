import ReactDOM from 'react-dom';
import {ClientConn} from '@ticlo/core';

let callbacks = new Set<() => void>();
let pending = false;

function batch() {
  for (let callback of callbacks) {
    callback();
  }
  callbacks.clear();
  pending = false;
}
function resolve() {
  ReactDOM.unstable_batchedUpdates(batch);
}

export function batchUpdateReact(callback: () => void, conn: ClientConn) {
  callbacks.add(callback);
  if (!pending) {
    pending = true;
    conn.callImmediate(resolve);
  }
}
