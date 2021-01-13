import React from 'react';
import * as ReactDOM from 'react-dom';

let key = 0;
let div: HTMLDivElement;
let lastOverrideFunction: (modal: React.ReactElement) => void;
function getDiv() {
  if (!div) {
    div = document.createElement('div');
  }
  return div;
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
    } else if (div) {
      ReactDOM.unmountComponentAtNode(div);
      div = null;
    }
  }

  if (overrideFunction) {
    overrideFunction(component);
  } else if (component) {
    ReactDOM.render(component, getDiv());
  } else if (div) {
    ReactDOM.unmountComponentAtNode(div);
  } else if (lastOverrideFunction) {
    lastOverrideFunction(null);
  }
  lastOverrideFunction = overrideFunction;
}
