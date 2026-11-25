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
