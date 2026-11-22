import {
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import {
  Observable,
  concat,
  delay,
  interval,
  map,
  mergeMap,
  of,
  take,
  throwError,
  timer,
} from 'rxjs';
import {
  AuditAction,
  AuditEntry,
  CLAIM_STATUSES,
  Claim,
  ClaimEvent,
  ClaimInput,
  ClaimPage,
  ClaimReply,
  ClaimStatus,
  ClaimSummary,
  PublicClaim,
  STATUS_LABELS,
  StaffUser,
} from '../models';
import { checkFile, normalizePolicyNumber, sumAmounts } from '../validators';
import { canAssign, canTransition, requiresNote } from '../workflow';
import { STAFF, db, demoPolicies, policyFromClaims, uid } from './mock-db';

/**
 * A fake REST backend implemented as an HTTP interceptor.
 * The app talks to `/api/*` with a normal HttpClient, exactly as it would to a real server,
 * so swapping in a real API means removing this interceptor and nothing else.
 * Workflow rules are enforced here too, not only in the UI.
 */
interface Result {
  status: number;
  body: unknown;
}

const ok = (body: unknown, status = 200): Result => ({ status, body });
const fail = (status: number, message: string): Result => ({ status, body: { message } });

const LATENCY = 450;

export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);
  if (req.url === '/api/uploads' && req.method === 'POST') return upload(req);

  let result: Result;
  try {
    result = handle(req);
  } catch (e) {
    console.error('[mock-backend]', e);
    result = fail(500, 'Unexpected server error.');
  }
  return respond(req, result, LATENCY * (0.7 + Math.random() * 0.6));
};

function respond(req: HttpRequest<unknown>, result: Result, latency: number) {
  if (result.status >= 400) {
    const error = new HttpErrorResponse({
      status: result.status,
      error: result.body,
      url: req.url,
    });
    return timer(latency).pipe(mergeMap(() => throwError(() => error)));
  }
  // Clone like a real JSON response would, so the app never holds a reference into the database.
  const body = structuredClone(result.body);
  return of(new HttpResponse({ status: result.status, body, url: req.url })).pipe(delay(latency));
}

