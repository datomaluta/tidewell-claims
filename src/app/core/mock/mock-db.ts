import {
  AuditEntry,
  Claim,
  ClaimEvent,
  ClaimItem,
  ClaimStatus,
  ClaimType,
  HOME_CAUSES,
  STATUS_LABELS,
  Policy,
  ROOMS,
  StaffUser,
} from '../models';
import { storage } from '../storage';
import { todayIso } from '../validators';
import { AGENT_APPROVAL_LIMIT } from '../workflow';

/** Demo data for the fake backend. Claims and the audit log persist in localStorage. */

export const STAFF: StaffUser[] = [
  { id: 'u-maya', name: 'Maya Collins', role: 'agent', title: 'Claims agent' },
  { id: 'u-leo', name: 'Leo Hartmann', role: 'agent', title: 'Claims agent' },
  { id: 'u-grace', name: 'Grace Okafor', role: 'manager', title: 'Claims manager' },
];

const DAY = 86_400_000;

function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return todayIso(new Date(new Date(y, m - 1, d).getTime() + days * DAY));
}

/** Demo policies. Periods are relative to today so the demo never goes stale. */
export function demoPolicies(today = todayIso()): Policy[] {
  return [
    {
      number: 'TWA-204518',
      type: 'auto',
      holderName: 'Alex Morgan',
      validFrom: shiftDays(today, -300),
      validTo: shiftDays(today, 65),
      coverageLimit: 25_000,
      deductible: 500,
      vehicle: { make: 'Toyota', model: 'Corolla', year: 2021, plate: 'KT-482-LM' },
      address: null,
    },
    {
      number: 'TWH-318840',
      type: 'home',
      holderName: 'Sam Rivera',
      validFrom: shiftDays(today, -120),
      validTo: shiftDays(today, 245),
      coverageLimit: 120_000,
      deductible: 1_000,
      vehicle: null,
      address: '14 Harbor Lane, Portland, OR',
    },
    {
      number: 'TWA-100233',
      type: 'auto',
      holderName: 'Jordan Lee',
      validFrom: shiftDays(today, -430),
      validTo: shiftDays(today, -65),
      coverageLimit: 15_000,
      deductible: 750,
      vehicle: { make: 'Honda', model: 'Civic', year: 2018, plate: 'RB-907-TS' },
      address: null,
    },
  ];
}

/* ---------------------------------- store --------------------------------- */

interface DbState {
  version: number;
  seq: number;
  claims: Claim[];
  audit: AuditEntry[];
}

const KEY = 'tidewell.db';
const VERSION = 2;

class Db {
  private state: DbState = this.load();

  get claims(): Claim[] {
    return this.state.claims;
  }

  get audit(): AuditEntry[] {
    return this.state.audit;
  }

  nextNumber(): string {
    this.state.seq += 1;
    return `TW-${new Date().getFullYear()}-${String(this.state.seq).padStart(5, '0')}`;
  }

  save(): void {
    storage.set(KEY, this.state);
  }

  reset(): void {
    this.state = seed();
    this.save();
  }

