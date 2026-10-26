import { FAST_CONTACTS_COLUMNS } from '@/fast-contacts/constants/FastContactsColumns';
import { type FastContactsSelection } from '@/fast-contacts/types/FastContactsSelection';
import { getFastContactsPasteInputs } from '@/fast-contacts/utils/getFastContactsPasteInputs';
import { getFastContactsSelectedCells } from '@/fast-contacts/utils/getFastContactsSelectedCells';

const ROW_IDS = ['a', 'b', 'c'];
const VISIBLE_COLUMNS = FAST_CONTACTS_COLUMNS.slice(0, 3);

const paste = (values: string[][], selection: FastContactsSelection) => {
  const { inputs, outsideCellCount } = getFastContactsPasteInputs({
    values,
    selectedCells: getFastContactsSelectedCells({
      selection,
      rowIds: ROW_IDS,
      visibleColumns: VISIBLE_COLUMNS,
    }),
    rowIds: ROW_IDS,
    visibleColumns: VISIBLE_COLUMNS,
  });

  return {
    cells: inputs.map(
      (input) => `${input.personId}:${input.column.key}=${input.text}`,
    ),
    outsideCellCount,
  };
};

const cell = (rowIndex: number, columnIndex: number) => ({
  rowIndex,
  columnIndex,
});

describe('getFastContactsPasteInputs', () => {
  it('should fill every selected cell with a single copied value', () => {
    expect(
      paste([['x']], {
        anchor: cell(0, 1),
        focus: cell(1, 2),
        selectedRowIds: null,
      }).cells,
    ).toEqual(['a:company=x', 'a:jobTitle=x', 'b:company=x', 'b:jobTitle=x']);
  });

  it('should paste a block down and right and count what does not fit', () => {
    expect(
      paste(
        [
          ['1', '2', '3'],
          ['4', '5', '6'],
        ],
        { anchor: cell(2, 1), focus: cell(2, 1), selectedRowIds: null },
      ),
    ).toEqual({
      cells: ['c:company=1', 'c:jobTitle=2'],
      outsideCellCount: 4,
    });
  });

  it('should paste rows onto selected rows in order', () => {
    expect(
      paste([['A'], ['C']], {
        anchor: cell(0, 0),
        focus: cell(0, 0),
        selectedRowIds: ['c', 'a'],
      }).cells,
    ).toEqual(['a:name=A', 'c:name=C']);
  });
});
