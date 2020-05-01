function encodeTicloNameReplacer(str: string) {
  let code = str.charCodeAt(0);
  if (code < 32) {
    return '';
  }
  return `%${code.toString(16).padStart(2)}`;
}

// escape everything and dot
export function encodeTicloName(str: string) {
  return str.replace(/[\u0000-\u0020.\\\/?%*"|:<>]/g, encodeTicloNameReplacer);
}

export function getDisplayName(name: string, disp: string) {
  if (disp && typeof disp === 'string') {
    return disp;
  }
  if (name && name.includes('%')) {
    try {
      return decodeURIComponent(name);
    } catch (e) {}
  }
  return name;
}
