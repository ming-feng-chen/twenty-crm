// RFC 4180 parsing: quoted fields may hold commas, quotes and line breaks.
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const source = text.replace(/^﻿/, '');

  for (let index = 0; index < source.length; index++) {
    const character = source[index];

    if (inQuotes) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      inQuotes = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') {
        index++;
      }

      row.push(field);
      field = '';

      if (row.length > 1 || row[0] !== '') {
        rows.push(row);
      }

      row = [];
    } else {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};

export const readCsv = (text: string): Record<string, string>[] => {
  const [header, ...rows] = parseCsv(text);

  return rows.map((row) =>
    Object.fromEntries(header.map((column, index) => [column, row[index] ?? ''])),
  );
};

// The reconciliation pack embeds its tables as ```csv blocks under headings.
export const readCsvBlock = (markdown: string, heading: string) => {
  const headingIndex = markdown.indexOf(heading);

  if (headingIndex === -1) {
    throw new Error(`Section "${heading}" not found`);
  }

  const start = markdown.indexOf('```csv', headingIndex) + '```csv'.length;
  const end = markdown.indexOf('```', start);

  return readCsv(markdown.slice(start, end).trim());
};
