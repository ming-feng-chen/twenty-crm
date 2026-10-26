import { getDefaultFastContactsSheetLayout } from '@/fast-contacts/utils/getDefaultFastContactsSheetLayout';
import { normalizeFastContactsSheetLayout } from '@/fast-contacts/utils/normalizeFastContactsSheetLayout';

describe('normalizeFastContactsSheetLayout', () => {
  it('should fall back to the default layout for anything unreadable', () => {
    expect(normalizeFastContactsSheetLayout(undefined)).toEqual(
      getDefaultFastContactsSheetLayout(),
    );
    expect(normalizeFastContactsSheetLayout('broken')).toEqual(
      getDefaultFastContactsSheetLayout(),
    );
  });

  it('should hide the extra columns by default', () => {
    const layout = getDefaultFastContactsSheetLayout();

    expect(layout.hiddenColumnKeys).toEqual([
      'phones',
      'city',
      'cadenceHealth',
      'snoozeUntil',
      'revisitDate',
      'optedOut',
      'optOutReason',
      'createdAt',
    ]);
    expect(layout.frozenColumnCount).toBe(1);
  });

  it('should keep Name first and visible, and append columns added since', () => {
    const layout = normalizeFastContactsSheetLayout({
      columnOrder: ['emails', 'name', 'unknown', 'company', 'emails'],
      hiddenColumnKeys: ['name', 'company'],
      frozenColumnCount: 2,
    });

    expect(layout.columnOrder.slice(0, 3)).toEqual([
      'name',
      'emails',
      'company',
    ]);
    expect(layout.columnOrder).toHaveLength(19);
    expect(layout.hiddenColumnKeys).toContain('company');
    expect(layout.hiddenColumnKeys).toContain('city');
    expect(layout.hiddenColumnKeys).not.toContain('name');
    expect(layout.hiddenColumnKeys).not.toContain('jobTitle');
    expect(layout.frozenColumnCount).toBe(2);
  });

  it('should clamp the frozen column count to the visible columns', () => {
    expect(
      normalizeFastContactsSheetLayout({ frozenColumnCount: 0 })
        .frozenColumnCount,
    ).toBe(1);
    expect(
      normalizeFastContactsSheetLayout({ frozenColumnCount: 99 })
        .frozenColumnCount,
    ).toBe(11);
  });

  it('should keep valid sorts and filters and drop invalid ones', () => {
    const layout = normalizeFastContactsSheetLayout({
      sort: { columnKey: 'cadenceStage', direction: 'desc' },
      filters: {
        cadenceStage: { type: 'values', values: ['DEAD', null] },
        jobTitle: { type: 'contains', text: 'head' },
        nextActionDate: {
          type: 'date',
          operator: 'between',
          from: '2026-10-01',
          to: null,
        },
        optedOut: { type: 'boolean', value: true },
        city: { type: 'values', values: ['London'] },
        unknown: { type: 'contains', text: 'x' },
      },
    });

    expect(layout.sort).toEqual({
      columnKey: 'cadenceStage',
      direction: 'desc',
    });
    expect(Object.keys(layout.filters).sort()).toEqual([
      'cadenceStage',
      'jobTitle',
      'nextActionDate',
      'optedOut',
    ]);
    expect(
      normalizeFastContactsSheetLayout({ sort: { columnKey: 'x' } }).sort,
    ).toBeNull();
  });
});
