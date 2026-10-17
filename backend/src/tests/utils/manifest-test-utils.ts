/**
 * Returns a description of every string-select attribute of a manifest (or of any part of it) whose default value is
 * not one of its selectable values: the form would show an empty select, and the API would reject the default.
 */
export function findInvalidSelectDefaults(node: unknown, path = ''): Array<string> {
  if (Array.isArray(node)) {
    return node.flatMap((child, index) => findInvalidSelectDefaults(child, `${path}[${index}]`));
  }
  if (node === null || typeof node !== 'object') {
    return [];
  }
  const attribute = node as { type?: unknown; key?: unknown; defaultValue?: unknown; selectableValues?: unknown };
  const invalid =
    attribute.type === 'string-select' &&
    attribute.defaultValue != null &&
    Array.isArray(attribute.selectableValues) &&
    !attribute.selectableValues.includes(attribute.defaultValue)
      ? [`${path}.${attribute.key}: '${attribute.defaultValue}' not in ${JSON.stringify(attribute.selectableValues)}`]
      : [];
  return [...invalid, ...Object.entries(node).flatMap(([key, child]) => findInvalidSelectDefaults(child, `${path}.${key}`))];
}
