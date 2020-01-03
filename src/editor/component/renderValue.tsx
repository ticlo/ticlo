import React from 'react';
import {TRUNCATED} from '../../core/util/DataTypes';
import {encodeDisplay} from '../../core/util/Serialize';
import {displayNumber} from '../../react/util/Types';

export function renderValue(val: any, getPopup?: (val: any) => void) {
  switch (typeof val) {
    case 'string':
      if (val.length > 512) {
        val = `${val.substr(0, 128)}${TRUNCATED}`;
      }
      return <span className="ticl-string-value">{val}</span>;
    case 'object':
      let display = encodeDisplay(val);
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
