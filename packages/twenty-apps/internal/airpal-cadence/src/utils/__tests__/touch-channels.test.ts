import { describe, expect, it } from 'vitest';

import {
  TOUCH_CHANNEL_OPTIONS,
} from 'src/constants/cadence-values';
import {
  BUILT_IN_TOUCH_CHANNEL_OPTIONS,
  parseTouchChannelOptions,
  touchChannelLabel,
} from 'src/utils/touch-channels';

describe('touch channel parsing', () => {
  it('reads them in the field order, added ones included', () => {
    expect(
      parseTouchChannelOptions([
        { value: 'EMAIL', label: 'Email', position: 1 },
        { value: 'WHATSAPP_GROUP', label: 'WhatsApp group', position: 2 },
        { value: 'CALL', label: 'Call', position: 0 },
      ]),
    ).toEqual([
      { value: 'CALL', label: 'Call' },
      { value: 'EMAIL', label: 'Email' },
      { value: 'WHATSAPP_GROUP', label: 'WhatsApp group' },
    ]);
  });

  it('leaves out values Twenty could not hold, repeats and non-options, and labels a bare value by itself', () => {
    expect(
      parseTouchChannelOptions([
        { value: 'email', label: 'lower case' },
        { value: 'CALL', label: '' },
        { value: 'CALL', label: 'Again' },
        null,
        'EMAIL',
        { label: 'No value' },
      ]),
    ).toEqual([{ value: 'CALL', label: 'CALL' }]);
    expect(parseTouchChannelOptions(null)).toEqual([]);
  });

  it('labels a value from the list, or says it does not know it', () => {
    const options = [{ value: 'WHATSAPP_GROUP', label: 'WhatsApp group' }];

    expect(touchChannelLabel(options, 'WHATSAPP_GROUP')).toBe('WhatsApp group');
    expect(touchChannelLabel(options, 'EMAIL')).toBeNull();
    expect(touchChannelLabel(options, null)).toBeNull();
  });

  it('falls back to exactly the options the app ships', () => {
    expect(BUILT_IN_TOUCH_CHANNEL_OPTIONS).toEqual(
      TOUCH_CHANNEL_OPTIONS.map(({ value, label }) => ({ value, label })),
    );
  });
});
