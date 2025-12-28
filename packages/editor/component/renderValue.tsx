import React from 'react';
import {TRUNCATED, encodeDisplay} from '@ticlo/core';
import {displayNumber} from '../util/Types.js';

// render value for Block value field
export function renderValue(val: any, getPopup?: (val: any) => React.ReactElement) {
  switch (typeof val) {
    case 'string':
      if (val.length > 512) {
        val = `${val.substring(0, 128)}${TRUNCATED}`;
      }
      return <span className="ticl-string-value">{val}</span>;
    case 'object':
      const display = encodeDisplay(val);
      if (val && (Array.isArray(val) || val.constructor === Object)) {
        return (
          <>
            <div className="ticl-object-value">{display}</div>
            {getPopup ? getPopup(val) : null}
          </>
        );
      } else {
        return display;
      }
    case 'number':
      return displayNumber(val);
    case 'undefined':
      return null;
    default:
      return `${val}`;
  }
}
