import axios from 'axios';
import glob from 'glob';
import {lanToAntd} from '../../src/editor/util/Languages';

const keyReg = /^[0-9a-f]{32}$/;

async function main() {
  let key = process.argv[process.argv.length - 1];

  if (!keyReg.test(key)) {
    console.error('invalid key');
    return;
  }

  let pkgs = glob.sync(`./src/**/i18n/en.yaml`).map((str: string) => new TranslatePkg(str));

  for (let pkg of pkgs) {
    pkg.collectEn();
  }

  for (let lan of lanToAntd.keys()) {
    for (let pkg of pkgs) {
      pkg.collectLan(lan);
    }
  }

  console.log(pkgs);
  return;
  let result = await axios.post(
    'https://api.cognitive.microsofttranslator.com/translate',
    [
      {
        Text: 'Hello, what is your name?',
      },
    ],
    {
      headers: {'Ocp-Apim-Subscription-Key': key},
      params: {'api-version': '3.0', 'from': 'en', 'to': 'zh-hant'},
    }
  );
  console.log(JSON.stringify(result.data, null, 2));
}

main();
