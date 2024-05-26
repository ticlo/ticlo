import i18next from 'i18next';
import rangePlural from './i18n-ranged-plural';
import {nameFromPath} from './String';
import {DataMap} from './DataTypes';

export async function init(lng?: string) {
  await new Promise((receive, reject) => {
    i18next.use(rangePlural).init({lng, nsSeparator: false}, receive);
    i18next.services.formatter.add('optional', (value, lng, options) => {
      if (value == null) {
        return '';
      }
      return value;
    });
    i18next.services.formatter.add('abs', (value: any, lng, options) => {
      if (value < 0) {
        return -value;
      }
      return value;
    });
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
    return nameFromPath(funcName) || '';
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
  let baseName = numMatch ? propName.substring(0, numMatch.index) : propName;

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
    let numStr = propName.substring(numMatch.index);
    return `${translated}${numStr}`;
  } else {
    return translated;
  }
}

export function translatePropContent(
  funcName: string,
  propName: string,
  content: string,
  namespace?: string,
  options?: any
): string {
  if (!TicloI18nSettings.shouldTranslateFunction) {
    if (!content || content.startsWith('@')) {
      return '';
    }
    return options?.defaultValue ?? content;
  }
  if (!namespace) {
    namespace = 'core';
  }
  let i18ns = `ticlo-${namespace}`;
  let translated: string;
  if (funcName) {
    translated = i18next.t(`${funcName}.${propName}.@options.${content}`, {
      ns: i18ns,
      defaultValue: '',
      ...options,
    }) as string;
  }
  if (!translated) {
    // fallback to @shared property name
    translated = i18next.t(`@shared.${propName}.@options.${content}`, {
      ns: 'ticlo-core',
      defaultValue: content,
      ...options,
    }) as string;
  }
  return translated;
}

export function translateEditor(key: string, options?: DataMap): string {
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
