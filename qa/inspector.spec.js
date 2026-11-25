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
  await expect(page.getByRole('row').filter({ hasText: 'Level progress' })).toContainText('0003');

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
  await expect(page.getByRole('row').filter({ hasText: 'Level progress' })).toContainText('0003');
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
