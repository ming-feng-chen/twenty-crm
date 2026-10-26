import { doNotTranslate } from 'twenty-shared/i18n';

export const getFastContactsExportFileName = ({
  sheetLabel,
  date,
}: {
  sheetLabel: string;
  date: Date;
}): string =>
  doNotTranslate(
    `AirPal contacts - ${sheetLabel} - ${date.toLocaleDateString('en-CA')}.csv`,
  );
