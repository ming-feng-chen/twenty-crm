import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Dropdown } from 'twenty-ui/components/navigation';
import { Input } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme';

import { type FastContactsColumnFilter } from '@/fast-contacts/types/FastContactsColumnFilter';
import { type FastContactsColumn } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsEditContext } from '@/fast-contacts/types/FastContactsEditContext';
import { formatFastContactsDateForInput } from '@/fast-contacts/utils/formatFastContactsDateForInput';
import { getFastContactsColumnValueOptions } from '@/fast-contacts/utils/getFastContactsColumnValueOptions';
import { normalizeFastContactsSearchText } from '@/fast-contacts/utils/normalizeFastContactsSearchText';
import { parseFastContactsDateInput } from '@/fast-contacts/utils/parseFastContactsDateInput';
import { getDateFormatStringForDatePickerInputMask } from '~/utils/date-utils';

const StyledInputs = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
`;

type FastContactsColumnFilterPageProps = {
  column: FastContactsColumn;
  filter: FastContactsColumnFilter | undefined;
  editContext: FastContactsEditContext;
  onFilterChange: (filter: FastContactsColumnFilter | null) => void;
};

export const FastContactsColumnFilterPage = ({
  column,
  filter,
  editContext,
  onFilterChange,
}: FastContactsColumnFilterPageProps) => {
  const { t } = useLingui();
  const [search, setSearch] = useState('');
  const dateFormat = editContext.formatContext.dateFormat;
  const datePlaceholder =
    getDateFormatStringForDatePickerInputMask(dateFormat).toLowerCase();

  switch (column.kind) {
    case 'select':
    case 'owner':
    case 'company':
    case 'tags': {
      const options = getFastContactsColumnValueOptions({
        column,
        editContext,
        includeBlank: true,
      });
      const allKeys = options.map((option) => option.key);
      const includedKeys = filter?.type === 'values' ? filter.values : allKeys;
      const visibleOptions = options.filter((option) =>
        normalizeFastContactsSearchText(option.label).includes(
          normalizeFastContactsSearchText(search.trim()),
        ),
      );

      const toggleKey = (key: string | null) => {
        const nextKeys = includedKeys.includes(key)
          ? includedKeys.filter((includedKey) => includedKey !== key)
          : [...includedKeys, key];

        onFilterChange(
          allKeys.every((optionKey) => nextKeys.includes(optionKey))
            ? null
            : { type: 'values', values: nextKeys },
        );
      };

      return (
        <>
          <Dropdown.Search
            aria-label={t`Search values`}
            placeholder={t`Search values`}
            value={search}
            onValueChange={setSearch}
          />
          <Dropdown.Section>
            <Dropdown.ActionItem
              closeOnClick={false}
              onClick={() => onFilterChange(null)}
            >
              {t`Select all`}
            </Dropdown.ActionItem>
            <Dropdown.ActionItem
              closeOnClick={false}
              onClick={() => onFilterChange({ type: 'values', values: [] })}
            >
              {t`Clear`}
            </Dropdown.ActionItem>
          </Dropdown.Section>
          <Dropdown.Separator />
          <Dropdown.Section scrollable>
            {visibleOptions.map((option) => (
              <Dropdown.OptionItem
                key={option.key ?? 'blank'}
                indicator="checkbox"
                closeOnSelect={false}
                selected={includedKeys.includes(option.key)}
                onSelect={() => toggleKey(option.key)}
              >
                {option.label}
              </Dropdown.OptionItem>
            ))}
          </Dropdown.Section>
        </>
      );
    }
    case 'boolean': {
      const selectedValue = filter?.type === 'boolean' ? filter.value : null;

      return (
        <Dropdown.Section>
          {[
            { label: t`Any`, value: null },
            { label: t`Yes`, value: true },
            { label: t`No`, value: false },
          ].map((choice) => (
            <Dropdown.OptionItem
              key={choice.label}
              closeOnSelect={false}
              selected={selectedValue === choice.value}
              onSelect={() =>
                onFilterChange(
                  isDefined(choice.value)
                    ? { type: 'boolean', value: choice.value }
                    : null,
                )
              }
            >
              {choice.label}
            </Dropdown.OptionItem>
          ))}
        </Dropdown.Section>
      );
    }
    case 'date':
    case 'dateTime': {
      const dateFilter = filter?.type === 'date' ? filter : null;
      const operator = dateFilter?.operator ?? null;

      const setDateFilter = (
        nextFilter: Partial<
          Extract<FastContactsColumnFilter, { type: 'date' }>
        >,
      ) =>
        onFilterChange({
          type: 'date',
          operator: dateFilter?.operator ?? 'before',
          from: dateFilter?.from ?? null,
          to: dateFilter?.to ?? null,
          ...nextFilter,
        });

      const handleDateTyped = (bound: 'from' | 'to', text: string) =>
        setDateFilter({
          [bound]:
            text.trim() === ''
              ? null
              : parseFastContactsDateInput({ text, dateFormat }),
        });

      return (
        <>
          <Dropdown.Section>
            <Dropdown.OptionItem
              closeOnSelect={false}
              selected={operator === null}
              onSelect={() => onFilterChange(null)}
            >
              {t`Any date`}
            </Dropdown.OptionItem>
            {(
              [
                ['before', t`Before`],
                ['after', t`After`],
                ['between', t`Between`],
                ['isEmpty', t`Is empty`],
              ] as const
            ).map(([choice, label]) => (
              <Dropdown.OptionItem
                key={choice}
                closeOnSelect={false}
                selected={operator === choice}
                onSelect={() => setDateFilter({ operator: choice })}
              >
                {label}
              </Dropdown.OptionItem>
            ))}
          </Dropdown.Section>
          {operator !== null && operator !== 'isEmpty' && (
            <StyledInputs>
              <Input
                aria-label={operator === 'between' ? t`From` : t`Date`}
                placeholder={datePlaceholder}
                defaultValue={formatFastContactsDateForInput({
                  date: dateFilter?.from ?? null,
                  dateFormat,
                })}
                onValueChange={(text) => handleDateTyped('from', text)}
              />
              {operator === 'between' && (
                <Input
                  aria-label={t`To`}
                  placeholder={datePlaceholder}
                  defaultValue={formatFastContactsDateForInput({
                    date: dateFilter?.to ?? null,
                    dateFormat,
                  })}
                  onValueChange={(text) => handleDateTyped('to', text)}
                />
              )}
            </StyledInputs>
          )}
        </>
      );
    }
    default:
      return (
        <StyledInputs>
          <Input
            autoFocus
            aria-label={t`Contains`}
            placeholder={t`Contains…`}
            defaultValue={filter?.type === 'contains' ? filter.text : ''}
            onValueChange={(text) =>
              onFilterChange(
                text.trim() === '' ? null : { type: 'contains', text },
              )
            }
          />
        </StyledInputs>
      );
  }
};
