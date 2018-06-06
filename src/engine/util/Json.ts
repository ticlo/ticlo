function reviver(key: string, value: any) {
  if (typeof value === 'string' && value.length > 0 && value.charCodeAt(0) === 0x1B) {
    switch (value) {
      case '\u001bNaN':
        return NaN;
      case '\u001bInfinity':
        return Infinity;
      case '\u001b-Infinity':
        return -Infinity;
      default:
        return null;
    }
  }
  return value;
}

function replacer(key: string, value: any): any {
  if (typeof value === 'number') {
    if (value !== value) {
      return '\u001bNaN';
    }
    if (value === Infinity) {
      return '\u001bInfinity';
    }
    if (value === -Infinity) {
      return '\u001b-Infinity';
    }
  }
  return value;
}

// a special Json encoder that allows NaN and Infinity
export class Json {
  static parse(str: string): any {
    return JSON.parse(str, reviver);
  }

  static stringify(input: any, space?: string | number): string {
    return JSON.stringify(input, replacer, space);
  }
}
