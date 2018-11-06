import {FunctionDesc} from "../block/Descriptor";
import * as i18n from "i18next";

export async function init(lng?: string) {
  await new Promise((receive, reject) => {
    i18n.init({lng}, receive);
  });
}

const numberReg = /[0-9]/;

export function transLateType(type: string, namespace?: string): string {
  if (!type) {
    return '';
  }
  let i18ns = namespace ? `ticlo-${namespace}` : 'ticlo-block';
  return i18n.t(`${type}.@name`, {ns: i18ns, defaultValue: type});
}

export function transLateProperty(type: string, name: string, namespace?: string): string {
  if (!(name && type)) {
    return '';
  }
  let i18ns = namespace ? `ticlo-${namespace}` : 'ticlo-block';
  let numMatch = name.match(numberReg);
  if (numMatch) {
    let baseName = name.substr(0, numMatch.index);
    let numStr = name.substr(numMatch.index);
    return `${i18n.t(`${type}.${baseName}.@name`, {ns: i18ns, defaultValue: baseName})}${numStr}`;
  } else {
    return i18n.t(`${type}.${name}.@name`, {ns: i18ns, defaultValue: name});
  }
}
