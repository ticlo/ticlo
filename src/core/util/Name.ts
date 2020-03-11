
// escape everything and dot
export function encodeURITiclo(str: string) {
  return encodeURIComponent(str).replace(/\./g, '%2E');
}

