import { describe, expect, it } from 'vitest';
import { compareBanks } from './bank.js';

const bank = entries => ({ entries, rootXml: '<Bank version="1"/>' });

describe('compareBanks', () => {
  it('matches identities and retains additions, removals and changes', () => {
    const left = bank([
      { id: '1', displayPath: 'A', xml: '<X/>' },
      { id: '2', displayPath: 'B', xml: '<X/>' },
    ]);
    const right = bank([
      { id: '1', displayPath: 'A', xml: '<Y/>' },
      { id: '3', displayPath: 'C', xml: '<X/>' },
    ]);
    expect(compareBanks(left, right).map(({ path, status }) => [path, status]))
      .toEqual([['A', 'Changed'], ['B', 'Removed'], ['C', 'Added']]);
    expect(compareBanks(left, left)).toEqual([]);
  });
});
