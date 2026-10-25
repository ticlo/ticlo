import type {CSSProperties} from 'react';
import type {ClientConn} from '@ticlo/core/editor.ts';

export function getFuncStyleFromDesc(
  desc: {color?: string; icon?: string; ns?: string; category?: string},
  conn: ClientConn
): [CSSProperties, string] {
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
        const catDesc = conn.getCategory(category);
        if (catDesc) {
          color = color || catDesc.color;
          icon = icon || catDesc.icon;
        }
      }
    }
  }
  color = color || '999';
  return [{'--ticl-block-color': `#${color}`} as CSSProperties, icon];
}
