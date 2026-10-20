import {
  type CadenceRules,
  configFromRules,
  parseRulesSnapshot,
  rulesFromRecords,
  type CadenceStepRecordLike,
} from 'src/utils/cadence-rules';
import { type CadenceConfig, DEFAULT_CADENCE_CONFIG } from 'src/engine';

export type CadenceRecordLike = Partial<
  Record<keyof Omit<CadenceRules, 'steps'>, unknown>
> & {
  id: string;
  lastValidRules?: unknown;
};

export type ActiveConfigSource =
  // The snapshot the app last applied: the normal case.
  | 'lastValidRules'
  // No usable snapshot yet, but the stored records are valid.
  | 'records'
  // Nothing usable: the engine's built-in default cadence.
  | 'default';

export type ActiveConfig = {
  config: CadenceConfig;
  source: ActiveConfigSource;
  cadenceId: string | null;
  // Why a better source was not used. Empty in the normal case.
  problems: string[];
};

// The engine only ever runs on a config that passed validation. Stored records
// become the active rules only through the rules-change path, which writes
// lastValidRules; until then, and whenever an edit is invalid, the snapshot
// wins (SPEC §2: fall back to the last valid config).
export const selectActiveConfig = (
  cadence: CadenceRecordLike | null,
  steps: readonly CadenceStepRecordLike[],
): ActiveConfig => {
  if (cadence === null) {
    return {
      config: DEFAULT_CADENCE_CONFIG,
      source: 'default',
      cadenceId: null,
      problems: ['No cadence record exists yet; using the built-in default.'],
    };
  }

  const problems: string[] = [];
  const snapshot = parseRulesSnapshot(cadence.lastValidRules);

  if (snapshot !== null) {
    const fromSnapshot = configFromRules(snapshot.rules, cadence.id);

    if (fromSnapshot.config !== null) {
      return {
        config: fromSnapshot.config,
        source: 'lastValidRules',
        cadenceId: cadence.id,
        problems,
      };
    }

    problems.push(
      `The last valid rules no longer validate: ${fromSnapshot.errors.join(' ')}`,
    );
  } else {
    problems.push('The cadence has no last valid rules yet.');
  }

  const { rules, errors: orderErrors } = rulesFromRecords(cadence, steps);
  const fromRecords = configFromRules(rules, cadence.id, orderErrors);

  if (fromRecords.config !== null) {
    return {
      config: fromRecords.config,
      source: 'records',
      cadenceId: cadence.id,
      problems,
    };
  }

  problems.push(
    `The stored rules are not valid: ${fromRecords.errors.join(' ')}`,
  );

  return {
    config: DEFAULT_CADENCE_CONFIG,
    source: 'default',
    cadenceId: cadence.id,
    problems,
  };
};
