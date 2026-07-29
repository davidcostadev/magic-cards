import { describe, expect, it } from 'vitest';
import { validateListSearch } from './listSearch';

const SORTS = ['recent', 'title', 'mastered'] as const;

describe('validateListSearch', () => {
  it('keeps a known sort and a non-empty query', () => {
    expect(validateListSearch({ q: 'kafka', sort: 'mastered' }, SORTS)).toEqual({
      q: 'kafka',
      sort: 'mastered',
    });
  });

  it('drops an unknown sort so a stale link still opens', () => {
    expect(validateListSearch({ sort: 'bogus' }, SORTS)).toEqual({});
  });

  it('drops the default sort so the clean URL stays clean', () => {
    expect(validateListSearch({ sort: 'recent' }, SORTS)).toEqual({});
  });

  it('drops a blank or whitespace-only query', () => {
    expect(validateListSearch({ q: '' }, SORTS)).toEqual({});
    expect(validateListSearch({ q: '   ' }, SORTS)).toEqual({});
  });

  it('ignores non-string values instead of throwing', () => {
    expect(validateListSearch({ q: 42, sort: ['a'] }, SORTS)).toEqual({});
    expect(validateListSearch({}, SORTS)).toEqual({});
  });
});
