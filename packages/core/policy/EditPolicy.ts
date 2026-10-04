import {type DataMap, isSavedBlock} from '../util/DataTypes.ts';
import {splitPathName} from '../util/Path.ts';

/**
 * Serializable editing limits. Omitted allow lists permit all; empty ones permit none.
 * Client path grants include the complete subtree; denied descendants cannot revoke an ancestor grant.
 * Command, property, binding and block restrictions still apply independently.
 * For bindings, allowBinding replaces allowProps/denyProps when supplied.
 * Paths, field names and block types support `*`, `**` and numeric `?`; commands use exact names.
 * Fine-grained limits apply on the client. Writable policies bypass server policy checks.
 * Readonly policies reject server edits and check read paths; commands receive the readonly flag.
 */
export interface EditPolicy {
  /** The server's only write restriction. Defaults to false. */
  readonly readonly?: boolean;
  /** Client writable paths grant every descendant. Readonly server reads do not inherit grants. */
  readonly allowPaths?: readonly string[];
  /** Additional read paths for readonly servers. Does not narrow allowPaths; denyPaths takes priority.
   * For example, allowPaths: ['Main.**'], readonlyPaths: ['Main'] also permits watching Main itself.
   */
  readonly readonlyPaths?: readonly string[];
  /** Cancels matching client grants, but cannot revoke an ancestor grant. Readonly server denies take priority. */
  readonly denyPaths?: readonly string[];
  readonly allowCmds?: readonly string[];
  readonly denyCmds?: readonly string[];
  readonly allowProps?: readonly string[];
  readonly denyProps?: readonly string[];
  /** Binding target names. Overrides allowProps/denyProps for bindings; supports the same patterns. */
  readonly allowBinding?: readonly string[];
  readonly allowCreateBlock?: boolean;
  readonly allowDeleteBlock?: boolean;
  readonly allowChangeBlockType?: boolean;
  readonly allowBlockTypes?: readonly string[];
  readonly denyBlockTypes?: readonly string[];
}

const unrestrictedCommands = new Set([
  'get',
  'list',
  'query',
  'subscribe',
  'watch',
  'watchDesc',
  'getSettings',
  'getFlowState',
  'close',
  'undo',
  'redo',
]);

/** `*` stays within a segment; `**` spans segments; `?` matches one or more digits (0-9).
 * A trailing `.**` requires a descendant, so `Main.**` does not match `Main` itself.
 */
export function matchEditPath(pattern: string, path: string): boolean {
  const patterns = pattern.split('.');
  const parts = path.split('.');
  const memo = new Map<string, boolean>();
  function match(i: number, j: number): boolean {
    const key = `${i}:${j}`;
    if (memo.has(key)) return memo.get(key);
    let result: boolean;
    if (i === patterns.length) {
      result = j === parts.length;
    } else if (patterns[i] === '**') {
      result = i === patterns.length - 1 ? j < parts.length : match(i + 1, j) || (j < parts.length && match(i, j + 1));
    } else {
      const expression = patterns[i].replace(/[.*+?^${}()|[\]\\]/g, (char) =>
        char === '*' ? '.*' : char === '?' ? '[0-9]+' : `\\${char}`
      );
      result = j < parts.length && new RegExp(`^${expression}$`).test(parts[j]) && match(i + 1, j + 1);
    }
    memo.set(key, result);
    return result;
  }
  return match(0, 0);
}

function allowed(allow: readonly string[], deny: readonly string[], value: string): boolean {
  return !deny?.some((p) => matchEditPath(p, value)) && (!allow || allow.some((p) => matchEditPath(p, value)));
}

function checkDescendants(paths: readonly string[], denyPaths: readonly string[], target: string): string | null {
  if (
    paths &&
    !paths.some(
      (p) => p === '**' || (p.endsWith('.**') && (matchEditPath(p, target) || matchEditPath(p.slice(0, -3), target)))
    )
  )
    return 'restricted path';
  if (
    denyPaths?.some((p) => {
      const wildcard = p.search(/[*?]/);
      const prefix = wildcard < 0 ? p : p.slice(0, wildcard);
      return (
        !target ||
        !prefix ||
        prefix === target ||
        prefix.startsWith(`${target}.`) ||
        (wildcard < 0 ? target.startsWith(`${prefix}.`) : target.startsWith(prefix))
      );
    })
  )
    return 'restricted path';
  return null;
}

