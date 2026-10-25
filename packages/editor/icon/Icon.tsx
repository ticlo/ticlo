import React from 'react';
// Noto Sans 700 advance widths at 18px.
// prettier-ignore
const measureTable = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  4.68, 5.08, 8.62, 11.63, 10.3, 16.24, 13.5, 4.79, 6.1, 6.1, 9.76, 10.3, 5.13, 5.76, 5.06, 7.47, 10.3, 10.3, 10.3, 10.3, 10.3, 10.3, 10.3, 10.3, 10.3, 10.3, 5.06, 5.13, 10.3, 10.3, 10.3, 8.59, 16.16, 12.46, 11.97, 11.56, 13.18, 10.08, 9.88, 13.03, 13.77, 7, 5.96, 11.95, 10.06, 16.97, 14.63, 14.24, 11.18, 14.24, 11.81, 9.92, 10.39, 13.61, 11.7, 17.41, 12.06, 11.27, 10.42, 5.96, 7.47, 5.96, 10.3, 7.4, 6.57, 10.78, 11.38, 9.29, 11.38, 10.75, 6.97, 11.38, 11.7, 5.38, 5.36, 11.16, 5.36, 17.55, 11.7, 11.25, 11.38, 11.38, 8.05, 9.04, 7.81, 11.7, 10.28, 15.41, 10.4, 10.28, 8.87, 7.09, 9.92, 7.09, 10.3];
const offsetTable: boolean[] = new Array(127);
offsetTable.fill(false);
// characters that need y offset
for (const charWithOff of [40, 41, 44, 59, 64, 91, 93, 103, 106, 112, 113, 121, 123, 124, 125]) {
  offsetTable[charWithOff] = true;
}

interface Props {
  icon: string;
  style?: React.CSSProperties;
}

// not an accurate way to measure a string
function iconNameWidth(str: string): [string, number, boolean] {
  let overrideSize = -1;
  if (str.length > 2) {
    const colonPos = str.indexOf(':');
    if (colonPos > 0) {
      overrideSize = parseInt(str.substring(colonPos + 1));
      str = str.substring(0, colonPos);
    }
  }
  const size = str.length;
  let width = 0;
  let needOffset = false;
  for (let i = 0; i < size; ++i) {
    const code = str.charCodeAt(i);
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
    fontSize = Math.floor((24 * 18) / width);
  }
  if (fontSize !== 18) {
    needOffset = false;
  }

  return [str, fontSize, needOffset];
}

export function TIcon(props: Props) {
  let {icon, style} = props;
  if (style) {
    style = {backgroundColor: 'var(--ticl-block-color)', ...style};
  }
  let className = 'tico';
  if (icon == null) {
    icon = '';
  }
  // TODO priority for repeater and group

  const colonPos = icon.indexOf(':');
  if (colonPos > 0) {
    const iconType = icon.substring(0, colonPos);
    let iconName = icon.substring(colonPos + 1);
    switch (iconType) {
      case 'fas':
      case 'fab':
      case 'fa':
        if (!iconName.includes(' ')) {
          return (
            <div className={className} style={style}>
              <div className={`tico-icon-svg tico-${iconType}-${iconName}`} />
            </div>
          );
        }
        break;

      case 'txt':
        if (iconName.length > 3) {
          iconName = iconName.substring(0, 3);
        }
        const [outName, fontSize, needOffset] = iconNameWidth(iconName);
        if (fontSize > 0) {
          if (fontSize === 18) {
            if (needOffset) {
              className += ' tico-yoff';
            }
            return (
              <div className={`tico-txt ${className}`} style={style}>
                {iconName}
              </div>
            );
          } else {
            return (
              <div className={`tico-txt ${className}`} style={{...style, fontSize: `${fontSize}px`}}>
                {iconName}
              </div>
            );
          }
        }
    }
  }

  return <div className={className} style={style} />;
}
