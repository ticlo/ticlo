import {OutputYamlData, YamlData} from './YamlData.js';
import fs from 'fs';

export class TranslatePkg {
  path: string;

  constructor(public enPath: string) {
    this.path = enPath.substring(0, enPath.length - 'en.yaml'.length);
  }

  enData: YamlData;

  collectEn() {
    const str = fs.readFileSync(this.enPath, {encoding: 'utf8'});
    this.enData = new YamlData(str);
    this.enData.calculateValueHash();
  }

  prepareOutput(locale: string): OutputYamlData {
    const yamlPath = `${this.path}${locale}.yaml`;
    const outputData = new OutputYamlData(this.enData, yamlPath);
    outputData.mergeExistingData();
    outputData.prepareTranslate();
    return outputData;
  }
}
