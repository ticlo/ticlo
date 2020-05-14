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
    this.checkTransBase(str);
  }

  checkTransBase(currentStr: string) {
    let transBasePath = `${this.path}en.base.yaml`;
    if (fs.existsSync(transBasePath)) {
      let str = fs.readFileSync(transBasePath, {encoding: 'utf8'});
      let baseData = new YamlData(str);
      for (let [key, row] of baseData.mapping) {
        if (this.enData.mapping.has(key)) {
          let newRow = this.enData.mapping.get(key);
          if (newRow.value === row.value) {
            newRow.changed = false;
          }
        }
      }
    }
    fs.writeFileSync(transBasePath, `# backup of en.yaml translated at ${new Date().toISOString()}\n\n${currentStr}`);
  }

  prepareOutput(locale: string): OutputYamlData {
    let yamlPath = `${this.path}${locale}.yaml`;
    let outputData = new OutputYamlData(this.enData, yamlPath);
    outputData.mergeExistingData();
    outputData.prepareTranslate();
    return outputData;
  }
}
