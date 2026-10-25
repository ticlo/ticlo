import React from 'react';
// Noto Sans 900 advance widths at 18px.
// prettier-ignore
const measureTable = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  4.68, 5.22, 9.43, 11.92, 10.39, 17.06, 14.38, 5.26, 6.46, 6.46, 9.67, 10.55, 5.56, 5.72, 5.2, 7.96, 10.55, 10.55, 10.55, 10.55, 10.55, 10.55, 10.55, 10.55, 10.55, 10.55, 5.2, 5.35, 10.55, 10.55, 10.55, 9.09, 16.15, 13.07, 12.13, 11.68, 13.21, 9.88, 9.7, 13.32, 13.79, 7.92, 6.34, 12.37, 10.48, 17.41, 15.01, 14.35, 11.38, 14.35, 12.19, 10.39, 10.64, 13.63, 12.49, 18.7, 13.01, 11.95, 11, 5.83, 7.96, 5.83, 9.45, 9, 7.52, 11.21, 11.57, 9.7, 11.57, 11.12, 7.43, 11.57, 12.06, 5.85, 5.83, 11.86, 5.81, 18, 12.06, 11.47, 11.57, 11.57, 8.44, 9.31, 8.28, 12.06, 11, 16.38, 11.34, 10.98, 9.13, 7.79, 9.16, 7.79, 10.55];
const offsetTable: boolean[] = new Array(127);
offsetTable.fill(false);
// characters that need y offset
for (const charWithOff of [40, 41, 44, 59, 64, 91, 93, 103, 106, 112, 113, 121, 123, 124, 125]) {
  offsetTable[charWithOff] = true;
}

interface Props {
  icon: string;
  colorClass?: string;
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
  let {icon, colorClass} = props;
  let className = `tico ${colorClass || ''}`;
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
            <div className={className}>
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
            return <div className={`tico-txt ${className}`}>{iconName}</div>;
          } else {
            return (
              <div className={`tico-txt ${className}`} style={{fontSize: `${fontSize}px`}}>
                {iconName}
              </div>
            );
          }
        }
    }
  }

  return <div className={className} />;
}
