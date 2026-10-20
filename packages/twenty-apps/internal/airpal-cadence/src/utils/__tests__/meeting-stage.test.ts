import { describe, expect, it } from 'vitest';

import { FIELD_OPTIONS } from 'src/constants/cadence-values';
import { DEFAULT_CADENCE_CONFIG } from 'src/engine';
import { stageLabel } from 'src/ui/labels';
import { decideTouchesCreated } from 'src/utils/edit-decisions';
import { toCadenceContact } from 'src/utils/person-cadence';

describe('manual Meeting scheduled stage', () => {
  it('offers the stage in the person field and understands the stored value', () => {
    expect(FIELD_OPTIONS.cadenceStage).toContainEqual(
      expect.objectContaining({
        value: 'MEETING_SCHEDULED',
        label: 'Meeting scheduled',
      }),
    );
    expect(stageLabel('MEETING_SCHEDULED')).toBe('Meeting scheduled');

    const { contact, problems } = toCadenceContact(
      { id: 'person-1', cadenceStage: 'MEETING_SCHEDULED', cadenceHealth: 'ACTIVE' },
      { suppressed: false },
    );

    expect(contact.stage).toBe('meetingScheduled');
    expect(problems).toEqual([]);
  });

  it.each(['OUTBOUND', 'INBOUND'])('keeps the manually selected stage after an %s touch', (direction) => {
    const { patch } = decideTouchesCreated({
      person: { id: 'person-1', cadenceStage: 'MEETING_SCHEDULED' },
      createdTouches: [{
        id: 'touch-1',
        channel: 'EMAIL',
        direction,
        occurredOn: '2026-10-17',
      }],
      config: DEFAULT_CADENCE_CONFIG,
      today: '2026-10-17',
    });

    expect(patch).not.toHaveProperty('cadenceStage');
  });

  it('does not select Meeting scheduled automatically when a meeting touch is logged', () => {
    const { patch } = decideTouchesCreated({
      person: { id: 'person-1', cadenceStage: 'NOT_CONTACTED' },
      createdTouches: [{
        id: 'touch-1',
        channel: 'MEETING',
        direction: 'OUTBOUND',
        source: 'CALENDAR',
        occurredOn: '2026-10-17',
      }],
      config: DEFAULT_CADENCE_CONFIG,
      today: '2026-10-17',
    });

    expect(patch.cadenceStage).toBe('CONTACTED_NO_REPLY');
  });
});
