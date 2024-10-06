import {globalStyle} from '@ticlo/html/style/CssRules';
import {FunctionDesc} from '@ticlo/core';
import {ClientConn} from '@ticlo/core/connect/ClientConn';

const usedColors = new Set<string>();

const colorReg = /^[a-f0-9]{3}$/;
function brighterColor(c: string) {
  return 255 - ((255 - Number(`0x${c}`) * 17) >> 1);
}
export function addBlockColor(color: string) {
  if (usedColors.has(color)) {
    return;
  }
  if (!colorReg.test(color)) {
    return;
  }
  usedColors.add(color);
  let rr = brighterColor(color.substring(0, 1));
  let gg = brighterColor(color.substring(1, 2));
  let bb = brighterColor(color.substring(2, 3));
  globalStyle.addRule(`.ticl-block--${color}{border-color: #${color};}`);
  globalStyle.addRule(`.ticl-block--${color} .ticl-block-prbg, .ticl-bg--${color}{background: #${color};}`);
  globalStyle.addRule(`.ticl-block--${color}.ticl-block-selected{box-shadow: 0 0 4px 3px rgb(${rr},${gg},${bb});}`);
}

const priorityColors = ['4af', '1bb', '8c1', 'f72'];
export function getFuncStyleFromDesc(
  desc: {color?: string; icon?: string; ns?: string; category?: string},
  conn: ClientConn,
  prefix = 'ticl-block--'
): [string, string] {
  let color: string;
  let icon: string;
  if (desc) {
    ({color, icon} = desc);
    if ((!color || !icon) && conn) {
      let category = desc.ns;
      if (category == null) {
        category = desc.category || 'other'; // TODO remove other
      }
      if (category != null) {
        let catDesc = conn.getCategory(category);
        if (catDesc) {
          color = color || catDesc.color;
          icon = icon || catDesc.icon;
        }
      }
    }
  }
  color = color || '999';
  addBlockColor(color);
  return [prefix + color, icon];
}