function handle(req: HttpRequest<unknown>): Result {
  const url = new URL(req.urlWithParams, 'http://mock.local');
  const [resource, id, action] = url.pathname
    .replace(/^\/api\//, '')
    .split('/')
    .filter(Boolean);
  const q = url.searchParams;

  // Public endpoints (the claimant side).
  if (resource === 'policies' && id && req.method === 'GET') return policy(id);
  if (resource === 'claims' && !id && req.method === 'POST') return submit(req.body as ClaimInput);
  if (resource === 'track' && id === 'reply' && req.method === 'POST') {
    return reply(req.body as ClaimReply | null);
  }
  if (resource === 'track' && req.method === 'GET')
    return track(q.get('number'), q.get('lastName'));
  if (resource === 'auth' && id === 'login' && req.method === 'POST') {
    return login(req.body as { userId?: string });
  }

  // Staff endpoints.
  const user = userFromToken(req.headers.get('Authorization'));
  if (!user) return fail(401, 'Your session has expired. Please sign in again.');

  switch (resource) {
    case 'staff':
      return ok(STAFF);
    case 'activity':
      return activity(q);
    case 'demo':
      if (id === 'reset' && req.method === 'POST') {
        db.reset();
        return ok({ ok: true });
      }
      break;
    case 'claims': {
      if (!id && req.method === 'GET') return list(q, user);
      const claim = db.claims.find((c) => c.id === id);
      if (!claim) return fail(404, 'Claim not found.');
      if (!action && req.method === 'GET') return ok(claim);
      const body = (req.body ?? {}) as Record<string, string | undefined>;
      if (action === 'transition' && req.method === 'POST') {
        return transition(claim, body['to'] as ClaimStatus, body['note'], user);
      }
      if (action === 'assign' && req.method === 'POST')
        return assign(claim, body['assigneeId'], user);
      if (action === 'notes' && req.method === 'POST') return addNote(claim, body['note'], user);
    }
  }
  return fail(404, 'Not found.');
}

/* --------------------------------- public -------------------------------- */

function policy(number: string): Result {
  const normalized = normalizePolicyNumber(number);
  const found = demoPolicies().find((p) => p.number === normalized) ?? policyFromClaims(normalized);
  return found ? ok(found) : fail(404, 'Policy not found.');
}

function submit(input: ClaimInput | null): Result {
  const policy =
    input &&
    (demoPolicies().find((p) => p.number === input.policyNumber) ??
      policyFromClaims(input.policyNumber));
  if (!input || !policy) return fail(422, 'The policy number is not valid.');
  if (input.incident.date < policy.validFrom || input.incident.date > policy.validTo) {
    return fail(422, 'The incident date is outside the policy period.');
  }
  if (!input.items.length || !input.documents.length) {
    return fail(422, 'Add at least one item and one document.');
  }
  const total = sumAmounts(input.items);
  if (total > policy.coverageLimit) return fail(422, 'The total is above the coverage limit.');

  const now = new Date().toISOString();
  const claimant = `${input.claimant.firstName} ${input.claimant.lastName}`;
  const claim: Claim = {
    ...input,
    id: uid('c'),
    number: db.nextNumber(),
    status: 'submitted',
    createdAt: now,
    updatedAt: now,
    assigneeId: null,
    total,
    events: [{ id: uid('e'), at: now, actorName: claimant, kind: 'submitted' }],
  };
  db.claims.unshift(claim);
  audit(claim, null, claimant, 'claim_submitted', 'Claim submitted');
  db.save();
  return ok(claim, 201);
}

/** Claimants identify a claim by its number and their last name. */
function findForClaimant(number: string | null | undefined, lastName: string | null | undefined) {
  return db.claims.find(
    (c) =>
      c.number.toUpperCase() === number?.trim().toUpperCase() &&
      c.claimant.lastName.toLowerCase() === lastName?.trim().toLowerCase(),
  );
}

const NOT_FOUND = "We couldn't find a claim with that number and last name.";

function track(number: string | null, lastName: string | null): Result {
  const claim = findForClaimant(number, lastName);
  return claim ? ok(publicView(claim)) : fail(404, NOT_FOUND);
}

function reply(body: ClaimReply | null): Result {
  const claim = findForClaimant(body?.number, body?.lastName);
  if (!body || !claim) return fail(404, NOT_FOUND);
  if (claim.status !== 'needs_info') {
    return fail(409, "This claim isn't waiting for more information any more.");
  }
  const message = body.message?.trim() ?? '';
  if (!message) return fail(422, 'Write a short reply for the claims team.');
  if (message.length > 2000) return fail(422, 'Replies can be up to 2000 characters.');
  const documents = Array.isArray(body.documents) ? body.documents : [];
  if (claim.documents.length + documents.length > 20) {
    return fail(422, 'This claim already has a lot of files. Call us to send more.');
  }

  const claimant = `${claim.claimant.firstName} ${claim.claimant.lastName}`;
  claim.documents.push(...documents);
  claim.status = 'in_review';
  pushEvent(claim, {
    kind: 'reply',
    actorName: claimant,
    from: 'needs_info',
    to: 'in_review',
    note: message,
    documents,
  });
  const files = documents.length
    ? ` with ${documents.length} ${documents.length === 1 ? 'file' : 'files'}`
    : '';
  audit(claim, null, claimant, 'claimant_replied', `Replied${files}: ${message}`);
  db.save();
  return ok(publicView(claim));
}

function publicView(claim: Claim): PublicClaim {
  const timeline: PublicClaim['timeline'] = claim.events
    .filter((e) => e.kind === 'submitted' || e.kind === 'status' || e.kind === 'reply')
    .map((e) => ({
      at: e.at,
      status: e.kind === 'submitted' ? 'submitted' : e.to!,
      // Only messages meant for the claimant (and their own replies) are shared.
      // Internal notes stay internal.
      message:
        e.kind === 'reply' || (e.kind === 'status' && requiresNote(e.to!))
          ? (e.note ?? null)
          : null,
      fromClaimant: e.kind === 'reply',
    }));
  const view: PublicClaim = {
    number: claim.number,
    type: claim.type,
    status: claim.status,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
    total: claim.total,
    timeline,
  };
  return view;
}

function upload(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
  const file = (req.body as FormData | null)?.get('file');
  if (!(file instanceof File)) return respond(req, fail(400, 'No file was sent.'), 200);
  const problem = checkFile(file);
  if (problem) return respond(req, fail(422, problem), 300);

  // Report progress in steps, roughly at the speed of a decent mobile connection.
  const steps = 10;
  const duration = Math.min(2200, 500 + file.size / 2500);
  return concat(
    of<HttpEvent<unknown>>({ type: HttpEventType.Sent }),
    interval(duration / steps).pipe(
      take(steps),
      map((i): HttpEvent<unknown> => ({
        type: HttpEventType.UploadProgress,
        loaded: Math.round((file.size * (i + 1)) / steps),
        total: file.size,
      })),
    ),
    of(
      new HttpResponse({
        status: 201,
        url: req.url,
        body: { id: uid('d'), name: file.name, size: file.size, mimeType: file.type },
      }),
    ),
  );
}

/* ---------------------------------- auth --------------------------------- */

function login(body: { userId?: string } | null): Result {
  const user = STAFF.find((s) => s.id === body?.userId);
  if (!user) return fail(401, 'Unknown demo user.');
  return ok({ token: `mock.${btoa(user.id)}`, user });
}

function userFromToken(header: string | null): StaffUser | null {
  const token = header?.replace(/^Bearer\s+/i, '');
  if (!token?.startsWith('mock.')) return null;
  try {
    const id = atob(token.slice(5));
    return STAFF.find((s) => s.id === id) ?? null;
  } catch {
    return null;
  }
}

/* --------------------------------- claims -------------------------------- */

function list(q: URLSearchParams, user: StaffUser): Result {
  const search = q.get('q')?.trim().toLowerCase() ?? '';
  const type = q.get('type');
  const assignee = q.get('assignee');
  const status = q.get('status') ?? 'all';
  const sort = q.get('sort') ?? 'newest';
  const pageSize = Math.min(50, Number(q.get('pageSize')) || 10);

  const filtered = db.claims.filter((c) => {
    if (type && c.type !== type) return false;
    if (assignee === 'me' && c.assigneeId !== user.id) return false;
    if (assignee === 'unassigned' && c.assigneeId) return false;
    if (search) {
      const hay = `${c.number} ${c.claimant.firstName} ${c.claimant.lastName} ${c.policyNumber}`;
      if (!hay.toLowerCase().includes(search)) return false;
    }
    return true;
  });

  const counts = Object.fromEntries([
    ['all', filtered.length],
    ...CLAIM_STATUSES.map((s) => [s, filtered.filter((c) => c.status === s).length]),
  ]) as ClaimPage['counts'];

  const rows = status === 'all' ? filtered : filtered.filter((c) => c.status === status);
  const sorted = [...rows].sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return a.createdAt.localeCompare(b.createdAt);
      case 'amount_desc':
        return b.total - a.total;
      case 'amount_asc':
        return a.total - b.total;
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(pages, Math.max(1, Number(q.get('page')) || 1));
  const items: ClaimSummary[] = sorted.slice((page - 1) * pageSize, page * pageSize).map((c) => ({
    id: c.id,
    number: c.number,
    type: c.type,
    status: c.status,
    claimantName: `${c.claimant.firstName} ${c.claimant.lastName}`,
    total: c.total,
    createdAt: c.createdAt,
    incidentDate: c.incident.date,
    assigneeId: c.assigneeId,
    replied: c.status === 'in_review' && lastStatusEvent(c)?.kind === 'reply',
  }));

  return ok({ items, total: sorted.length, page, pageSize, counts } satisfies ClaimPage);
}

/** The last event that moved the claim between statuses. */
function lastStatusEvent(claim: Claim): ClaimEvent | undefined {
  return [...claim.events].reverse().find((e) => e.kind === 'status' || e.kind === 'reply');
}

function transition(claim: Claim, to: ClaimStatus, note: string | undefined, user: StaffUser) {
  const check = canTransition(claim, to, user);
  if (!check.allowed) return fail(403, check.reason);
  const text = note?.trim();
  if (requiresNote(to) && !text) return fail(422, 'Add a message for the claimant.');

  const from = claim.status;
  claim.status = to;
  pushEvent(claim, { kind: 'status', actorName: user.name, from, to, note: text || undefined });
  audit(
    claim,
    user.id,
    user.name,
    'status_changed',
    `${STATUS_LABELS[from]} → ${STATUS_LABELS[to]}${text ? `: ${text}` : ''}`,
  );
  db.save();
  return ok(claim);
}

function assign(claim: Claim, assigneeId: string | undefined, user: StaffUser): Result {
  const assignee = STAFF.find((s) => s.id === assigneeId);
  if (!assignee) return fail(422, 'Pick someone to assign the claim to.');
  const check = canAssign(claim, assignee.id, user);
  if (!check.allowed) return fail(403, check.reason);
  if (claim.assigneeId === assignee.id) return ok(claim);

  claim.assigneeId = assignee.id;
  pushEvent(claim, { kind: 'assigned', actorName: user.name, note: assignee.name });
  audit(claim, user.id, user.name, 'assigned', `Assigned to ${assignee.name}`);
  db.save();
  return ok(claim);
}

function addNote(claim: Claim, note: string | undefined, user: StaffUser): Result {
  const text = note?.trim();
  if (!text) return fail(422, 'The note is empty.');
  if (text.length > 1000) return fail(422, 'Notes can be up to 1000 characters.');
  pushEvent(claim, { kind: 'note', actorName: user.name, note: text });
  audit(claim, user.id, user.name, 'note_added', `Note: ${text}`);
  db.save();
  return ok(claim);
}

function pushEvent(claim: Claim, event: Omit<ClaimEvent, 'id' | 'at'>): void {
  const at = new Date().toISOString();
  claim.events.push({ ...event, id: uid('e'), at });
  claim.updatedAt = at;
}

/* --------------------------------- audit --------------------------------- */

function audit(
  claim: Claim,
  actorId: string | null,
  actorName: string,
  action: AuditAction,
  detail: string,
): void {
  const entry: AuditEntry = {
    id: uid('a'),
    at: new Date().toISOString(),
    actorId,
    actorName,
    action,
    claimId: claim.id,
    claimNumber: claim.number,
    detail,
  };
  db.audit.unshift(entry);
}

function activity(q: URLSearchParams): Result {
  const actor = q.get('actor');
  const action = q.get('action');
  const pageSize = Math.min(50, Number(q.get('pageSize')) || 15);
  const rows = db.audit.filter(
    (e) =>
      (!actor || (actor === 'claimant' ? e.actorId === null : e.actorId === actor)) &&
      (!action || e.action === action),
  );
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pages, Math.max(1, Number(q.get('page')) || 1));
  return ok({
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
  });
}
