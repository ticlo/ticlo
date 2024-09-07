import React from 'react';

export function displayNumber(val: number): string {
  let rslt1 = val.toString();
  let rslt2 = val.toPrecision(4);
  if (!rslt1.includes('.')) {
    return rslt1;
  }
  if (rslt1.length < 11) {
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
