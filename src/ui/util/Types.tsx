import {TRUNCATED} from "../../common/util/Types";
import React from "react";

export function toDisplay(val: any): React.ReactNode | React.ReactNode[] {
  switch (typeof val) {
    case 'object':
      return JSON.stringify(val);
    case 'string':
      if (val.length > 512) {
        return [
          <span key='open' className='string-quote'>'</span>,
          `${val.substr(0, 128)}${TRUNCATED}`,
          <span key='close' className='string-quote'>'</span>
        ];
      } else {
        return [
          <span key='open' className='string-quote'>'</span>,
          val,
          <span key='close' className='string-quote'>'</span>
        ];
      }
    case 'number':
      let rslt1 = val.toString();
      let rslt2 = val.toPrecision(3);
      if (rslt1.length < rslt2.length + 3) {
        // use full string if it's not too long
        return rslt1;
      } else {
        return rslt2;
      }
    case 'undefined':
      return '';
    default:
      return `${val}`;
  }
}
