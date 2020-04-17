declare module 'lodash/debounce' {
  interface Debounce {
    (): void;
    cancel(): void;
  }

  export default function debounce(func: Function, wait: number, options?: any): Debounce;
}

declare module 'lodash/clamp' {
  export default function clamp(n: number, low: number, high: number): number;
}
