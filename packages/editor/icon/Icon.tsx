import React, {useInsertionEffect} from 'react';
import {hashData} from '@ticlo/core/util/Serialize.ts';
import {globalStyle} from '@ticlo/html';
import {parseIcon, pathBackground} from './IconDefinition.ts';

interface Props {
  icon: string;
  style?: React.CSSProperties;
}

export function TIcon({icon, style}: Props) {
  const {background, texts} = parseIcon(icon);
  const path = background?.type === 'path' ? background.value : undefined;
  const pathClass = path ? `tico-path-${hashData(path).toString(36)}` : undefined;
  useInsertionEffect(() => {
    if (!path) return;
    return globalStyle.addRule(`.${pathClass}`, {backgroundImage: pathBackground(path)}).remove;
  }, [path, pathClass]);

  const backgroundClass = background?.type === 'svg' ? `tico-svg-${background.value}` : pathClass;
  const iconStyle = style ? {backgroundColor: 'var(--ticl-block-color)', ...style} : undefined;
  return (
    <div className="tico" style={iconStyle}>
      {backgroundClass ? <div className={`tico-icon-svg ${backgroundClass}`} /> : null}
      {texts.map(({text, position, fontSize, shiftUp}, index) => (
        <span
          key={index}
          className="tico-txt"
          style={{
            fontSize,
            transform: shiftUp ? 'translateY(-0.1em)' : undefined,
            justifyContent: position.includes('l') ? 'flex-start' : position.includes('r') ? 'flex-end' : 'center',
            alignItems: position.includes('t') ? 'flex-start' : position.includes('b') ? 'flex-end' : 'center',
          }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}
