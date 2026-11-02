import type {Plugin} from 'chart.js';

type ConfigObject = Record<string, unknown>;

const callbacks = new Map<string, Function>();
const plugins = new Map<string, Plugin>();

export function registerChartCallback(id: string, callback: Function) {
  callbacks.set(id, callback);
}

export function registerChartPlugin(id: string, plugin: Plugin) {
  plugins.set(id, plugin);
}

export function asObject(value: unknown): ConfigObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as ConfigObject) : {};
}

function plainObject(value: unknown): value is ConfigObject {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

function unsafeKey(key: string) {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

export function cloneConfig<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneConfig) as T;
  if (!plainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (unsafeKey(key)) throw new Error(`Unsafe Chart.js option key: ${key}`);
      return [key, cloneConfig(child)];
    })
  ) as T;
}

export function mergeConfig(base: ConfigObject, override: ConfigObject): ConfigObject {
  const result = cloneConfig(base);
  for (const [key, value] of Object.entries(override)) {
    if (unsafeKey(key)) throw new Error(`Unsafe Chart.js option key: ${key}`);
    if (value === undefined) continue;
    const previous = result[key];
    result[key] = plainObject(previous) && plainObject(value) ? mergeConfig(previous, value) : cloneConfig(value);
  }
  return result;
}

function pointerParts(path: string): string[] {
  if (!path.startsWith('/')) throw new Error(`Chart callback path must be a JSON Pointer: ${path}`);
  const parts = path
    .slice(1)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
  if (parts.some(unsafeKey)) throw new Error(`Unsafe chart callback path: ${path}`);
  return parts;
}

export function applyCallbackRefs(target: ConfigObject, refs: unknown) {
  for (const [path, id] of Object.entries(asObject(refs))) {
    if (typeof id !== 'string') throw new Error(`Chart callback reference must be a string: ${path}`);
    const callback = callbacks.get(id);
    if (!callback) throw new Error(`Chart callback is not registered: ${id}`);
    const parts = pointerParts(path);
    let object = target;
    let blocked = false;
    for (const part of parts.slice(0, -1)) {
      if (object[part] === undefined) object[part] = {};
      else if (!plainObject(object[part]) && !Array.isArray(object[part])) {
        blocked = true;
        break;
      }
      object = object[part] as ConfigObject;
    }
    if (!blocked) object[parts[parts.length - 1]] = callback;
  }
}

export function resolveChartPlugins(value: unknown): Plugin[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item !== 'string') return item as Plugin;
    const plugin = plugins.get(item);
    if (!plugin) throw new Error(`Chart plugin is not registered: ${item}`);
    return plugin;
  });
}
