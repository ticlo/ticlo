// A i18next module that allows xxx_range processor for plural numbers
import {type PostProcessorModule} from 'i18next';

const rangedPostProcessor: PostProcessorModule = {
  name: 'ranged',
  type: 'postProcessor',

  process(value: string, key: string | string[], options: any, translator: any) {
    const p = value.split(';');

    const {count} = options;
    for (let item of p) {
      let parts = item.split('~');
      switch (parts.length) {
        case 2:
          if (count === parseFloat(parts[0])) {
            return parts[1];
          }
          continue;
        case 3:
          if (parts[0] && count < parseFloat(parts[0])) {
            continue;
          }
          if (parts[1] && count > parseFloat(parts[1])) {
            continue;
          }
          return parts[2];
      }
    }

    // not found, fallback to classical plural
    let {postProcess, ...newOptions} = options;

    let newKeys;
    if (typeof key === 'string') {
      newKeys = key.replace('_ranged', '');
    } else if (key.length > -1) {
      newKeys = key.map((k) => k.replace('_ranged', ''));
    }
    if (newKeys) {
      return translator.translate(newKeys, newOptions);
    }

    return value;
  },
};

export default rangedPostProcessor;
