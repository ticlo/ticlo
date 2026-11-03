import type {Locale} from 'antd/es/locale/index.js';
import enAntd from 'antd/es/locale/en_US.js';
import zhAntd from 'antd/es/locale/zh_CN.js';
import i18next from 'i18next';
import enEditor from '../i18n/editor/en.json' with {type: 'json'};
import zhEditor from '../i18n/editor/zh.json' with {type: 'json'};
import enCore from '../i18n/core/en.json' with {type: 'json'};
import zhCore from '../i18n/core/zh.json' with {type: 'json'};
import enReact from '../i18n/react/en.json' with {type: 'json'};
import zhReact from '../i18n/react/zh.json' with {type: 'json'};
import enChart from '../i18n/chart/en.json' with {type: 'json'};
import zhChart from '../i18n/chart/zh.json' with {type: 'json'};
import enTest from '../i18n/test/en.json' with {type: 'json'};
import zhTest from '../i18n/test/zh.json' with {type: 'json'};

export const antdLocales: Record<string, Locale> = {
  en: enAntd as unknown as Locale,
  zh: zhAntd as unknown as Locale,
};

export function initAppI18n() {
  return i18next.init({
    lng: 'en',
    resources: {
      en: {
        'ticlo-editor': enEditor,
        'ticlo-core': enCore,
        'ticlo-react': enReact,
        'ticlo-chart': enChart,
        'ticlo-test': enTest,
      },
      zh: {
        'ticlo-editor': zhEditor,
        'ticlo-core': zhCore,
        'ticlo-react': zhReact,
        'ticlo-chart': zhChart,
        'ticlo-test': zhTest,
      },
    },
  });
}
