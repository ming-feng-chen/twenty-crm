import { i18n } from '@lingui/core';
import { json2csv } from 'json-2-csv';
import { sanitizeValueForCSVExport } from 'twenty-shared/utils';

import { type FastContactsCellFormatContext } from '@/fast-contacts/types/FastContactsCellFormatContext';
import { type FastContactsColumn } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { getFastContactsCellText } from '@/fast-contacts/utils/getFastContactsCellText';

// Same safeguards as the record table export: a BOM so Excel keeps accents,
// and spreadsheet formula characters neutralised.
export const generateFastContactsCsv = ({
  people,
  columns,
  formatContext,
}: {
  people: FastContactsPerson[];
  columns: FastContactsColumn[];
  formatContext: FastContactsCellFormatContext;
}): string =>
  json2csv(
    people.map((person) =>
      Object.fromEntries(
        columns.map((column) => [
          column.key,
          sanitizeValueForCSVExport(
            getFastContactsCellText({
              person,
              columnKey: column.key,
              formatContext,
              purpose: 'export',
            }),
          ),
        ]),
      ),
    ),
    {
      keys: columns.map((column) => ({
        field: column.key,
        title: sanitizeValueForCSVExport(i18n._(column.label)),
      })),
      emptyFieldValue: '',
      excelBOM: true,
    },
  );
