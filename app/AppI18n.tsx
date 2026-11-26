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
import enSqlite from '../i18n/sqlite/en.json' with {type: 'json'};
import zhSqlite from '../i18n/sqlite/zh.json' with {type: 'json'};
import enTsdb from '../i18n/tsdb/en.json' with {type: 'json'};
import zhTsdb from '../i18n/tsdb/zh.json' with {type: 'json'};
import enPostgres from '../i18n/postgres/en.json' with {type: 'json'};
import zhPostgres from '../i18n/postgres/zh.json' with {type: 'json'};
import enMysql from '../i18n/mysql/en.json' with {type: 'json'};
import zhMysql from '../i18n/mysql/zh.json' with {type: 'json'};
import enTest from '../i18n/test/en.json' with {type: 'json'};
import zhTest from '../i18n/test/zh.json' with {type: 'json'};
import enNode from '../i18n/node/en.json' with {type: 'json'};
import zhNode from '../i18n/node/zh.json' with {type: 'json'};

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
        'ticlo-sqlite': enSqlite,
        'ticlo-tsdb': enTsdb,
        'ticlo-postgres': enPostgres,
        'ticlo-mysql': enMysql,
        'ticlo-test': enTest,
        'ticlo-system': enNode,
      },
      zh: {
        'ticlo-editor': zhEditor,
        'ticlo-core': zhCore,
        'ticlo-react': zhReact,
        'ticlo-chart': zhChart,
        'ticlo-sqlite': zhSqlite,
        'ticlo-tsdb': zhTsdb,
        'ticlo-postgres': zhPostgres,
        'ticlo-mysql': zhMysql,
        'ticlo-test': zhTest,
        'ticlo-system': zhNode,
      },
    },
  });
}
