import React from 'react';
import * as ReactDOM from 'react-dom';

let key = 0;
let div: HTMLDivElement;
function getDiv() {
  if (!div) {
    div = document.createElement('div');
  }
  return div;
}

export function showModal(component: React.ReactElement, override: (modal: React.ReactElement) => void) {
  if (component) {
    // rotate the key
    key = (key + 1) % 4;
  }

  if (override) {
    override(component);
  } else if (component) {
    ReactDOM.render(component, getDiv());
  } else if (div) {
    ReactDOM.unmountComponentAtNode(div);
  }
}
