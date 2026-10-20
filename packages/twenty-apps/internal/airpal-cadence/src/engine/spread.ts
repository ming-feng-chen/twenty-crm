import { addBusinessDays, nextBusinessDay } from './business-days';
import type { CadenceCalendar, CadenceDate } from './types';

export type SpreadPlacement = {
  contactId: string;
  nextActionDate: CadenceDate;
};

// Spreads a backlog evenly over a window, keeping the order given so the
// longest overdue stays first. floor(index * days / total) spends the whole
// window and never leaves a tail.
export const spreadOverWindow = (
  contactIds: readonly string[],
  from: CadenceDate,
  businessDays: number,
  calendar: CadenceCalendar,
): SpreadPlacement[] => {
  if (!Number.isInteger(businessDays) || businessDays < 1) {
    throw new Error(
      `A spread needs a window of at least one business day, and got ${businessDays}. Nothing was scheduled.`,
    );
  }

  if (contactIds.length === 0) {
    return [];
  }

  const first = nextBusinessDay(from, calendar);

  return contactIds.map((contactId, index) => ({
    contactId,
    nextActionDate: addBusinessDays(
      first,
      Math.floor((index * businessDays) / contactIds.length),
      calendar,
    ),
  }));
};
