import * as React from "react";

const measureTable = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  5, 8, 13, 9, 15, 13, 4, 7, 7, 9, 9, 4, 8, 4, 9, 11, 7, 11, 11, 11, 10, 10, 10, 10, 10, 4, 4, 11, 9, 11, 9, 16, 14, 12, 12, 13, 11, 11, 13, 13, 5, 10, 12, 11, 16, 13, 14, 11, 15, 11, 10, 13, 13, 14, 18, 13, 12, 12, 6, 10, 6, 9, 15, 9, 11, 11, 9, 11, 10, 8, 11, 11, 5, 5, 10, 6, 15, 11, 11, 10, 10, 8, 9, 8, 11, 11, 14, 10, 11, 11, 7, 4, 7, 12];

interface Props {
  icon: string;
  priority?: string | number;
}

// not an accurate way to measure a string
function iconNameLength(str: string): number {
  let size = str.length;
  let width = 0;
  for (let i = 0; i < size; ++i) {
    let code = str.charCodeAt(i);
    if (code < 32) {
      return -1;
    }
    if (code > 126) {
      return size * 18;
    }
    width += measureTable[code];
  }
  return width;
}

export function TIcon(props: Props) {
  let {icon, priority} = props;
  let priClass = '';
  if (priority != null) {
    priClass = `tico-pr${priority}`;
  }
  // TODO priority for repeater and group
  if (!icon.includes(' ')) {
    let iconParts = icon.split(':');
    if (iconParts.length === 2) {
      let [iconType, iconName] = iconParts;
      switch (iconType) {
        case 'fas':
        case 'fab':
          return (<div className={`tico ${iconType} fa-${iconName} ${priClass}`} />);
        case 'txt':
          if (iconName.length > 3) {
            iconName = iconName.substr(0, 3);
          }
          let nameLen = iconNameLength(iconName);
          if (nameLen > 0) {
            if (nameLen <= 22) {
              return (<div className={`tico tico-txt ${priClass}`}>{iconName}</div>);
            } else {
              let fontSize = Math.floor(18 * 22 / nameLen);
              return (<div className={`tico tico-txt ${priClass}`} style={{fontSize}}>{iconName}</div>);
            }
          }
      }
    }
  }
  return <div className="tico" />;
}
