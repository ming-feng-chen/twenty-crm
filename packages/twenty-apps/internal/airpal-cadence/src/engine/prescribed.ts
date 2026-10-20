import { findStep } from './position';
import type {
  CadenceConfig,
  CadencePositionResult,
  CadenceStepDefinition,
} from './types';

// The step "Did it" works, derived from the position alone so no screen keeps
// its own table of what step N is. Null where a different button applies.
export const prescribedStep = (
  result: CadencePositionResult,
  config: CadenceConfig,
): CadenceStepDefinition | null => {
  const { position } = result;

  switch (position.kind) {
    // Requested and unaccepted: the gated messages cannot have been sent.
    case 'awaitingAcceptance':
    case 'sequenceComplete':
      return null;
    case 'notStarted':
    case 'warmedUp':
    case 'step':
    case 'forever':
      return findStep(config, position.stepKey);
    default: {
      const unhandled: never = position;

      throw new Error(
        `prescribedTouch: unhandled position ${JSON.stringify(unhandled)}`,
      );
    }
  }
};

// What "Did it" logs.
export const prescribedTouch = (
  result: CadencePositionResult,
  config: CadenceConfig,
): string | null => prescribedStep(result, config)?.channel ?? null;
