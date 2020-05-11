import * as fs from 'fs';
import * as glob from 'glob';
import YAML from 'yaml';
import {DataMap} from '../src/core/util/DataTypes';

function mergeData(to: DataMap, from: DataMap) {
  for (let key in from) {
    if (to.hasOwnProperty(key)) {
      if (typeof to[key] === 'object') {
        mergeData(to[key], from[key]);
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

  let files: string[] = glob.sync(`${src}/*.yaml`);

  for (let path of files) {
    console.log(`find ${path}`);
    let name = path.substr(path.lastIndexOf('/') + 1);
    let data = YAML.parse(fs.readFileSync(path, 'utf8'));
    if (outputs.has(name)) {
      mergeData(outputs.get(name), data);
    } else {
      outputs.set(name, data);
    }
  }

  for (let [name, data] of outputs) {
    let outname = name.replace('.yaml', '.json');
    console.log(`output ${outname}`);
    fs.writeFileSync(`${dest}/${outname}`, JSON.stringify(data, null, 1));
  }
}

for (let pkg of ['editor', 'core', 'express', 'html', 'node', 'react']) {
  let outdir = `./i18n/${pkg}`;
  if (!fs.existsSync(outdir)) {
    fs.mkdirSync(outdir);
  }
  mergeI18n(`./src/${pkg}/**/i18n`, outdir);
}
