import i18next from 'i18next';

export async function init(lng?: string) {
  await new Promise((receive, reject) => {
    i18next.init({lng}, receive);
  });
}

export class TicloI18nSettings {
  static useLocalizedBlockName = true;
  static shouldTranslateFunction = true;
}

const numberReg = /[0-9]/;

export function translateFunction(funcId: string, name?: string, namespace?: string): string {
  if (!TicloI18nSettings.shouldTranslateFunction || !funcId) {
    return name || '';
  }
  if (!namespace) {
    namespace = 'core';
  }
  if (funcId.endsWith(':')) {
    funcId = `@namespace.${funcId.substring(0, funcId.length - 1)}`;
  }
  let i18ns = `ticlo-${namespace}`;
  return i18next.t(`${funcId}.@name`, {ns: i18ns, defaultValue: name});
}

export function translateProperty(funcId: string, name: string, namespace?: string): string {
  if (!TicloI18nSettings.shouldTranslateFunction || !funcId) {
    return name || '';
  }
  if (!namespace) {
    namespace = 'core';
  }
  let i18ns = `ticlo-${namespace}`;
  let numMatch = name.match(numberReg);
  let baseName = numMatch ? name.substr(0, numMatch.index) : name;
  let translated = i18next.t(`${funcId}.${baseName}.@name`, {
    ns: i18ns,
    defaultValue: '',
  });
  if (!translated) {
    // fallback to @shared property name
    translated = i18next.t(`@shared.${baseName}.@name`, {
      ns: 'ticlo-core',
      defaultValue: baseName,
    });
  }
  if (numMatch) {
    let numStr = name.substr(numMatch.index);
    return `${translated}${numStr}`;
  } else {
    return translated;
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
