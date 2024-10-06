import axios from 'axios';
import * as glob from 'glob';
import fs from 'fs';
import {lanToAntd} from '@ticlo/editor/util/Languages';
import {TranslatePkg} from './TranslatePkg';
import {OutputYamlData, YamlData} from './YamlData';
import {translate} from './TranslateRequest';

const keyReg = /^[0-9a-f]{32}$/;

async function main() {
  let key = process.argv.at(-1);

  if (!keyReg.test(key)) {
    console.error('invalid key');
    return;
  }

  let pkgs = glob.sync(`./src/**/i18n/en.yaml`, {posix: true}).map((str: string) => new TranslatePkg(str));

  for (let pkg of pkgs) {
    pkg.collectEn();
  }

  for (let lan of ['zh'] /*lanToAntd.keys()*/) {
    let outputs: OutputYamlData[] = [];
    let translateMap = new Map<string, string>();
    for (let pkg of pkgs) {
      let outputpkg = pkg.prepareOutput(lan);
      outputs.push(outputpkg);
      for (let [key, row] of outputpkg.toBeTranslated) {
        translateMap.set(row.enRow.value, null);
      }
    }
    await translate(translateMap, lan, key);
    for (let output of outputs) {
      output.applyTranslate(translateMap);
    }
  }

  // save a backup of current version

  return;
}

main();
