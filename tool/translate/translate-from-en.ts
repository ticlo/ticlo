import axios from 'axios';
import * as glob from 'glob';
import fs from 'fs';
import {lanToAntd} from '@ticlo/editor/util/Languages.js';
import {TranslatePkg} from './TranslatePkg.js';
import {OutputYamlData, YamlData} from './YamlData.js';
import {translate} from './TranslateRequest.js';

const keyReg = /^[0-9a-f]{32}$/;

async function main() {
  const key = process.argv.at(-1);

  if (!keyReg.test(key)) {
    console.error('invalid key');
    return;
  }

  const pkgs = glob.sync(`./packages/**/i18n/en.yaml`, {posix: true}).map((str: string) => new TranslatePkg(str));

  for (const pkg of pkgs) {
    pkg.collectEn();
  }

  for (const lan of ['zh', 'fr'] /*lanToAntd.keys()*/) {
    const outputs: OutputYamlData[] = [];
    const translateMap = new Map<string, string>();
    for (const pkg of pkgs) {
      const outputpkg = pkg.prepareOutput(lan);
      outputs.push(outputpkg);
      for (const [key, row] of outputpkg.toBeTranslated) {
        translateMap.set(row.enRow.value, null);
      }
    }
    await translate(translateMap, lan, key);
    for (const output of outputs) {
      output.applyTranslate(translateMap);
    }
  }

  // save a backup of current version

  return;
}

main();
