export const endsWithNumberReg = /\d$/;

/**
 * when sorting string, "A200" should come after "A9"
 */
export function smartStrCompare(str1: string, str2: string) {
  let len1 = str1.length;
  let len2 = str2.length;
  let lenMin = len1 < len2 ? len1 : len2;

  let numRslt = 0;
  let numSign = 1;
  let numLen = 0;
  let caseDif = 0;
  for (let i = 0; i < lenMin; ++i) {
    let code1 = str1.charCodeAt(i);
    let code2 = str2.charCodeAt(i);
    if (code1 >= 48 && code1 <= 57) {
      if (code2 >= 48 && code2 <= 57) {
        if (numRslt === 0) {
          numRslt = code1 - code2;
        }
        numLen++;
        continue;
      }
      numRslt = 1;
    } else if (code2 >= 48 && code2 <= 57) {
      numRslt = -1;
    }
    if (numLen > 0) {
      if (numRslt !== 0) {
        return numSign * numRslt;
      }
      numLen = 0;
    }
    if (code1 !== code2) {
      let code2Uppercase = -1;
      // swap '+' and '-', so '-' < '+'
      if (code1 === 43) {
        code1 = 45;
      } else if (code1 === 45) {
        code1 = 43;
      } else if (code1 >= 65 && code1 <= 90) {
        // to upper case
        code1 += 32;
      }
      if (code2 === 43) {
        code2 = 45;
      } else if (code2 === 45) {
        code2 = 43;
      } else if (code2 >= 65 && code2 <= 90) {
        // to upper case
        code2 += 32;
        code2Uppercase = 1;
      }

      if (code1 !== code2) {
        return code1 - code2;
      }
      if (caseDif === 0) {
        caseDif = code2Uppercase;
      }
    }
    if (code1 === 45) {
      numSign = -1;
    } else {
      numSign = 1;
    }
  }

  if (len1 === len2) {
    if (numLen > 0 && numRslt !== 0) {
      return numSign * numRslt;
    }
    return caseDif;
  }
  return numSign * (len1 - len2);
}

const trailingNumbers = /\d+$/;

export function getTailingNumber(str: string): number {
  let numbers = str.match(trailingNumbers);
  if (numbers) {
    return parseInt(numbers[0]);
  }
  return -1;
}

export function getPreNumber(str: string): string {
  let numbers = str.match(trailingNumbers);
  if (numbers) {
    return str.substring(0, str.length - numbers[0].length);
  }
  return null;
}

const colorPattern = /^#[a-fA-F0-9]{3,8}|rgba?\([\d ,.]{5,}\)$/;

export function isColorStr(str: string) {
  return colorPattern.test(str);
}

// escape everything and dot
export function encodeURITiclo(str: string) {
  return encodeURIComponent(str).replace(/\./g, '%2E');
}
