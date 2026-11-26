const labels = {
  e0: { cp: 'Level progress', cl: 'Level', ap: 'Available enhancement points' },
  e10: {
    1: 'Life rank', 2: 'Life regeneration rank', 3: 'Energy rank',
    4: 'Energy regeneration rank', 5: 'Weapon damage rank', 6: 'Speed rank',
    7: 'Ability power rank',
  },
  rs0: { g: 'Scoreboard games' },
};

export function observedLabel(bank, row) {
  if (bank.version !== '1' || !/^[+-]?\d+$/.test(row.integer ?? '')) return '';
  return Object.hasOwn(labels, row.section) && Object.hasOwn(labels[row.section], row.key)
    ? labels[row.section][row.key]
    : '';
}

export function progressionFields(bank) {
  const fields = ['e0', 'e10'].flatMap(section =>
    Object.entries(labels[section]).map(([key, label]) => ({ section, key, label }))
  );
  return fields.map(field => {
    const matches = bank.entries.filter(row => row.section === field.section && row.key === field.key);
    let value = 'Unavailable';
    if (bank.version === '1') {
      if (matches.length > 1) value = 'Ambiguous';
      else if (matches.length === 0) value = 'Missing';
      else if (!/^\+?\d+$/.test(matches[0].integer ?? '')) value = 'Invalid';
      else value = matches[0].integer;
    }
    return { ...field, value };
  });
}
