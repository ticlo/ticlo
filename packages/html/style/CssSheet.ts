import {encodeSorted} from '@ticlo/core';
import {NoSerialize} from '@ticlo/core/util/NoSerialize.js';

// helper functions

// DJB2 hash algorithm
function hashStr(str: string): string {
  let hash = 5381;
  let i = str.length;
  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }
  return (hash >>> 0).toString(36).substring(1);
}

function compile(selector: string, style: StyleObject): string | null {
  if (typeof selector !== 'string' || !Object.isExtensible(style)) {
    return null;
  }
  const props = Object.entries(style)
    .map(([key, value]) => `${toKebab(key)}:${value}`)
    .join(';');
  return `${selector} { ${props}; }`;
}

function toKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

const voidRemove = {remove: () => {}};

export type StyleObject = Record<string, string | number>;

export interface RuleHandle {
  className?: string;
  remove: () => void;
}

export interface ICssSheet {
  addRule(selector: string, style: StyleObject): RuleHandle;
  addRuleGroup(className: string, style: StyleObject, additional: {selector: string; style: StyleObject}[]): RuleHandle;
  destroy(): void;
}

export class CssSheet extends NoSerialize implements ICssSheet {
  private _sheet: CSSStyleSheet | null = null;
  // Map cssText -> { count, active }
  private _rules = new Map<string, {count: number; active: boolean}>();
  // Keep track of active rules in order to manage sheet indices
  private _activeRules: string[] = [];
  private _pendingDestroy = false;
  private _pendingAdopt = false;

  constructor(public readonly defaultPrefix: string = 'ticl-c') {
    super('CssSheet');
    // 1. Create a pure CSSStyleSheet object (no DOM elements involved)
    this._sheet = new CSSStyleSheet();
    this._pendingAdopt = true;
  }

  /**
   * Adds a raw CSS rule to the stylesheet.
   */
  addRule(selector: string, style: StyleObject): RuleHandle {
    const css = compile(selector, style);
    return css ? this.addCssText(css) : voidRemove;
  }

  addRuleGroup(
    className: string,
    style: StyleObject,
    additional: {selector: string; style: StyleObject}[]
  ): RuleHandle {
    if (!className) {
      className = this.defaultPrefix + '-?';
    }
    let finalClass = className;
    if (finalClass.includes('?')) {
      if (finalClass.startsWith('?-')) {
        finalClass = this.defaultPrefix + finalClass.substring(1);
      } else if (!Object.isExtensible(style)) {
        // If we cannot compile the main style, we cannot generate a stable hash
        return voidRemove;
      }
      const stableKey = encodeSorted(style);
      finalClass = finalClass.replace('?', hashStr(stableKey));
    }

    const handles: RuleHandle[] = [];

    // Main Rule
    const mainCss = compile(`.${finalClass}`, style);
    if (mainCss) {
      handles.push(this.addCssText(mainCss));
    }

    // Additional Rules
    for (const add of additional) {
      const sel = add.selector.replace(/&/g, `.${finalClass}`);
      const css = compile(sel, add.style);
      if (css) {
        handles.push(this.addCssText(css));
      }
    }

    let removed = false;
    return {
      className: finalClass,
      remove: () => {
        if (removed) return;
        removed = true;
        handles.forEach((h) => h.remove());
      },
    };
  }

  addCssText(cssText: string): RuleHandle {
    let record = this._rules.get(cssText);
    if (!record) {
      record = {count: 0, active: false};
      this._rules.set(cssText, record);
    }
    record.count++;
    scheduleFlush(this);

    let removed = false;
    return {
      remove: () => {
        if (removed) return;
        removed = true;

        // Re-fetch record? No, object ref is stable in Map value
        // But we should check if it still exists or count > 0 safety
        if (record.count > 0) {
          record.count--;
          scheduleFlush(this);
        }
      },
    };
  }

  /**
   * Detaches the sheet from the document and clears memory.
   */
  destroy(): void {
    if (!this._sheet) return;
    this._pendingDestroy = true;
    scheduleFlush(this);
  }

  /**
   * Applies pending changes to the CSSStyleSheet.
   * This is called by the global batching loop.
   */
  flush() {
    if (!this._sheet) return;

    if (this._pendingDestroy) {
      if (!this._pendingAdopt) {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== this._sheet);
      }
      this._sheet = null;
      this._rules.clear();
      this._activeRules = [];
      this._pendingAdopt = false;
      return;
    }

    if (this._pendingAdopt) {
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, this._sheet!];
      this._pendingAdopt = false;
    }

    // 1. Remove rules that have count 0
    // Iterate backwards to preserve indices of earlier rules during deletion
    for (let i = this._activeRules.length - 1; i >= 0; i--) {
      const cssText = this._activeRules[i];
      const record = this._rules.get(cssText);

      if (record && record.count === 0) {
        try {
          this._sheet.deleteRule(i);
        } catch (e) {
          console.error(`CssSheet: Failed to delete rule at index ${i}`, e);
        }
        this._activeRules.splice(i, 1);
        record.active = false;
        // Optional: Remove from Map to free memory if count stays 0?
        // keeping it is fine for now, allows resurrection.
        this._rules.delete(cssText);
      }
    }

    // 2. Add rules that are count > 0 but not active
    // We iterate the Map to find pending additions.
    // Order of iteration is insertion order, which is generally what we want.
    for (const [cssText, record] of this._rules) {
      if (record.count > 0 && !record.active) {
        try {
          // Append to end
          const index = this._activeRules.length;
          this._sheet.insertRule(cssText, index);
          this._activeRules.push(cssText);
          record.active = true;
        } catch (e) {
          console.error(`CssSheet: Failed to insert rule "${cssText}"`, e);
          // If it fails, we still mark it as active effectively or remove it?
          // Mark active to stop retry loop, but it's not in sheet.
          record.active = true;
        }
      }
    }
  }
}

export class DisabledCssSheet extends NoSerialize implements ICssSheet {
  constructor() {
    super('DisabledCssSheet');
  }
  addRule(selector: string, style: StyleObject): RuleHandle {
    return voidRemove;
  }
  addRuleGroup(
    className: string,
    style: StyleObject,
    additional: {selector: string; style: StyleObject}[]
  ): RuleHandle {
    return voidRemove;
  }
  destroy(): void {
    return;
  }
}

// Global batching system
const flushQueue = new Set<CssSheet>();
let flushScheduled = false;

function scheduleFlush(sheet: CssSheet) {
  flushQueue.add(sheet);
  if (!flushScheduled) {
    flushScheduled = true;
    requestAnimationFrame(flushAll);
  }
}

function flushAll() {
  flushScheduled = false;
  const queue = [...flushQueue];
  flushQueue.clear();
  queue.forEach((sheet) => sheet.flush());
}

export const globalStyle = new CssSheet();
