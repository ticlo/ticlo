export class CssRules {
  sheet = new CSSStyleSheet();
  constructor() {
    const adoptedStyleSheets = (document as any).adoptedStyleSheets as any[];
    (document as any).adoptedStyleSheets = [...adoptedStyleSheets, this.sheet];
  }
  addRule(rule: string) {
    this.sheet.insertRule(rule);
  }

  destroy() {
    const adoptedStyleSheets = (document as any).adoptedStyleSheets as any[];
    const idx = adoptedStyleSheets.indexOf(this.sheet);
    if (idx > -1) {
      (document as any).adoptedStyleSheets = adoptedStyleSheets.toSpliced(idx, 1);
    }
  }
}

export const globalStyle = new CssRules();
