import i18next from 'i18next';

export async function init(lng?: string) {
  await new Promise((receive, reject) => {
    i18next.init({lng}, receive);
  });
}

export class TicloI18nSettings {
  static useLocalizedBlockName = true;
  static translatePropertyName = true;
}

const numberReg = /[0-9]/;

export function translateFunction(funcId: string, namespace?: string): string {
  if (!funcId) {
    return '';
  }
  if (!namespace) {
    namespace = 'core';
  }
  let i18ns = `ticlo-${namespace}`;
  return i18next.t(`${funcId}.@name`, {ns: i18ns, defaultValue: funcId});
}

export function translateProperty(funcId: string, name: string, namespace?: string): string {
  if (!TicloI18nSettings.translatePropertyName || !funcId) {
    return name || '';
  }
  if (!namespace) {
    namespace = 'core';
  }
  let i18ns = `ticlo-${namespace}`;
  let numMatch = name.match(numberReg);
  if (numMatch) {
    let baseName = name.substr(0, numMatch.index);
    let numStr = name.substr(numMatch.index);
    return `${i18next.t(`${funcId}.${baseName}.@name`, {
      ns: i18ns,
      defaultValue: baseName,
    })}${numStr}`;
  } else {
    return i18next.t(`${funcId}.${name}.@name`, {
      ns: i18ns,
      defaultValue: name,
    });
  }
}

export function translateEditor(key: string, options?: any, group?: string): string {
  if (group) {
    let result = i18next.t(`${group}.${key}`, {
      ns: 'ticlo-editor',
      defaultValue: '',
    });
    if (result) {
      return result;
    }
  }
  return i18next.t(key, {
    ns: 'ticlo-editor',
  });
}

export function translateEditorGroup(group: string) {
  return (key: string) => translateEditor(key, group);
}
