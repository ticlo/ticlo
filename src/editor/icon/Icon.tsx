import * as React from "react";

interface Props {
  icon: string;
  priority?: number;
}

function iconNameLength(str: string): number {
  return 18;
}

export function TIcon(props: Props) {
  let {icon, priority} = props;
  let priClass = '';
  if (priority >= 0) {
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
          return (<div className={`tico ${iconType} fa-${iconName} ${priClass}`}/>);
        case 'txt':
          if (iconName.length > 3) {
            iconName = iconName.substr(0, 3);
          }
          let nameLen = iconNameLength(iconName);
          if (nameLen <= 18) {
            return (<div className={`tico tico-txt ${priClass}`}>{iconName}</div>);
          } else {
            let fontSize = Math.floor(18 * 18 / nameLen);
            return (<div className={`tico tico-txt ${priClass}`} style={{fontSize}}>{iconName}</div>);
          }

      }
    }
  }
  return <div className="tico"/>;
}
