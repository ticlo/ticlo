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

// match numbers in the end of inputs, as well as the array input []
const numberReg = /([0-9]+|\[\])$/;

export function translateFunction(funcId: string, name?: string, namespace?: string, lng?: string): string {
  if (!TicloI18nSettings.shouldTranslateFunction || !funcId) {
    return name || '';
  }
  if (!namespace) {
    namespace = 'core';
  }
  if (funcId.endsWith(':')) {
    // function categories and namespaces should be translated from @namespace
    funcId = `@namespace.${funcId.substring(0, funcId.length - 1)}`;
  }
  let i18ns = `ticlo-${namespace}`;
  return i18next.t(`${funcId}.@name`, {ns: i18ns, defaultValue: name, lng});
}

export function translateProperty(funcId: string, name: string, namespace?: string): string {
  if (!TicloI18nSettings.shouldTranslateFunction) {
    return name || '';
  }
  if (!namespace) {
    namespace = 'core';
  }
  let i18ns = `ticlo-${namespace}`;
  let numMatch = name.match(numberReg);
  let baseName = numMatch ? name.substr(0, numMatch.index) : name;

  let translated: string;
  if (funcId) {
    translated = i18next.t(`${funcId}.${baseName}.@name`, {
      ns: i18ns,
      defaultValue: '',
    });
  }
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

export function translateEnumOption(funcId: string, propName: string, option: string, namespace?: string): string {
  if (!TicloI18nSettings.shouldTranslateFunction) {
    return option || '';
  }
  if (!namespace) {
    namespace = 'core';
  }
  let i18ns = `ticlo-${namespace}`;
  let translated: string;
  if (funcId) {
    translated = i18next.t(`${funcId}.${propName}.@options.${option}`, {ns: i18ns, defaultValue: ''});
  }
  if (!translated) {
    // fallback to @shared property name
    translated = i18next.t(`@shared.${propName}.@options.${option}`, {
      ns: 'ticlo-core',
      defaultValue: option,
    });
  }
  return translated;
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
    ...options,
    ns: 'ticlo-editor',
  });
}

export function getKeywords(funcId: string, namespace?: string, lng?: string): string {
  if (!funcId) {
    return '';
  }
  if (!namespace) {
    namespace = 'core';
  }
  let i18ns = `ticlo-${namespace}`;
  return i18next.t(`${funcId}.@keywords`, {ns: i18ns, defaultValue: null, lng});
}
