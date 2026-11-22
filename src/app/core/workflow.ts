import { Claim, ClaimStatus, STATUS_LABELS, StaffUser } from './models';

/**
 * Claim workflow rules, kept as plain functions so the UI and the (mock) server share them
 * and they can be unit tested without Angular.
 */

/** Agents can approve claims up to this total. Larger claims need a manager. */
export const AGENT_APPROVAL_LIMIT = 5000;

const NEXT: Record<ClaimStatus, readonly ClaimStatus[]> = {
  submitted: ['in_review'],
  in_review: ['needs_info', 'approved', 'rejected'],
  needs_info: ['in_review'],
  approved: ['paid'],
  rejected: [],
  paid: [],
};

const ACTION_LABELS: Partial<Record<ClaimStatus, string>> = {
  in_review: 'Start review',
  needs_info: 'Request info',
  approved: 'Approve',
  rejected: 'Reject',
  paid: 'Mark as paid',
};

/** Moving to these statuses needs a message, which the claimant sees on the tracking page. */
const NEEDS_NOTE: readonly ClaimStatus[] = ['needs_info', 'rejected'];

export type ClaimRef = Pick<Claim, 'status' | 'total' | 'assigneeId'>;

export type Check = { allowed: true } | { allowed: false; reason: string };

export interface TransitionOption {
  to: ClaimStatus;
  label: string;
  requiresNote: boolean;
  check: Check;
}

const allow: Check = { allowed: true };
const deny = (reason: string): Check => ({ allowed: false, reason });

export function isFinal(status: ClaimStatus): boolean {
  return NEXT[status].length === 0;
}

export function requiresNote(to: ClaimStatus): boolean {
  return NEEDS_NOTE.includes(to);
}

export function canTransition(claim: ClaimRef, to: ClaimStatus, user: StaffUser): Check {
  if (!NEXT[claim.status].includes(to)) {
    return deny(`A claim can't move from ${STATUS_LABELS[claim.status]} to ${STATUS_LABELS[to]}.`);
  }
  if (user.role === 'manager') return allow;

  if (!claim.assigneeId) return deny('Assign this claim to yourself first.');
  if (claim.assigneeId !== user.id) {
    return deny('Only the assigned agent or a manager can work on this claim.');
  }
  if (to === 'rejected') return deny('Only a manager can reject a claim.');
  if (to === 'paid') return deny('Only a manager can mark a claim as paid.');
  if (to === 'approved' && claim.total > AGENT_APPROVAL_LIMIT) {
    return deny(`Claims over $${AGENT_APPROVAL_LIMIT.toLocaleString('en-US')} need a manager.`);
  }
  return allow;
}

/** Every next step from the current status, including the ones this user can't take (with why). */
export function transitionOptions(claim: ClaimRef, user: StaffUser): TransitionOption[] {
  return NEXT[claim.status].map((to) => ({
    to,
    label: ACTION_LABELS[to] ?? STATUS_LABELS[to],
    requiresNote: requiresNote(to),
    check: canTransition(claim, to, user),
  }));
}

export function canAssign(claim: ClaimRef, assigneeId: string, user: StaffUser): Check {
  if (isFinal(claim.status)) return deny("Closed claims can't be reassigned.");
  if (user.role === 'manager') return allow;
  if (assigneeId !== user.id) return deny('Only a manager can assign claims to someone else.');
  if (claim.assigneeId && claim.assigneeId !== user.id) {
    return deny('This claim is already assigned to someone else.');
  }
  return allow;
}
