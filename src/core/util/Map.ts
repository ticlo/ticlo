export function addMapArray<T1, T2>(map: Map<T1, T2[]>, key: T1, value: T2) {
  if (map.has(key)) {
    map.get(key).push(value);
  } else {
    map.set(key, [value]);
  }
}
