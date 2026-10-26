import {
  decodeFastContactsTsv,
  encodeFastContactsTsv,
} from '@/fast-contacts/utils/fastContactsTsv';

describe('fastContactsTsv', () => {
  it('should round-trip values with tabs, line breaks and quotes', () => {
    const rows = [
      ['Ada', 'says "hi"', 'line\nbreak'],
      ['', 'tab\there', 'plain'],
    ];

    expect(decodeFastContactsTsv(encodeFastContactsTsv(rows))).toEqual(rows);
  });

  it('should read what Google Sheets puts on the clipboard', () => {
    expect(decodeFastContactsTsv('a\tb\r\nc\td\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(decodeFastContactsTsv('single')).toEqual([['single']]);
  });
});
