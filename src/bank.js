export const MAX_BYTES = 8 * 1024 * 1024;

export async function readBank(file) {
  if (file.size > MAX_BYTES) throw new Error('The file exceeds the 8 MiB limit.');
  const bytes = await file.arrayBuffer();
  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('The file must use UTF-8 encoding.');
  }
  const bank = parseBank(source);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return { ...bank, source, name: file.name, size: bytes.byteLength, hash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') };
}

export function parseBank(source) {
  const markup = source.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  if (markup.includes('<!DOCTYPE')) throw new Error('Bank files with a DOCTYPE are unsupported.');
  const document = new DOMParser().parseFromString(source, 'application/xml');
  if (document.doctype) throw new Error('Bank files with a DOCTYPE are unsupported.');
  const root = document.documentElement;
  const parserErrorNamespaces = [
    'http://www.mozilla.org/newlayout/xml/parsererror.xml',
    'http://www.w3.org/1999/xhtml',
  ];
  if (!root || parserErrorNamespaces.some(namespace =>
    document.getElementsByTagNameNS(namespace, 'parsererror').length > 0
  )) {
    throw new Error('The file contains malformed XML.');
  }
  if (root.tagName !== 'Bank' || root.namespaceURI) throw new Error('Expected an XML Bank root.');

  const diagnostics = [];
  const version = root.getAttribute('version');
  if (version !== '1') diagnostics.push('Expected Bank version 1. DwarfCraft labels are disabled.');
  const sectionCounts = new Map();
  const entries = [...root.children].flatMap(section => {
    if (section.tagName !== 'Section' || section.namespaceURI) return [entry(section, [])];
    const name = section.getAttribute('name');
    if (name === null) diagnostics.push('A Section has no name.');
    const occurrence = (sectionCounts.get(name) ?? 0) + 1;
    sectionCounts.set(name, occurrence);
    return [
      entry(section, [], false),
      ...[...section.children].map(key => entry(key, [name], true, occurrence)),
    ];
  });
  const occurrences = new Map();
  for (const row of entries) {
    const index = (occurrences.get(row.path) ?? 0) + 1;
    occurrences.set(row.path, index);
    row.id = JSON.stringify([row.path, index]);
    if (index === 2) diagnostics.push(`Duplicate entry at ${row.displayPath}.`);
    if (row.integer !== null && !/^[+-]?\d+$/.test(row.integer)) {
      diagnostics.push(`Invalid integer at ${row.displayPath}.`);
    }
  }
  return { version, diagnostics, entries, rootXml: containerXml(root) };
}

function containerXml(node) {
  const clone = node.cloneNode(true);
  for (const child of [...clone.childNodes]) {
    if (child.nodeType === 1 || (child.nodeType === 3 && !child.textContent.trim())) child.remove();
  }
  return new XMLSerializer().serializeToString(clone);
}

function entry(node, parents, includeChildren = true, parentOccurrence = 0) {
  const name = node.getAttribute('name');
  const path = JSON.stringify([parents, parentOccurrence, node.namespaceURI, node.tagName, name]);
  const displayPath = [...parents.map(parent => parent ?? 'Unnamed section'), name ?? node.tagName].join(' / ');
  const value = node.tagName === 'Key' && !node.namespaceURI && node.children.length === 1
    ? node.firstElementChild : null;
  const integer = value?.tagName === 'Value' && !value.namespaceURI ? value.getAttribute('int') : null;
  return {
    path, displayPath, integer,
    section: parents[0],
    key: node.tagName === 'Key' && !node.namespaceURI ? name : null,
    xml: includeChildren ? new XMLSerializer().serializeToString(node) : containerXml(node),
  };
}

export function compareBanks(left, right) {
  const oldEntries = new Map(left.entries.map(row => [row.id, row]));
  const newEntries = new Map(right.entries.map(row => [row.id, row]));
  const ids = new Set([...oldEntries.keys(), ...newEntries.keys()]);
  const differences = [...ids].flatMap(id => {
    const before = oldEntries.get(id);
    const after = newEntries.get(id);
    if (before?.xml === after?.xml) return [];
    return [{ id, before, after, path: (after ?? before).displayPath,
      status: !before ? 'Added' : !after ? 'Removed' : 'Changed' }];
  });
  if (left.rootXml !== right.rootXml) {
    differences.unshift({ id: 'root', path: 'Bank', status: 'Changed',
      before: { xml: left.rootXml }, after: { xml: right.rootXml } });
  }
  return differences;
}
