import { isDefined } from 'twenty-shared/utils';

import {
  type FastContactsCellWrite,
  type FastContactsSkippedCell,
} from '@/fast-contacts/types/FastContactsCellWrite';
import { type FastContactsColumn } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsEditContext } from '@/fast-contacts/types/FastContactsEditContext';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { parseFastContactsCellInput } from '@/fast-contacts/utils/parseFastContactsCellInput';

export type FastContactsCellInput = {
  personId: string;
  column: FastContactsColumn;
  text: string;
};

export type FastContactsCellInputPlan = {
  writes: FastContactsCellWrite[];
  skippedCells: FastContactsSkippedCell[];
};

// Read-only columns are left out silently; values that do not parse are listed.
export const planFastContactsCellInputs = ({
  inputs,
  peopleById,
  editContext,
}: {
  inputs: FastContactsCellInput[];
  peopleById: Map<string, FastContactsPerson>;
  editContext: FastContactsEditContext;
}): FastContactsCellInputPlan => {
  const writes: FastContactsCellWrite[] = [];
  const skippedCells: FastContactsSkippedCell[] = [];

  for (const { personId, column, text } of inputs) {
    const person = peopleById.get(personId);

    if (!isDefined(person) || !column.isEditable) {
      continue;
    }

    const result = parseFastContactsCellInput({
      person,
      columnKey: column.key,
      text,
      editContext,
    });

    if (result.isValid) {
      writes.push({ personId, columnKey: column.key, value: result.value });
    } else {
      skippedCells.push({
        personId,
        columnKey: column.key,
        reason: result.error,
      });
    }
  }

  return { writes, skippedCells };
};
