import {FunctionDesc} from "../block/Descriptor";
import * as i18n from "i18next";

export async function init(lng?: string) {
  i18n.init({lng});
}

const numberReg = /[0-9]/;

export function transLateClass(cls: string, namespace?: string): string {
  if (!cls) {
    return '';
  }
  let i18ns = namespace ? `ticlo-${namespace}` : 'ticlo-block';
  return i18n.t(`${cls}.$`, {ns: i18ns, defaultValue: cls});
}

export function transLateProperty(cls: string, name: string, namespace?: string): string {
  if (!(name && cls)) {
    return '';
  }
  let i18ns = namespace ? `ticlo-${namespace}` : 'ticlo-block';
  let numMatch = name.match(numberReg);
  if (numMatch) {
    let baseName = name.substr(0, numMatch.index);
    let numStr = name.substr(numMatch.index);
    let baseNameT = i18n.t(`${cls}.${baseName}.$`, {ns: i18ns, defaultValue: ''});
    if (baseNameT) {
      return `${baseNameT} ${numStr}`;
    } else {
      return name;
    }
  } else {
    return i18n.t(`${cls}.${name}.$`, {ns: i18ns, defaultValue: name});
  }
}
