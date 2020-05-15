import {OutputYamlData, YamlData} from './YamlData';
import fs from 'fs';

export class TranslatePkg {
  path: string;

  constructor(public enPath: string) {
    this.path = enPath.substring(0, enPath.length - 'en.yaml'.length);
  }

  enData: YamlData;

  collectEn() {
    let str = fs.readFileSync(this.enPath, {encoding: 'utf8'});
    this.enData = new YamlData(str);
    this.enData.calculateValueHash();
  }

  prepareOutput(locale: string): OutputYamlData {
    let yamlPath = `${this.path}${locale}.yaml`;
    let outputData = new OutputYamlData(this.enData, yamlPath);
    outputData.mergeExistingData();
    outputData.prepareTranslate();
    return outputData;
  }
}