/** Readonly server checks never inspect edit payloads or field/type limits. */
function checkReadonlyPolicy(policy: EditPolicy, request: DataMap, lookup?: EditPolicyLookup): string | null {
  if (!policy?.readonly || !request) return null;
  const {cmd, path} = request as {cmd: string; path: string};
  if (cmd === 'close') return null;
  if (
    cmd === 'undo' ||
    cmd === 'redo' ||
    (cmd === 'copy' && request.cut) ||
    (!unrestrictedCommands.has(cmd) && cmd !== 'copy' && cmd !== 'executeCommand')
  )
    return 'readonly';
  if (
    (cmd === 'query' || cmd === 'executeCommand') &&
    (policy.denyCmds?.includes(cmd) || (policy.allowCmds && !policy.allowCmds.includes(cmd)))
  )
    return 'restricted command';
  if (typeof path !== 'string') return 'invalid path';
  const paths =
    policy.allowPaths && policy.readonlyPaths ? [...policy.allowPaths, ...policy.readonlyPaths] : policy.allowPaths;
  const checkPath = (target: string) => (allowed(paths, policy.denyPaths, target) ? null : 'restricted path');
  const checkWhole = (target: string) => checkDescendants(paths, policy.denyPaths, target) || checkPath(target);
  const error = cmd === 'query' ? checkWhole(path) : checkPath(cmd === 'getSettings' ? '' : path);
  if (error) return error;
  if (cmd === 'copy') {
    for (const name of (request.props as string[]) ?? []) {
      const target = path ? `${path}.${name}` : name;
      const error = lookup?.(target) ? checkWhole(target) : checkPath(target);
      if (error) return error;
    }
  }
  return null;
}

/** A read-only lookup. The client may use its caches; readonly server copies use authoritative state. */
export type EditPolicyLookup = (path: string) => boolean;