  private load(): DbState {
    const saved = storage.get<DbState | null>(KEY, null);
    if (saved?.version === VERSION) return saved;
    const fresh = seed();
    storage.set(KEY, fresh);
    return fresh;
  }
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/* ---------------------------------- seed ---------------------------------- */

/** Small seeded PRNG so every visitor gets the same demo data. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  'Olivia',
  'Ethan',
  'Hannah',
  'Lucas',
  'Chloe',
  'Noah',
  'Ava',
  'Mateo',
  'Isla',
  'Owen',
  'Zoe',
  'Ryan',
  'Lena',
  'Marcus',
  'Priya',
  'Daniel',
  'Elena',
  'Tom',
  'Aisha',
  'Ben',
];
const LAST = [
  'Bennett',
  'Shaw',
  'Novak',
  'Patel',
  'Kim',
  'Fischer',
  'Duarte',
  'Walsh',
  'Moreno',
  'Brooks',
  'Ito',
  'Larsen',
  'Haddad',
  'Quinn',
  'Reid',
  'Costa',
  'Murphy',
  'Singh',
];
const PLACES = [
  'Portland, OR',
  'Seattle, WA',
  'Tacoma, WA',
  'Salem, OR',
  'Eugene, OR',
  'Vancouver, WA',
  'Bend, OR',
  'Spokane, WA',
];
const STREETS = [
  'Oak St',
  'Burnside Ave',
  'Pine Rd',
  'Harbor Way',
  'Elm Ct',
  'Division St',
  'Lake Dr',
  'Mill Rd',
];
const CARS: [string, string][] = [
  ['Toyota', 'RAV4'],
  ['Honda', 'Accord'],
  ['Subaru', 'Outback'],
  ['Ford', 'Escape'],
  ['Mazda', 'CX-5'],
  ['Volkswagen', 'Golf'],
  ['Hyundai', 'Tucson'],
  ['Tesla', 'Model 3'],
];

const AUTO_STORIES = [
  'Another car rear-ended me at a red light. The bumper and trunk lid are dented and one tail light is broken.',
  'I hit a deer on the highway at night. The front grille, hood and right headlight are damaged.',
  'My parked car was scraped along the driver side in a supermarket car park. The other driver left a note.',
  'A tree branch fell on the car during a storm and cracked the windshield and dented the roof.',
  'I slid on ice and hit a guardrail. The front bumper is cracked and the car pulls to the left.',
];
const HOME_STORIES: Record<string, string> = {
  water:
    'A pipe under the kitchen sink burst while we were at work. Water spread into the hallway and damaged the floor.',
  fire: 'A pan caught fire on the stove. The fire was put out quickly but the cabinets and ceiling have smoke damage.',
  storm:
    'Strong winds lifted part of the roof. Rain came into the upstairs bedroom and damaged the ceiling.',
  theft:
    'Someone broke in through the back door while we were away and took a laptop, a TV and jewelry.',
  other: 'The washing machine hose came loose and flooded the basement overnight.',
};

const NOTES_NEEDS_INFO: Record<ClaimType, string[]> = {
  auto: [
    'Please upload the repair estimate from the body shop.',
    'Could you send photos that show the damaged area more closely?',
    'Please add the police report number from the accident.',
  ],
  home: [
    'Could you send photos that show the damaged area more closely?',
    'We need a receipt or bank statement for the most expensive item.',
    'Please upload a quote from the contractor for the repairs.',
  ],
};
const NOTES_REJECT = [
  'The damage happened before the policy start date, so it is not covered.',
  'Wear and tear is not covered by this policy.',
];
const NOTES_INTERNAL = [
  'Called the claimant, photos match the description.',
  'Repair estimate looks in line with similar claims.',
  'Checked with the other insurer, they accept liability.',
];

function seed(): DbState {
  const rnd = mulberry32(20261122);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];
  const between = (min: number, max: number) => Math.round(min + rnd() * (max - min));

  const now = Date.now();
  const agents = STAFF.filter((s) => s.role === 'agent');
  const manager = STAFF.find((s) => s.role === 'manager')!;
  const claims: Claim[] = [];
  const audit: AuditEntry[] = [];
  let seq = 1000;

  const statusPool: ClaimStatus[] = [
    'submitted',
    'submitted',
    'submitted',
    'submitted',
    'submitted',
    'submitted',
    'in_review',
    'in_review',
    'in_review',
    'in_review',
    'in_review',
    'needs_info',
    'needs_info',
    'needs_info',
    'approved',
    'approved',
    'approved',
    'paid',
    'paid',
    'paid',
    'paid',
    'rejected',
    'rejected',
  ];

  for (let i = 0; i < 38; i++) {
    seq += 1;
    const type: ClaimType = rnd() < 0.55 ? 'auto' : 'home';
    const status = pick(statusPool);
    // Newer claims are mostly still open, older ones mostly closed.
    const ageDays = status === 'submitted' ? between(0, 4) : between(3, 75);
    const created = now - ageDays * DAY - between(0, 10) * 3_600_000;
    const firstName = pick(FIRST);
    const lastName = pick(LAST);
    const incidentDate = todayIso(new Date(created - between(0, 5) * DAY));
    const items = seedItems(type, rnd, between);
    const total = items.reduce((s, it) => s + it.amount, 0);
    const assignee = status === 'submitted' ? (rnd() < 0.3 ? pick(agents) : null) : pick(agents);
    const id = `c-${seq}`;
    const number = `TW-${new Date(created).getFullYear()}-${String(seq).padStart(5, '0')}`;
    const cause = pick(HOME_CAUSES).value;
    const [make, model] = pick(CARS);
    const otherParty = type === 'auto' && rnd() < 0.4;

    const claim: Claim = {
      id,
      number,
      type,
      status,
      policyNumber: `${type === 'auto' ? 'TWA' : 'TWH'}-${between(100000, 999999)}`,
      claimant: {
        firstName,
        lastName,
        email: `${firstName}.${lastName}@example.com`.toLowerCase(),
        phone: `+1 503 555 ${String(between(100, 9999)).padStart(4, '0')}`,
      },
      incident: {
        date: incidentDate,
        time: `${String(between(6, 22)).padStart(2, '0')}:${pick(['00', '15', '30', '45'])}`,
        location: `${between(10, 980)} ${pick(STREETS)}, ${pick(PLACES)}`,
        description: type === 'auto' ? pick(AUTO_STORIES) : HOME_STORIES[cause],
        policeReportNumber:
          otherParty || (type === 'home' && cause === 'theft')
            ? `PR-${between(10000, 99999)}`
            : null,
        auto:
          type === 'auto'
            ? {
                vehicle: {
                  make,
                  model,
                  year: between(2012, 2025),
                  plate: `${String.fromCharCode(65 + between(0, 25))}${String.fromCharCode(65 + between(0, 25))}-${between(100, 999)}-${String.fromCharCode(65 + between(0, 25))}${String.fromCharCode(65 + between(0, 25))}`,
                },
                drivable: rnd() < 0.6,
                otherPartyInvolved: otherParty,
                otherParty: otherParty
                  ? {
                      name: `${pick(FIRST)} ${pick(LAST)}`,
                      insurer: pick(['Northline', 'Bluepeak', 'Crescent Mutual']),
                      plate: `ZX-${between(100, 999)}-QA`,
                    }
                  : null,
              }
            : null,
        home:
          type === 'home'
            ? {
                cause,
                rooms: [pick(ROOMS), ...(rnd() < 0.4 ? [pick(ROOMS)] : [])].filter(
                  (r, idx, arr) => arr.indexOf(r) === idx,
                ),
                habitable: rnd() < 0.8,
                needsAccommodation: false,
              }
            : null,
      },
      items,
      documents: Array.from({ length: between(1, 4) }, (_, n) => ({
        id: `d-${seq}-${n}`,
        name: n === 0 && rnd() < 0.5 ? 'repair-estimate.pdf' : `photo-${n + 1}.jpg`,
        size: between(180_000, 3_800_000),
        mimeType: n === 0 && rnd() < 0.5 ? 'application/pdf' : 'image/jpeg',
      })),
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(created).toISOString(),
      assigneeId: assignee?.id ?? null,
      total,
      events: [],
    };

    // Walk the claim through its history so the timeline and audit log are consistent.
    let t = created;
    const step = () => (t = Math.min(now - 60_000, t + between(2, 40) * 3_600_000));
    const events: ClaimEvent[] = [];
    const log = (e: Omit<ClaimEvent, 'id' | 'at'>, actor: StaffUser | null, detail: string) => {
      const at = new Date(t).toISOString();
      events.push({ ...e, id: `e-${seq}-${events.length}`, at });
      audit.push({
        id: `a-${seq}-${events.length}`,
        at,
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? `${firstName} ${lastName}`,
        action:
          e.kind === 'submitted'
            ? 'claim_submitted'
            : e.kind === 'assigned'
              ? 'assigned'
              : e.kind === 'note'
                ? 'note_added'
                : 'status_changed',
        claimId: id,
        claimNumber: number,
        detail,
      });
    };
    const move = (from: ClaimStatus, to: ClaimStatus, actor: StaffUser, note?: string) => {
      step();
      log(
        { kind: 'status', actorName: actor.name, from, to, note },
        actor,
        `${STATUS_LABELS[from]} → ${STATUS_LABELS[to]}${note ? `: ${note}` : ''}`,
      );
    };

    log({ kind: 'submitted', actorName: `${firstName} ${lastName}` }, null, 'Claim submitted');
    if (assignee) {
      step();
      log(
        { kind: 'assigned', actorName: assignee.name, note: assignee.name },
        assignee,
        `Assigned to ${assignee.name}`,
      );
    }
    if (status !== 'submitted') {
      const reviewer = assignee ?? pick(agents);
      move('submitted', 'in_review', reviewer);
      if (status === 'needs_info' || rnd() < 0.25) {
        move('in_review', 'needs_info', reviewer, pick(NOTES_NEEDS_INFO[type]));
        if (status !== 'needs_info') move('needs_info', 'in_review', reviewer);
      }
      if (status !== 'needs_info' && rnd() < 0.5) {
        step();
        const note = pick(NOTES_INTERNAL);
        log({ kind: 'note', actorName: reviewer.name, note }, reviewer, `Note: ${note}`);
      }
      if (status === 'approved' || status === 'paid') {
        move('in_review', 'approved', total > AGENT_APPROVAL_LIMIT ? manager : reviewer);
      }
      if (status === 'paid') move('approved', 'paid', manager);
      if (status === 'rejected') move('in_review', 'rejected', manager, pick(NOTES_REJECT));
    }

    claim.events = events;
    claim.updatedAt = events[events.length - 1].at;
    claims.push(claim);
  }

  claims.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  audit.sort((a, b) => b.at.localeCompare(a.at));
  return { version: VERSION, seq, claims, audit };
}

function seedItems(
  type: ClaimType,
  rnd: () => number,
  between: (a: number, b: number) => number,
): ClaimItem[] {
  const autoItems: [string, ClaimItem['category'], number, number][] = [
    ['Rear bumper replacement', 'vehicle_body', 600, 2400],
    ['Paint and dent repair', 'vehicle_body', 300, 1800],
    ['Windshield replacement', 'vehicle_body', 350, 1200],
    ['Suspension and alignment', 'vehicle_mechanical', 400, 3200],
    ['Radiator replacement', 'vehicle_mechanical', 500, 1600],
    ['Towing to repair shop', 'towing', 90, 260],
    ['Rental car, 7 days', 'rental', 280, 650],
    ['Child car seat', 'personal', 150, 400],
  ];
  const homeItems: [string, ClaimItem['category'], number, number][] = [
    ['Hardwood floor repair', 'structure', 1800, 9000],
    ['Drywall and ceiling repair', 'structure', 900, 5200],
    ['Roof repair', 'structure', 2500, 14000],
    ['Kitchen cabinets', 'furniture', 1500, 7000],
    ['Sofa', 'furniture', 700, 2600],
    ['Laptop', 'electronics', 800, 2400],
    ['Television', 'electronics', 500, 1900],
    ['Jewelry', 'personal', 400, 3500],
  ];
  const pool = type === 'auto' ? autoItems : homeItems;
  const count = between(1, rnd() < 0.3 ? 4 : 2);
  const chosen = new Set<number>();
  while (chosen.size < count) chosen.add(Math.floor(rnd() * pool.length));
  return [...chosen].map((i) => {
    const [description, category, min, max] = pool[i];
    return { description, category, amount: Math.round(between(min, max) / 10) * 10 };
  });
}

/** Created last so the seed data above is initialised before the first load. */
export const db = new Db();
