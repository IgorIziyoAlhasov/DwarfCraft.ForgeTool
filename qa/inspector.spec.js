import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';

function upload(page, label, xml, name = 'synthetic.SC2Bank') {
  return page.getByLabel(label, { exact: true }).setInputFiles({
    name, mimeType: 'application/xml', buffer: Buffer.from(xml),
  });
}

test('DCF-INS-001 inspects a bank and compares values and unknown content', async ({ page }) => {
  await page.goto('/');
  const original = '\uFEFF<Bank version="1">\r\n<Section name="e0"><Key name="cp"><Value int="0003"/></Key><Extra><Child/></Extra></Section></Bank>';
  await upload(page, 'Primary bank', original);
  await expect(page.getByText(createHash('sha256').update(original).digest('hex'))).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bank entries' }).getByRole('row').filter({ hasText: 'Level progress' })).toContainText('0003');

  await upload(page, 'Comparison bank (optional)', original.replace('0003', '0004').replace('<Child/>', '<Other/>'), 'second.SC2Bank');
  await expect(page.getByText('File hashes differ. 2 structural changes.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'e0 / Extra' }).filter({ hasText: 'Changed' })).toContainText('<Other/>');
});

test('DCF-INS-002 reports errors and clears stale comparisons', async ({ page }) => {
  await page.goto('/');
  const bank = '<Bank version="1"/>';
  await upload(page, 'Primary bank', bank);
  await upload(page, 'Comparison bank (optional)', bank);
  await expect(page.getByText('Byte-identical files. 0 structural changes.')).toBeVisible();
  for (const [xml, message] of [
    ['<!DOCTYPE Bank><Bank/>', 'DOCTYPE'],
    ['<Other/>', 'Bank root'],
    ['<Bank>', 'malformed XML'],
  ]) {
    await upload(page, 'Comparison bank (optional)', xml);
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(page.getByRole('heading', { name: 'Bank comparison' })).toHaveCount(0);
  }
});

test('DCF-INS-003 preserves duplicates and reports unsupported versions', async ({ page }) => {
  await page.goto('/');
  const bank = '<Bank version="2"><Section name="e0"><Key name="cl"><Value int="invalid"/></Key><Key name="cl"><Value int="9007199254740993"/></Key></Section></Bank>';
  await upload(page, 'Primary bank', bank);
  await expect(page.getByText(/labels are disabled/)).toBeVisible();
  await expect(page.getByText(/Duplicate entry/)).toBeVisible();
  await expect(page.getByText(/Invalid integer/)).toBeVisible();
  await expect(page.getByText('9007199254740993', { exact: true })).toBeVisible();
});

test('DCF-INS-005 filters by label, path and raw value', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'Primary bank', '<Bank version="1"><Section name="e0"><Key name="cp"><Value int="0003"/></Key><Key name="misc"><Value int="567"/></Key></Section></Bank>');
  const search = page.getByRole('searchbox', { name: 'Search bank contents' });
  const labeled = page.getByRole('checkbox', { name: 'Labeled fields only' });
  await search.fill('LEVEL Progress');
  await expect(page.getByRole('region', { name: 'Bank entries' }).getByRole('row').filter({ hasText: 'Level progress' })).toContainText('0003');
  await search.fill('e0 / misc');
  await expect(page.getByRole('row').filter({ hasText: 'e0 / misc' })).toContainText('567');
  await search.fill('567');
  await labeled.check();
  await expect(page.getByText('No entries match these filters.')).toBeVisible();
  await search.clear();
  await expect(page.getByText('1 of 3 entries')).toBeVisible();
  await labeled.uncheck();
  await expect(page.getByText('3 of 3 entries')).toBeVisible();
});

test('DCF-INS-006 compares labeled integer values and exposes original entry XML', async ({ page }) => {
  await page.goto('/');
  const primary = '<Bank version="1"><Section name="e0"><Key name="cp"><Value int="0003"/></Key><Key name="ap"><Value int="9"/></Key></Section></Bank>';
  const secondary = '<Bank version="1"><Section name="e0"><Key name="cp"><Value int="0042"/></Key><Key name="cl"><Value int="5"/></Key></Section></Bank>';
  await upload(page, 'Primary bank', primary);
  await upload(page, 'Comparison bank (optional)', secondary, 'second.SC2Bank');
  const comparison = page.getByRole('region', { name: 'Changed bank entries' });
  const changed = comparison.getByRole('row').filter({ hasText: 'Level progress' });
  await expect(changed).toContainText('Changed');
  await expect(changed.getByText('0003', { exact: true })).toBeVisible();
  await expect(changed.getByText('0042', { exact: true })).toBeVisible();
  const original = changed.getByText('<Key name="cp"><Value int="0003"/></Key>', { exact: true });
  await expect(original).toBeHidden();
  await changed.getByText('XML', { exact: true }).first().click();
  await expect(original).toBeVisible();
  await expect(comparison.getByRole('row').filter({ hasText: 'Available enhancement points' })).toContainText('Removed');
  await expect(comparison.getByRole('row').filter({ hasText: 'e0 / cl' })).toContainText('Added');
});

