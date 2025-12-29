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

export type StyleObject = Record<string, string | number>;

export interface RuleHandle {
  remove: () => void;
}

export interface ScopeHandle extends RuleHandle {
  className: string;
}

interface RuleRef {
  cssText: string;
}

export class FastSheet {
  #sheet: CSSStyleSheet | null = null;
  #rules: RuleRef[] = [];

  constructor() {
    // 1. Create a pure CSSStyleSheet object (no DOM elements involved)
    this.#sheet = new CSSStyleSheet();

    // 2. Adopt it into the document
    // We must spread the existing sheets to avoid overwriting other styles
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.#sheet];
  }

  /**
   * Adds a raw CSS rule to the stylesheet.
   */
  addRule(selector: string, styles: StyleObject): RuleHandle {
    return this.addCssText(this.#compile(selector, styles));
  }

  addCssText(cssText: string): RuleHandle {
    if (!this.#sheet) return {remove: () => {}};

    const index = this.#rules.length;

    try {
      this.#sheet.insertRule(cssText, index);
    } catch (e) {
      console.error(`FastSheet: Failed to insert rule "${cssText}"`, e);
      return {remove: () => {}};
    }

    const ruleRef: RuleRef = {cssText};
    this.#rules.push(ruleRef);

    return {
      remove: () => this.#removeRule(ruleRef),
    };
  }

  /**
   * Generates a unique class name and attaches styles to it.
   */
  scope(styles: StyleObject): ScopeHandle {
    const name = 'c-' + Math.random().toString(36).substring(2, 9);
    const handle = this.addRule(`.${name}`, styles);

    return {
      className: name,
      remove: handle.remove,
    };
  }

  /**
   * Detaches the sheet from the document and clears memory.
   */
  destroy(): void {
    if (!this.#sheet) return;

    // Remove this specific sheet from the document's adopted list
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== this.#sheet);

    this.#sheet = null;
    this.#rules = [];
  }

  // --- Private Helpers ---

  #removeRule(ruleRef: RuleRef): void {
    if (!this.#sheet) return;

    // We must look up the index dynamically because removing other rules
    // shifts the indices of subsequent rules.
    const currentIndex = this.#rules.indexOf(ruleRef);

    if (currentIndex !== -1) {
      this.#sheet.deleteRule(currentIndex);
      this.#rules.splice(currentIndex, 1);
    }
  }

  #compile(selector: string, styles: StyleObject): string {
    const props = Object.entries(styles)
      .map(([key, value]) => `${this.#toKebab(key)}:${value}`)
      .join(';');
    return `${selector} { ${props}; }`;
  }

  #toKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }
}
