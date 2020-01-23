export class CssRules {
  sheet = new CSSStyleSheet();
  constructor() {
    let adoptedStyleSheets = (document as any).adoptedStyleSheets as any[];
    (document as any).adoptedStyleSheets = [...adoptedStyleSheets, this.sheet];
  }
  addRule(rule: string) {
    this.sheet.insertRule(rule);
  }

  destroy() {
    let adoptedStyleSheets = (document as any).adoptedStyleSheets as any[];
    let idx = adoptedStyleSheets.indexOf(this.sheet);
    if (idx > -1) {
      (document as any).adoptedStyleSheets = adoptedStyleSheets.splice(idx, 1);
    }
  }
}

export const globalStyle = new CssRules();
