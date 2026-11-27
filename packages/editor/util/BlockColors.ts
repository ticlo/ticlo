import type {CSSProperties} from 'react';
import type {ClientConn} from '@ticlo/core/editor.ts';

export function getFuncStyleFromDesc(
  desc: {color?: string; icon?: string; libraryId?: string; category?: string},
  conn: ClientConn
): [CSSProperties, string] {
  let color: string;
  let icon: string;
  if (desc) {
    ({color, icon} = desc);
    if ((!color || !icon) && conn) {
      const catDesc =
        (desc.category && conn.getCategory(desc.category)) ||
        (desc.libraryId != null ? conn.getCategory(desc.libraryId) : conn.getCategory('other'));
      if (catDesc) {
        color = color || catDesc.color;
        icon = icon || catDesc.icon;
      }
    }
  }
  color = color || '999';
  return [{'--ticl-block-color': `#${color}`} as CSSProperties, icon];
}
