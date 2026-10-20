import { describe, expect, it } from 'vitest';
import { validateManagedChannels } from '../validate-managed-channels.util';
import { DEFAULT_CADENCE_RULES, buildRulesSnapshot, configFromRules, normalizeCadenceRules, parseRulesSnapshot } from '../cadence-rules';
import { draftToRules, rulesToDraft } from 'src/ui/rules-form';

describe('custom channels managed with the cadence rules', () => {
  const custom = { value: 'WHATSAPP_GROUP', label: 'WhatsApp group' };
  const rules = { ...DEFAULT_CADENCE_RULES, touchChannels: [...DEFAULT_CADENCE_RULES.touchChannels, custom], steps: DEFAULT_CADENCE_RULES.steps.map((step) => step.key === 'email' ? { ...step, channel: custom.value } : step) };

  it('keeps a new channel through the editor, API normalization and audit snapshot', () => {
    const saved = normalizeCadenceRules(draftToRules(rulesToDraft(rules)));
    expect(parseRulesSnapshot(buildRulesSnapshot('cadence', saved))?.rules).toEqual(rules);
    expect(configFromRules(saved, 'cadence').errors).toEqual([]);
  });

  it('refuses removing a channel still used by a step', () => {
    expect(configFromRules({ ...rules, touchChannels: DEFAULT_CADENCE_RULES.touchChannels }, 'cadence').errors.join(' ')).toContain(custom.value);
  });

  it('rejects duplicate codes, empty labels, invalid codes and removal of built-ins', () => {
    expect(validateManagedChannels([...rules.touchChannels, custom]).join(' ')).toContain('more than once');
    expect(validateManagedChannels([...rules.touchChannels, { value: 'OTHER', label: '' }]).join(' ')).toContain('needs a name');
    expect(validateManagedChannels([...rules.touchChannels, { value: 'not valid', label: 'Invalid' }]).length).toBeGreaterThan(0);
    expect(validateManagedChannels([custom]).join(' ')).toContain('must be kept');
  });
});
