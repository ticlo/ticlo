function encodeURITicloReplacer(str: string) {
  let code = str.charCodeAt(0);
  if (code < 32) {
    return '';
  }
  return `%${code.toString(16).padStart(2)}`;
}

// escape everything and dot
export function encodeURITiclo(str: string) {
  return str.replace(/[\u0000-\u0020.\\?%*"|:<>]/g, encodeURITicloReplacer);
}
