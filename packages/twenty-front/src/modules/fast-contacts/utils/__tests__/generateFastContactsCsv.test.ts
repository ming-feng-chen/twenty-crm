import {
  buildFastContactsTestPerson,
  FAST_CONTACTS_TEST_FORMAT_CONTEXT,
} from '@/fast-contacts/testing/fastContactsTestData';
import { generateFastContactsCsv } from '@/fast-contacts/utils/generateFastContactsCsv';
import { getFastContactsColumn } from '@/fast-contacts/utils/getFastContactsColumn';
import { getFastContactsExportFileName } from '@/fast-contacts/utils/getFastContactsExportFileName';

describe('generateFastContactsCsv', () => {
  it('should export the given columns in order with ISO dates and a BOM', () => {
    const csv = generateFastContactsCsv({
      people: [
        buildFastContactsTestPerson({
          name: { firstName: 'Zoë', lastName: 'Müller, Jr' },
        }),
      ],
      columns: (['name', 'nextActionDate', 'optedOut', 'phones'] as const).map(
        getFastContactsColumn,
      ),
      formatContext: FAST_CONTACTS_TEST_FORMAT_CONTEXT,
    });

    expect(csv.startsWith('\uFEFF')).toBe(true);

    const [header, row] = csv.replace('\uFEFF', '').split('\n');

    expect(header).toBe('Name,Next action date,Opted out,Phone');
    expect(row).toContain('"Zoë Müller, Jr",2026-10-24,No,');
    // A leading "+" could run as a formula in Excel, so it is neutralised.
    expect(row).not.toMatch(/,\+44/);
  });

  it('should name the file after the sheet and the day', () => {
    expect(
      getFastContactsExportFileName({
        sheetLabel: 'Airport contacts',
        date: new Date(2026, 9, 26, 12),
      }),
    ).toBe('AirPal contacts - Airport contacts - 2026-10-26.csv');
  });
});
