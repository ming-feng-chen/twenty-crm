const needsQuoting = (value: string) => /[\t\n\r"]/.test(value);

// Same quoting as Google Sheets and Excel: a cell with a tab, line break or
// quote is wrapped in quotes, with inner quotes doubled.
export const encodeFastContactsTsv = (rows: string[][]): string =>
  rows
    .map((row) =>
      row
        .map((value) =>
          needsQuoting(value) ? `"${value.replace(/"/g, '""')}"` : value,
        )
        .join('\t'),
    )
    .join('\n');

export const decodeFastContactsTsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let isInQuotes = false;
  let index = 0;

  const normalizedText = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');

  while (index < normalizedText.length) {
    const character = normalizedText[index];

    if (isInQuotes) {
      if (character === '"' && normalizedText[index + 1] === '"') {
        value += '"';
        index += 2;
        continue;
      }

      if (character === '"') {
        isInQuotes = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value === '') {
      isInQuotes = true;
    } else if (character === '\t') {
      row.push(value);
      value = '';
    } else if (character === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }

    index += 1;
  }

  row.push(value);
  rows.push(row);

  return rows;
};
