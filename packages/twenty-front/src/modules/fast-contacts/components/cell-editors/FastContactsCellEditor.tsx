import { useLingui } from '@lingui/react/macro';
import { type RefObject } from 'react';

import { FastContactsDateCellEditor } from '@/fast-contacts/components/cell-editors/FastContactsDateCellEditor';
import { FastContactsNameCellEditor } from '@/fast-contacts/components/cell-editors/FastContactsNameCellEditor';
import { FastContactsPickerCellEditor } from '@/fast-contacts/components/cell-editors/FastContactsPickerCellEditor';
import { FastContactsTagsCellEditor } from '@/fast-contacts/components/cell-editors/FastContactsTagsCellEditor';
import { FastContactsTextCellEditor } from '@/fast-contacts/components/cell-editors/FastContactsTextCellEditor';
import { type FastContactsCellValue } from '@/fast-contacts/types/FastContactsCellValue';
import { type FastContactsColumn } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsEditContext } from '@/fast-contacts/types/FastContactsEditContext';
import { type FastContactsEditorMove } from '@/fast-contacts/types/FastContactsEditorMove';
import {
  type FastContactsPerson,
  type FastContactsTag,
} from '@/fast-contacts/types/FastContactsPerson';
import { type FastContactsPickerOption } from '@/fast-contacts/types/FastContactsPickerOption';
import { formatFastContactsPhones } from '@/fast-contacts/utils/formatFastContactsPhones';
import { getFastContactsColumnValueOptions } from '@/fast-contacts/utils/getFastContactsColumnValueOptions';
import { getFastContactsValueFromOptionKey } from '@/fast-contacts/utils/getFastContactsValueFromOptionKey';
import { getFastContactsCellFilterKey } from '@/fast-contacts/utils/getFastContactsCellFilterKey';

type FastContactsCellEditorProps = {
  person: FastContactsPerson;
  column: FastContactsColumn;
  initialText: string | null;
  editContext: FastContactsEditContext;
  cellRef: RefObject<HTMLDivElement | null>;
  onCommitText: (text: string, move: FastContactsEditorMove) => void;
  onCommitValue: (
    value: FastContactsCellValue,
    move: FastContactsEditorMove,
  ) => void;
  onCreateCompany: (name: string) => void;
  onCreateTag: (name: string) => Promise<FastContactsTag | null>;
  onCancel: () => void;
};

const getPrimaryText = (
  person: FastContactsPerson,
  column: FastContactsColumn,
) => {
  switch (column.kind) {
    case 'emails':
      return person.emails?.primaryEmail ?? '';
    case 'phones':
      return person.phones?.primaryPhoneNumber
        ? (formatFastContactsPhones({
            ...person.phones,
            additionalPhones: null,
          })[0] ?? '')
        : '';
    case 'links':
      return person.linkedinLink?.primaryLinkUrl ?? '';
    default:
      return (person[column.key] as string | null) ?? '';
  }
};

export const FastContactsCellEditor = ({
  person,
  column,
  initialText,
  editContext,
  cellRef,
  onCommitText,
  onCommitValue,
  onCreateCompany,
  onCreateTag,
  onCancel,
}: FastContactsCellEditorProps) => {
  const { t, i18n } = useLingui();
  const ariaLabel = i18n._(column.label);

  const renderPicker = (
    options: FastContactsPickerOption[],
    toValue: (key: string | null) => FastContactsCellValue,
    onCreate?: (search: string) => void,
  ) => (
    <FastContactsPickerCellEditor
      anchorRef={cellRef}
      ariaLabel={ariaLabel}
      options={options}
      selectedKey={getFastContactsCellFilterKey(person, column.key)}
      initialSearch={initialText ?? ''}
      onSelect={(key) => onCommitValue(toValue(key), 'none')}
      onCancel={onCancel}
      onCreate={onCreate}
      createLabel={(search) => t`Create company "${search}"`}
    />
  );

  switch (column.kind) {
    case 'fullName':
      return (
        <FastContactsNameCellEditor
          initialName={
            initialText !== null
              ? { firstName: initialText, lastName: '' }
              : {
                  firstName: person.name?.firstName ?? '',
                  lastName: person.name?.lastName ?? '',
                }
          }
          onCommit={onCommitValue}
          onCancel={onCancel}
        />
      );
    case 'date':
      return (
        <FastContactsDateCellEditor
          instanceId={`fast-contacts-date-${person.id}-${column.key}`}
          anchorRef={cellRef}
          value={person[column.key] as string | null}
          initialText={initialText}
          dateFormat={editContext.formatContext.dateFormat}
          onCommitText={onCommitText}
          onCancel={onCancel}
        />
      );
    case 'select': {
      const isRequired = editContext.requiredColumnKeys.includes(column.key);
      const options = getFastContactsColumnValueOptions({
        column,
        editContext,
        includeBlank: false,
      });

      return renderPicker(
        isRequired ? options : [{ key: null, label: t`(Empty)` }, ...options],
        (key) => key,
      );
    }
    case 'tags':
      return (
        <FastContactsTagsCellEditor
          anchorRef={cellRef}
          allTags={editContext.tags}
          initialTags={person.tags}
          initialSearch={initialText ?? ''}
          onCreateTag={onCreateTag}
          onCommit={(tags) => onCommitValue(tags, 'none')}
        />
      );
    case 'owner':
    case 'company': {
      const options = getFastContactsColumnValueOptions({
        column,
        editContext,
        includeBlank: false,
      });
      const toValue = (key: string | null) =>
        getFastContactsValueFromOptionKey({ column, key, editContext });

      return column.kind === 'owner'
        ? renderPicker(
            [{ key: null, label: t`(No owner)` }, ...options],
            toValue,
          )
        : renderPicker(
            [{ key: null, label: t`(No company)` }, ...options],
            toValue,
            onCreateCompany,
          );
    }
    default:
      return (
        <FastContactsTextCellEditor
          initialText={initialText ?? getPrimaryText(person, column)}
          ariaLabel={ariaLabel}
          onCommit={onCommitText}
          onCancel={onCancel}
        />
      );
  }
};
