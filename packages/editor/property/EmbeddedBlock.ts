import {
  type ClientConn,
  type DataMap,
  type EditPolicyView,
  type FunctionDesc,
  type PropDesc,
  getDefaultFuncData,
  getSubBlockFuncData,
} from '@ticlo/core/editor.ts';
import {isBaseObject, isSavedBlock} from '@ticlo/core/util/DataTypes.ts';
import {validateNodePath} from '@ticlo/core/util/Path.ts';
import {getDescModule} from '../util/FunctionModule.ts';

const savedValue = (value: unknown) => (isSavedBlock(value) ? {'#is': value} : value);

function getEmbeddedBlockData(
  desc: FunctionDesc,
  value: DataMap | unknown[],
  optional: Record<string, PropDesc>
): DataMap {
  const data = getSubBlockFuncData(getDefaultFuncData(desc));
  if (desc.recipient) {
    data[desc.recipient] = savedValue(value);
    return data;
  }
  if (Array.isArray(value)) throw new Error('The embedded Block cannot receive an array');

  const optionalNames: string[] = [];
  const custom: PropDesc[] = [];
  const extend = {...value};
  for (const [name, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    if (Object.hasOwn(optional, name)) {
      optionalNames.push(name);
    } else if (!desc.optional && name && !/^[#~@+]/.test(name) && !name.endsWith('[]') && validateNodePath(name)) {
      custom.push({name, type: 'any'});
    } else {
      continue;
    }
    data[name] = savedValue(entry);
    delete extend[name];
  }
  if (optionalNames.length) data['#optional'] = optionalNames;
  if (custom.length) data['#custom'] = custom;
  data['@b-p'] = [...(data['@b-p'] as string[]), ...optionalNames, ...custom.map((prop) => prop.name)];
  if (Object.keys(extend).length) data['#extend'] = savedValue(extend);
  return data;
}

type EmbeddedBlockTarget = {conn: ClientConn; paths: string[]; name: string; funcModule?: string};

export async function addSubBlock(
  {conn, paths, name, funcModule}: EmbeddedBlockTarget,
  policy: EditPolicyView,
  id: string,
  desc?: FunctionDesc,
  data?: DataMap
) {
  if (!data) {
    desc ??= conn.watchDesc(id, getDescModule(id, funcModule));
    if (!desc) return false;
    data = getSubBlockFuncData(getDefaultFuncData(desc));
  }
  const targets = paths.map((path) => `${path}.~${name}`);
  if (!targets.length || !targets.every((path) => policy.can({cmd: 'addBlock', path, data}))) return false;
  for (const path of targets) await conn.addBlock(path, data);
  return true;
}

export function hasEmbeddedBlockTypes(desc: PropDesc) {
  return Boolean(desc.create?.length && (desc.type === 'object' || desc.type === 'array' || desc.type === 'any'));
}

function isEmbeddedBlockValue(value: unknown, desc: PropDesc): value is DataMap | unknown[] {
  if (Array.isArray(value)) return desc.type !== 'object';
  return desc.type !== 'array' && value != null && typeof value === 'object' && isBaseObject(value);
}

export function canConvertEmbeddedBlock(
  policy: EditPolicyView,
  path: string,
  name: string,
  desc: PropDesc,
  value: unknown,
  bindingPath: string | null,
  creator?: FunctionDesc,
  embeddedBlockType?: string
) {
  if (
    desc.readonly ||
    desc.disableObjectTools ||
    !hasEmbeddedBlockTypes(desc) ||
    !isEmbeddedBlockValue(value, desc) ||
    !policy.can({cmd: 'get', path: `${path}.${name}`})
  )
    return false;
  const embeddedBlockPath = `${path}.~${name}`;
  if (creator) {
    return (
      bindingPath == null &&
      (!Array.isArray(value) || Boolean(creator.recipient)) &&
      policy.canCreateBlock(embeddedBlockPath, creator.id)
    );
  }
  return (
    bindingPath === `~${name}.#output` &&
    Boolean(embeddedBlockType) &&
    (typeof desc.create === 'string' ? desc.create === embeddedBlockType : desc.create.includes(embeddedBlockType)) &&
    policy.can({cmd: 'set', path: `${path}.${name}`}) &&
    policy.canDeleteBlock(embeddedBlockPath)
  );
}

export async function convertEmbeddedBlock(
  conn: ClientConn,
  policy: EditPolicyView,
  path: string,
  name: string,
  desc: PropDesc,
  funcModule: string,
  stillEditing: () => boolean,
  creator?: FunctionDesc
) {
  const field = `${path}.${name}`;
  const {value} = await conn.getValue(field);
  if (!stillEditing()) return false;
  if (!isEmbeddedBlockValue(value, desc)) throw new Error('Expected an object or array value');
  if (creator) {
    if (Array.isArray(value) && !creator.recipient) return false;
    const data = getEmbeddedBlockData(creator, value, conn.getOptionalProps(creator, funcModule) || {});
    return addSubBlock({conn, paths: [path], name, funcModule}, policy, creator.id, creator, data);
  }
  if (!policy.can({cmd: 'set', path: field, value}) || !policy.canDeleteBlock(`${path}.~${name}`)) return false;
  await conn.setValue(field, value, true);
  return true;
}
