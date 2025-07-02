import * as fs from 'fs';
import * as glob from 'glob';
import YAML from 'yaml';
import {DataMap} from '@ticlo/core/util/DataTypes';

function mergeData(to: DataMap, from: DataMap) {
  for (let key in from) {
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
  let outputs: Map<string, any> = new Map<string, any>();

  let files: string[] = glob.sync(`${src}/*.yaml`, {posix: true});

  for (let path of files) {
    if (path.endsWith('en.base.yaml')) {
      // ignore en base files
      continue;
    }
    console.log(`find ${path}`);
    let name = path.substring(path.lastIndexOf('/') + 1);
    let data = YAML.parse(fs.readFileSync(path, 'utf8'));
    if (outputs.has(name)) {
      mergeData(outputs.get(name), data);
    } else {
      let initData: any = {};
      for (let key in data) {
        if (key !== data[key]) {
          initData[key] = data[key];
        }
      }
      outputs.set(name, initData);
    }
  }

  for (let [name, data] of outputs) {
    let outname = name.replace('.yaml', '.json');
    console.log(`output ${outname}`);
    fs.writeFileSync(`${dest}/${outname}`, JSON.stringify(data, null, 1));
  }
}

for (let pkg of ['editor', 'core', 'web-server', 'html', 'node', 'react', 'test']) {
  let outdir = `./i18n/${pkg}`;
  if (!fs.existsSync(outdir)) {
    fs.mkdirSync(outdir);
  }
  mergeI18n(`./packages/${pkg}/**/i18n`, outdir);
}