test('DCF-INS-007 combines comparison filters independently of bank search', async ({ page }) => {
  await page.goto('/');
  const before = '<Bank version="1"><Section name="e0"><Key name="cp"><Value int="123"/></Key><Key name="ap"><Value int="9"/></Key></Section></Bank>';
  const after = '<Bank version="1"><Section name="e0"><Key name="cp"><Value int="456"/></Key><Key name="cl"><Value int="5"/></Key><Key name="other"><Value int="456"/></Key></Section></Bank>';
  await upload(page, 'Primary bank', before);
  await upload(page, 'Comparison bank (optional)', after, 'second.SC2Bank');
  const panel = page.getByRole('region', { name: 'Bank comparison' });
  const search = panel.getByRole('searchbox', { name: 'Search changes' });
  await expect(panel.getByRole('status')).toHaveText('4 of 4 changes');
  await search.fill('456');
  await expect(panel.getByRole('status')).toHaveText('2 of 4 changes');
  await panel.getByRole('checkbox', { name: 'Labeled changes only' }).check();
  await expect(panel.getByRole('status')).toHaveText('1 of 4 changes');
  await panel.getByRole('combobox', { name: 'Change status' }).selectOption('Removed');
  await expect(panel.getByText('No changes match these filters.')).toBeVisible();
  await search.clear();
  await expect(panel.getByRole('row').filter({ hasText: 'Available enhancement points' })).toContainText('Removed');
  await expect(page.getByRole('searchbox', { name: 'Search bank contents' })).toHaveValue('');
});

test('DCF-INS-008 displays progression fields side by side and highlights unavailable values', async ({ page }) => {
  await page.goto('/');
  const primary = '<Bank version="1"><Section name="e0"><Key name="cl"><Value int="5"/></Key><Key name="cp"><Value int="100"/></Key><Key name="ap"><Value int="2"/></Key></Section><Section name="e10"><Key name="1"><Value int="0"/></Key><Key name="2"><Value int="bad"/></Key><Key name="3"><Value int="1"/></Key><Key name="3"><Value int="2"/></Key></Section></Bank>';
  await upload(page, 'Primary bank', primary);
  const panel = page.getByRole('region', { name: 'Character progression' });
  await expect(panel.getByRole('row')).toHaveCount(11);
  const row = name => panel.getByRole('row').filter({ has: page.getByRole('rowheader', { name, exact: true }) });
  await expect(row('Level')).toContainText('5');
  await expect(row('Life rank')).toContainText('0');
  await expect(row('Life regeneration rank')).toContainText('Invalid');
  await expect(row('Energy rank')).toContainText('Ambiguous');
  await expect(row('Speed rank')).toContainText('Missing');
  await upload(page, 'Comparison bank (optional)', '<Bank version="2"/>', 'second.SC2Bank');
  await expect(row('Level').getByRole('cell')).toHaveText(['5', 'Unavailable', 'Unavailable']);
});

test('DCF-INS-009 filters comparable progression changes and displays exact differences', async ({ page }) => {
  await page.goto('/');
  const bank = (progress, level) => `<Bank version="1"><Section name="e0"><Key name="cp"><Value int="${progress}"/></Key><Key name="cl"><Value int="${level}"/></Key></Section></Bank>`;
  await upload(page, 'Primary bank', bank('9007199254740995', '5'));
  await upload(page, 'Comparison bank (optional)', bank('9007199254740993', '5'), 'second.SC2Bank');
  const panel = page.getByRole('region', { name: 'Character progression' });
  await panel.getByRole('checkbox').check();
  await expect(panel.getByRole('row')).toHaveCount(2);
  await expect(panel.getByRole('row').last().getByRole('cell')).toHaveText(['9007199254740995', '9007199254740993', '+2']);
  await panel.getByRole('checkbox').uncheck();
  await expect(panel.getByRole('row')).toHaveCount(11);
});
