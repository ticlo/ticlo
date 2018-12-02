import {TRUNCATED} from "../../common/util/Types";
import React from "react";

// display value in screen, avoid huge data in dmo to improve performance
export function displayValue(val: any, element: HTMLElement) {
  console.log(val);
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
      let rslt1 = val.toString();
      let rslt2 = val.toPrecision(3);
      if (rslt1.length < rslt2.length + 3) {
        // use full string if it's not too long
        element.innerText = rslt1;
      } else {
        element.innerText = rslt2;
      }
      console.log(element.innerText);
      break;
    case 'undefined':
      element.innerText = '';
      break;
    default:
      element.innerText = `${val}`;
  }
  element.classList.remove('ticl-string-value');
}

// fix number format in svg and css
export function cssNumber(n: number): string {
  if (Math.floor(n) === n) {
    return n.toFixed(0);
  } else {
    return n.toFixed(2);
  }
}
