import { CanDeactivateFn } from '@angular/router';
import type { ClaimWizard } from './claim-wizard';

/** Asks before leaving a claim that has unsent changes. Type-only import keeps the wizard lazy. */
export const leaveClaimGuard: CanDeactivateFn<ClaimWizard> = (wizard) => wizard.canLeave();