export function checkEditPolicy(
  policy: EditPolicy,
  request: DataMap,
  lookup?: EditPolicyLookup,
  mode: 'client' | 'server' | 'preview' = 'client'
): string | null {
  if (mode === 'server') return checkReadonlyPolicy(policy, request, lookup);
  if (!policy || !request) return null;
  const {cmd, path} = request as {cmd: string; path: string};
  const unrestricted = unrestrictedCommands.has(cmd) || (cmd === 'copy' && !request.cut);
  if (cmd === 'close') return null;
  if (policy.readonly && (!unrestricted || cmd === 'undo' || cmd === 'redo')) return 'readonly';
  if (unrestricted) return null;
  if (policy.denyCmds?.includes(cmd) || (policy.allowCmds && !policy.allowCmds.includes(cmd))) {
    return 'restricted command';
  }
  if (typeof path !== 'string') return 'invalid path';
  const preview = mode === 'preview';
  const autoName = cmd === 'addBlock' && Boolean(request.findName);
  const paths = policy.allowPaths;

  const checkPath = (target: string): string | null =>
    allowed(paths, policy.denyPaths, target) ? null : target ? checkPath(splitPathName(target)[0]) : 'restricted path';
  const checkProp = (target: string, binding = false) => {
    const error = checkPath(target);
    if (error) return error;
    const name = splitPathName(target)[1];
    if (binding && policy.allowBinding != null)
      return allowed(policy.allowBinding, undefined, name) ? null : 'restricted binding';
    return allowed(policy.allowProps, policy.denyProps, name) ? null : 'restricted property';
  };
  const checkType = (type: unknown) => {
    if (type === undefined && policy.allowBlockTypes?.length !== 0) return null; // UI capability query
    return typeof type === 'string' && allowed(policy.allowBlockTypes, policy.denyBlockTypes, type)
      ? null
      : 'restricted block type';
  };
  const hasFieldLimits = policy.allowProps != null || Boolean(policy.denyProps?.length);
  const hasTypeLimits = policy.allowBlockTypes != null || Boolean(policy.denyBlockTypes?.length);
  const hasStructureLimits =
    policy.allowBinding != null ||
    policy.allowCreateBlock === false ||
    policy.allowDeleteBlock === false ||
    policy.allowChangeBlockType === false ||
    hasTypeLimits;
  const hasWriteLimits = hasFieldLimits || hasStructureLimits;
  if (!hasWriteLimits) lookup = undefined;

  // Schema changes can affect fields beyond those explicitly named in a request.
  const checkWhole = (target: string, checkStructure = true): string | null =>
    hasFieldLimits || (checkStructure && hasStructureLimits) ? 'restricted operation' : checkPath(target);

  const checkData = (target: string, data: DataMap, creating = false): string | null => {
    if (!hasWriteLimits && !checkPath(target)) return null;
    for (const [name, value] of Object.entries(data)) {
      if (!creating && name === '#_copy_from') continue; // Clipboard metadata is not written to the block.
      const field = name.startsWith('~') && typeof value === 'string' ? name.slice(1) : name;
      let error: string;
      if (name === '#static' && value && typeof value === 'object') {
        error = checkData(`${target}.${field}`, value as DataMap);
      } else if (name.startsWith('~') && value && typeof value === 'object') {
        error = checkValue(`${target}.${name}`, {'#is': '', ...(value as DataMap)}, true);
      } else if (creating && name === '#is') {
        error = checkProp(`${target}.${field}`);
      } else {
        error = checkValue(`${target}.${field}`, value, true, name.startsWith('~'));
      }
      if (error) return error;
    }
    return null;
  };
  const checkCreate = (target: string, data?: DataMap): string | null => {
    if (policy.allowCreateBlock === false) return 'restricted block creation';
    if (policy.allowBlockTypes?.length === 0) return 'restricted block type';
    const error = checkPath(target) || checkType(data?.['#is'] ?? (preview ? undefined : ''));
    if (error) return error;
    // A helper block also replaces the parent field's binding.
    const [parent, name] = splitPathName(target);
    if (name.startsWith('~')) {
      if (autoName && target === path) {
        const names = policy.allowBinding ?? policy.allowProps;
        if (
          (names && !names.some((p) => p === '*' || p === '**')) ||
          (policy.allowBinding == null && policy.denyProps?.length)
        )
          return 'restricted binding';
      }
      const bindingError = checkProp(`${parent}.${name.slice(1)}`, true);
      if (bindingError) return bindingError;
    }
    return data ? checkData(target, data, true) : null;
  };
  const checkDelete = (target: string): string | null =>
    policy.allowDeleteBlock === false ? 'restricted block deletion' : checkWhole(target, false);
  const checkValue = (target: string, value: unknown, hasValue: boolean, binding = false): string | null => {
    if (!hasWriteLimits) return checkPath(target);
    // Automatically named blocks do not replace the requested name's existing subtree.
    const existing = hasValue && !autoName && !(cmd === 'paste' && request.resolve === 'rename') && lookup?.(target);
    if (existing) {
      // Replacing a block can remove children omitted from the payload.
      const error = checkDelete(target);
      if (error) return error;
    }
    if (isSavedBlock(value) && typeof value['#is'] !== 'object') {
      if (existing && policy.allowChangeBlockType === false) return 'restricted block type change';
      if (typeof value['~#is'] === 'string' && (hasTypeLimits || policy.allowChangeBlockType === false))
        return 'restricted block type';
      return checkCreate(target, value);
    }
    binding ||= cmd === 'bind';
    const error = checkProp(target, binding);
    if (error) return error;
    const field = splitPathName(target)[1];
    if (field !== '#is' && field !== '~#is') return null;
    if (policy.allowChangeBlockType === false) return 'restricted block type change';
    if (binding || field === '~#is') return hasTypeLimits ? 'restricted block type' : null;
    return checkType(hasValue ? (value ?? '') : undefined);
  };

  switch (cmd) {
    case 'deleteBlock': {
      const parent = splitPathName(path)[0];
      return checkDelete(path) || checkProp(parent ? `${parent}.#order` : '#order');
    }
    case 'set':
    case 'update':
      return checkValue(path, request.value, !preview || Object.hasOwn(request, 'value'));
    case 'bind':
      return checkValue(path, undefined, false) || (lookup?.(path) ? checkDelete(path) : null);
    case 'restoreSaved':
      // The saved type is not present in the request, so it cannot be checked against a type list.
      if (splitPathName(path)[1] === '#is' && hasTypeLimits) return 'restricted block type';
      return checkValue(path, undefined, false) || (lookup?.(path) ? checkWhole(path) : null);
    case 'addBlock':
      if (request.orderIndex !== undefined) {
        const parent = splitPathName(path)[0];
        const error = checkProp(parent ? `${parent}.#order` : '#order');
        if (error) return error;
      }
      if (autoName) return checkPath(splitPathName(path)[0]) || checkCreate(path, request.data as DataMap);
    // Explicit names only require permission for the target.
    case 'addFlow':
    case 'addFlowFolder':
      return (lookup?.(path) ? checkDelete(path) : null) || checkCreate(path, request.data as DataMap);
    case 'paste':
      if (!request.data || typeof request.data !== 'object') return 'invalid data';
      if (request.resolve === 'rename') {
        const error = checkWhole(path, false);
        if (error) return error;
      }
      return checkData(path, request.data as DataMap);
    case 'copy':
      for (const name of (request.props as string[]) ?? []) {
        const target = `${path}.${name}`;
        const error = lookup?.(target) ? checkDelete(target) : checkProp(target);
        if (error) return error;
      }
      return null;
    case 'moveOrdered': {
      if (typeof request.to !== 'string') return 'invalid path';
      const error = checkProp(`${path}.#order`) || checkProp(`${request.to}.#order`);
      if (error || path === request.to) return error;
    }
    // Moving between parents also changes their child blocks.
    case 'move':
      if (typeof request.to !== 'string') return 'invalid path';
      if (policy.allowCreateBlock === false) return 'restricted block creation';
      for (const name of (request.props as string[]) ?? []) {
        const error = checkDelete(`${path}.${name}`);
        if (error) return error;
      }
      return checkWhole(request.to);
    case 'showProps':
    case 'hideProps':
    case 'moveShownProp':
      return checkProp(`${path}.@b-p`);
    case 'moveCustomProp':
      return checkProp(`${path}.#custom`);
    case 'moveOptionalProp':
      return checkProp(`${path}.#optional`);
    case 'addCustomProp':
    case 'removeCustomProp':
    case 'addOptionalProp':
    case 'removeOptionalProp':
    case 'setLen':
    case 'insertGroupProp':
    case 'removeGroupProp':
    case 'moveGroupProp':
    case 'loadFlow':
    case 'unloadFlow':
    case 'enableFlow':
    case 'disableFlow':
    case 'applyFlowChange':
      return checkWhole(path);
    case 'callFunction':
      return checkProp(`${path}.#call`);
    case 'executeCommand':
    case 'editWorker':
    case 'deleteFunction':
    case 'renameProp':
      // Opaque commands and inbound link rewrites can affect the whole root.
      return checkWhole('');
    default:
      return 'restricted command';
  }
}

/** Editor capabilities for one policy. Server limits here are presentation-only. */
export class EditPolicyView {
  constructor(
    public readonly policy?: EditPolicy,
    public readonly ready = true
  ) {
    if (policy) {
      this.policy = Object.freeze(
        Object.fromEntries(
          Object.entries(policy).map(([key, value]) => [key, Array.isArray(value) ? Object.freeze([...value]) : value])
        )
      );
    }
    Object.freeze(this);
  }

  check(request: DataMap, lookup?: EditPolicyLookup): string | null {
    if (!this.ready) return 'policy not ready';
    return checkEditPolicy(this.policy, request, lookup, 'preview');
  }

  can(request: DataMap, lookup?: EditPolicyLookup): boolean {
    return !this.check(request, lookup);
  }

  canWriteField(path: string): boolean {
    return this.can({cmd: 'set', path});
  }

  canBindField(path: string): boolean {
    return this.can({cmd: 'bind', path});
  }

  canCreateBlock(path: string, functionId?: string): boolean {
    return this.can({cmd: 'addBlock', path, ...(functionId === undefined ? {} : {data: {'#is': functionId}})});
  }

  canDeleteBlock(path: string): boolean {
    return this.can({cmd: 'deleteBlock', path});
  }
}
