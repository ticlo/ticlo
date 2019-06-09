import React from "react";

const measureTable = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  4.55, 4.81, 7.72, 13.48, 8.55, 15.08, 13.46, 3.74, 6.91, 6.91, 9.05, 9.49, 4.28, 7.79, 4.27, 9.47, 10.94, 7.33, 10.96, 10.94, 10.66, 9.54, 10.08, 10.1, 10.48, 10.08, 4.28, 4.27, 11.29, 8.6, 11.29, 9.22, 16.34, 13.5, 11.63, 11.87, 12.67, 11.48, 11.47, 12.85, 12.58, 4.63, 9.88, 11.5, 10.57, 15.66, 12.96, 13.95, 11.38, 14.41, 11.36, 10.49, 13.16, 13.07, 14.09, 17.98, 13.34, 12.35, 11.57, 6.26, 9.5, 6.26, 9.47, 14.87, 8.68, 10.73, 10.66, 9.13, 10.76, 10.31, 7.23, 10.53, 10.89, 4.59, 4.69, 9.65, 5.63, 15.32, 10.91, 10.8, 10.48, 10.48, 8.23, 8.8, 7.15, 10.91, 11.48, 14.27, 10.21, 10.87, 10.55, 6.86, 3.91, 6.86, 11.72];
const offsetTable: boolean[] = new Array(127);
offsetTable.fill(false);
// characters that need y offset
for (let charWithOff of [40, 41, 44, 59, 64, 91, 93, 103, 106, 112, 113, 121, 123, 124, 125]) {
  offsetTable[charWithOff] = true;
}

interface Props {
  icon: string;
  style?: string | number;
}

// not an accurate way to measure a string
function iconNameWidth(str: string): [string, number, boolean] {
  let overrideSize = -1;
  if (str.length > 2) {
    let colonPos = str.indexOf(':');
    if (colonPos > 0) {
      overrideSize = parseInt(str.substr(colonPos + 1));
      str = str.substr(0, colonPos);
    }
  }
  let size = str.length;
  let width = 0;
  let needOffset = false;
  for (let i = 0; i < size; ++i) {
    let code = str.charCodeAt(i);
    if (code < 32) {
      return ['', -1, false];
    }
    if (code > 126) {
      width += 18;
    } else {
      if (offsetTable[code]) {
        needOffset = true;
      }
      width += measureTable[code];
    }
  }
  let fontSize = 18;
  if (overrideSize > 0) {
    fontSize = overrideSize;
  } else if (width > 24) {
    fontSize = Math.floor(24 * 18 / width);
  }
  if (fontSize !== 18) {
    needOffset = false;
  }

  return [str, fontSize, needOffset];
}

export function TIcon(props: Props) {
  let {icon, style} = props;
  let className = `tico ${style || ''}`;
  if (icon == null) {
    icon = '';
  }
  // TODO priority for repeater and group

  let colonPos = icon.indexOf(':');
  if (colonPos > 0) {
    let iconType = icon.substr(0, colonPos);
    let iconName = icon.substr(colonPos + 1);
    switch (iconType) {
      case 'fas':
      case 'fab':
      case 'fa':
      case 'material':
        if (!iconName.includes(' ')) {
          return (
            <div className={className}>
              <div className={`tico-icon-svg tico-${iconType}-${iconName}`}/>
            </div>
          );
        }
        break;

      case 'txt':
        if (iconName.length > 3) {
          iconName = iconName.substr(0, 3);
        }
        let [outName, fontSize, needOffset] = iconNameWidth(iconName);
        if (fontSize > 0) {
          if (fontSize === 18) {
            if (needOffset) {
              className += ' tico-yoff';
            }
            return (<div className={`tico-txt ${className}`}>{iconName}</div>);
          } else {
            return (
              <div className={`tico-txt ${className}`} style={{fontSize: `${fontSize}px`}}>{iconName}</div>);
          }
        }

    }
  }

  return <div className={className}/>;
}
