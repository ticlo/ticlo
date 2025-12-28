import * as fs from 'fs';
import * as glob from 'glob';
import YAML from 'yaml';
import {DataMap} from '@ticlo/core/util/DataTypes.js';

function mergeData(to: DataMap, from: DataMap) {
  for (const key in from) {
    if (Object.hasOwn(to, key)) {
      if (typeof to[key] === 'object') {
        mergeData(to[key] as DataMap, from[key] as DataMap);
      } else {
        throw new Error(`conflict on key: ${key}`);
      }
    } else {
      to[key] = from[key];
    }
  }
}

function mergeI18n(src: string, dest: string) {
  const outputs: Map<string, any> = new Map<string, any>();

  const files: string[] = glob.sync(`${src}/*.yaml`, {posix: true});

  for (const path of files) {
    if (path.endsWith('en.base.yaml')) {
      // ignore en base files
      continue;
    }
    console.log(`find ${path}`);
    const name = path.substring(path.lastIndexOf('/') + 1);
    const data = YAML.parse(fs.readFileSync(path, 'utf8'));
    if (outputs.has(name)) {
      mergeData(outputs.get(name), data);
    } else {
      const initData: any = {};
      for (const key in data) {
        if (key !== data[key]) {
          initData[key] = data[key];
        }
      }
      outputs.set(name, initData);
    }
  }

  for (const [name, data] of outputs) {
    const outname = name.replace('.yaml', '.json');
    console.log(`output ${outname}`);
    fs.writeFileSync(`${dest}/${outname}`, JSON.stringify(data, null, 1));
  }
}

for (const pkg of ['editor', 'core', 'web-server', 'html', 'node', 'react', 'test']) {
  const outdir = `./i18n/${pkg}`;
  if (!fs.existsSync(outdir)) {
    fs.mkdirSync(outdir);
  }
  mergeI18n(`./packages/${pkg}/**/i18n`, outdir);
}
