import i18next from 'i18next';

export async function init(lng?: string) {
  await new Promise((receive, reject) => {
    i18next.init({lng, nsSeparator: false}, receive);
  });
}

export class TicloI18nSettings {
  static useLocalizedBlockName = true;
  static shouldTranslateFunction = true;
}

// match numbers in the end of inputs, as well as the array input []
const numberReg = /([0-9]+|\[\])$/;

export function translateFunction(funcId: string, funcName?: string, namespace?: string, lng?: string): string {
  if (!TicloI18nSettings.shouldTranslateFunction || !funcId) {
    return funcName || '';
  }
  if (!namespace) {
    namespace = 'core';
  }
  let funcNameKey = funcName;
  if (funcId.endsWith(':')) {
    // function categories and namespaces should be translated from @namespace
    funcNameKey = `@namespace.${funcId.substring(0, funcId.length - 1)}`;
  } else {
    let dotPos = funcName.lastIndexOf('.');
    if (dotPos > 0 && dotPos < funcName.length - 1) {
      funcName = funcName.substring(dotPos + 1);
    }
  }
  let i18ns = `ticlo-${namespace}`;
  return i18next.t(`${funcNameKey}.@name`, {ns: i18ns, defaultValue: funcName, lng});
}

export function translateProperty(funcName: string, propName: string, namespace?: string): string {
  if (!TicloI18nSettings.shouldTranslateFunction) {
    return propName || '';
  }
  if (!namespace) {
    namespace = 'core';
  }
  let i18ns = `ticlo-${namespace}`;
  let numMatch = propName.match(numberReg);
  let baseName = numMatch ? propName.substr(0, numMatch.index) : propName;

  let translated: string;
  if (funcName) {
    translated = i18next.t(`${funcName}.${baseName}.@name`, {
      ns: i18ns,
      defaultValue: '',
    });
  }
  if (!translated && namespace !== 'core') {
    // fallback to @shared property name
    translated = i18next.t(`@shared.${baseName}.@name`, {
      ns: i18ns,
      defaultValue: '',
    });
  }
  if (!translated) {
    // fallback to @shared property name in core namespace
    translated = i18next.t(`@shared.${baseName}.@name`, {
      ns: 'ticlo-core',
      defaultValue: baseName,
    });
  }
  if (numMatch) {
    let numStr = propName.substr(numMatch.index);
    return `${translated}${numStr}`;
  } else {
    return translated;
  }
}

export function translateEnumOption(funcName: string, propName: string, option: string, namespace?: string): string {
  if (!TicloI18nSettings.shouldTranslateFunction) {
    return option || '';
  }
  if (!namespace) {
    namespace = 'core';
  }
  let i18ns = `ticlo-${namespace}`;
  let translated: string;
  if (funcName) {
    translated = i18next.t(`${funcName}.${propName}.@options.${option}`, {
      ns: i18ns,
      defaultValue: '',
    });
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

export function translateEditor(key: string, options?: any): string {
  return i18next.t(key, {
    ...options,
    ns: 'ticlo-editor',
  });
}

export function getKeywords(funcName: string, namespace?: string, lng?: string): string {
  if (!funcName) {
    return '';
  }
  if (!namespace) {
    namespace = 'core';
  }
  let i18ns = `ticlo-${namespace}`;
  return i18next.t(`${funcName}.@keywords`, {ns: i18ns, defaultValue: null, lng});
}
