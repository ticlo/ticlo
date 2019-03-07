import {TRUNCATED} from "../../core/util/Types";
import React from "react";

// display value in screen, avoid huge data in dmo to improve performance
export function displayValue(val: any, element: HTMLElement) {
  switch (typeof val) {
    case 'string':
      if (val.length > 512) {
        element.innerText =
          `${val.substr(0, 128)}${TRUNCATED}`;
      } else {
        element.innerText = val;
      }
      element.classList.add('ticl-string-value');
      return;
    case 'object':
      element.innerText = JSON.stringify(val);
      break;
    case 'number':
      element.innerText = displayNumber(val);
      break;
    case 'undefined':
      element.innerText = '';
      break;
    default:
      element.innerText = `${val}`;
  }
  element.classList.remove('ticl-string-value');
}

export function displayNumber(val: number): string {
  let rslt1 = val.toString();
  let rslt2 = val.toPrecision(4);
  if (rslt1.length < rslt2.length + 3) {
    // use full string if it's not too long
    return rslt1;
  } else {
    return rslt2;
  }
}

// fix number format in svg and css
export function cssNumber(n: number): string {
  if (Math.floor(n) === n) {
    return n.toFixed(0);
  } else {
    return n.toFixed(2);
  }
}