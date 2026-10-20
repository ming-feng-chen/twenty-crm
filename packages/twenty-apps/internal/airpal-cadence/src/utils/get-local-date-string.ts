// "Today" for the member is their local calendar day, not the UTC one.
export const getLocalDateString = (date: Date = new Date()) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
