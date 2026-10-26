export type FastContactsDateFilterOperator =
  | 'before'
  | 'after'
  | 'between'
  | 'isEmpty';

// `values` holds option values, member ids or company ids; null is "(Blank)".
export type FastContactsColumnFilter =
  | { type: 'values'; values: (string | null)[] }
  | { type: 'contains'; text: string }
  | {
      type: 'date';
      operator: FastContactsDateFilterOperator;
      from: string | null;
      to: string | null;
    }
  | { type: 'boolean'; value: boolean };
