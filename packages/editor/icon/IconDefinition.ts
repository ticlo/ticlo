export interface IconText {
  text: string;
  position: string;
  fontSize: number;
}

export interface IconBackground {
  type: 'svg' | 'path';
  value: string;
}

export function parseIcon(icon: string): {background?: IconBackground; texts: IconText[]} {
  let background: IconBackground;
  const texts: IconText[] = [];
  for (const part of icon?.split(/ {2,}/) ?? []) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const prefix = part.substring(0, colon);
    const value = part.substring(colon + 1);
    if (prefix === 'svg' || prefix === 'path') {
      if (!background && value.trim() && (prefix === 'path' || /^[\w-]+$/.test(value))) {
        background = {type: prefix, value};
      }
      continue;
    }

    const match = /^([tb]?[lr]?)(\d+(?:\.\d+)?)?$/.exec(prefix);
    if (!match || !value || /[\u0000-\u001f]/.test(value)) continue;
    const position = match[1];
    const fontSize = match[2] ? Number(match[2]) : position ? 9 : 18;
    if (fontSize > 0 && Number.isFinite(fontSize)) texts.push({text: value, position, fontSize});
  }
  return {background, texts};
}

export function svgBackground(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.trim())}")`;
}

export function pathBackground(path: string): string {
  const escaped = path.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  return svgBackground(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="white"><path d="${escaped}"/></svg>`
  );
}
