import React from 'react';
import * as ReactDOM from 'react-dom';
import {createRoot, Root} from 'react-dom/client';

let key = 0;
let root: Root;
let lastOverrideFunction: (modal: React.ReactElement) => void;
function getModalRoot() {
  if (!root) {
    const div = document.createElement('div');
    root = createRoot(div);
  }

  return root;
}

export function showModal(component: React.ReactElement, overrideFunction: (modal: React.ReactElement) => void) {
  if (component) {
    // rotate the key
    key = (key + 1) % Number.MAX_SAFE_INTEGER;
    component = React.cloneElement(component, {key: `modal-${key}`});
  }

  if (overrideFunction !== lastOverrideFunction) {
    if (lastOverrideFunction) {
      lastOverrideFunction(null);
    } else if (root) {
      root.unmount();
    }
  }

  if (overrideFunction) {
    overrideFunction(component);
  } else if (component) {
    getModalRoot().render(component);
  } else if (root) {
    root.unmount();
  } else if (lastOverrideFunction) {
    lastOverrideFunction(null);
  }
  lastOverrideFunction = overrideFunction;
}
