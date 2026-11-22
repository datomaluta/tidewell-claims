export type ClaimType = 'auto' | 'home';

export type ClaimStatus =
  'submitted' | 'in_review' | 'needs_info' | 'approved' | 'rejected' | 'paid';

export const CLAIM_STATUSES: readonly ClaimStatus[] = [
  'submitted',
  'in_review',
  'needs_info',
  'approved',
  'rejected',
  'paid',
];

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In review',
  needs_info: 'Needs info',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
};

export type Role = 'agent' | 'manager';

export interface StaffUser {
  id: string;
  name: string;
  role: Role;
  title: string;
}

/* --------------------------------- policy -------------------------------- */

export interface Vehicle {
  make: string;
  model: string;
  year: number;
  plate: string;
}

export interface Policy {
  number: string;
  type: ClaimType;
  holderName: string;
  /** ISO dates (yyyy-mm-dd), inclusive. */
  validFrom: string;
  validTo: string;
  coverageLimit: number;
  deductible: number;
  vehicle: Vehicle | null;
  address: string | null;
}

/* --------------------------------- claim --------------------------------- */

export type HomeCause = 'water' | 'fire' | 'storm' | 'theft' | 'other';

export const HOME_CAUSES: { value: HomeCause; label: string }[] = [
  { value: 'water', label: 'Water or leak' },
  { value: 'fire', label: 'Fire or smoke' },
  { value: 'storm', label: 'Storm or wind' },
  { value: 'theft', label: 'Theft or break-in' },
  { value: 'other', label: 'Something else' },
];

export const ROOMS = [
  'Kitchen',
  'Living room',
  'Bedroom',
  'Bathroom',
  'Hallway',
  'Basement',
  'Garage',
  'Roof or exterior',
] as const;

export type ItemCategory =
  | 'vehicle_body'
  | 'vehicle_mechanical'
  | 'towing'
  | 'rental'
  | 'structure'
  | 'furniture'
  | 'electronics'
  | 'personal'
  | 'other';

export const ITEM_CATEGORIES: Record<ClaimType, { value: ItemCategory; label: string }[]> = {
  auto: [
    { value: 'vehicle_body', label: 'Body and paint' },
    { value: 'vehicle_mechanical', label: 'Mechanical repair' },
    { value: 'towing', label: 'Towing' },
    { value: 'rental', label: 'Rental car' },
    { value: 'personal', label: 'Personal belongings' },
    { value: 'other', label: 'Other' },
  ],
  home: [
    { value: 'structure', label: 'Walls, floors, roof' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'personal', label: 'Personal belongings' },
    { value: 'other', label: 'Other' },
  ],
};

export interface Claimant {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface OtherParty {
  name: string;
  insurer: string;
  plate: string;
}

export interface AutoDetails {
  vehicle: Vehicle;
  drivable: boolean;
  otherPartyInvolved: boolean;
  otherParty: OtherParty | null;
}

export interface HomeDetails {
  cause: HomeCause;
  rooms: string[];
  habitable: boolean;
  needsAccommodation: boolean;
}

export interface Incident {
  /** yyyy-mm-dd */
  date: string;
  /** HH:mm */
  time: string;
  location: string;
  description: string;
  policeReportNumber: string | null;
  auto: AutoDetails | null;
  home: HomeDetails | null;
}

export interface ClaimItem {
  description: string;
  category: ItemCategory;
  amount: number;
}

export interface ClaimDocument {
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface ClaimInput {
  policyNumber: string;
  type: ClaimType;
  claimant: Claimant;
  incident: Incident;
  items: ClaimItem[];
  documents: ClaimDocument[];
}

export type ClaimEventKind = 'submitted' | 'status' | 'assigned' | 'note';

export interface ClaimEvent {
  id: string;
  at: string;
  actorName: string;
  kind: ClaimEventKind;
  from?: ClaimStatus;
  to?: ClaimStatus;
  /** For `status` events moving to needs_info or rejected this is shown to the claimant. */
  note?: string;
}

export interface Claim extends ClaimInput {
  id: string;
  number: string;
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
  assigneeId: string | null;
  total: number;
  events: ClaimEvent[];
}

/** What a claimant sees when tracking a claim: no internal notes, no staff names. */
export interface PublicClaim {
  number: string;
  type: ClaimType;
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
  total: number;
  timeline: { at: string; status: ClaimStatus; message: string | null }[];
}

export interface ClaimSummary {
  id: string;
  number: string;
  type: ClaimType;
  status: ClaimStatus;
  claimantName: string;
  total: number;
  createdAt: string;
  incidentDate: string;
  assigneeId: string | null;
}

export interface ClaimPage {
  items: ClaimSummary[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<ClaimStatus | 'all', number>;
}

/* --------------------------------- audit --------------------------------- */

export type AuditAction = 'claim_submitted' | 'status_changed' | 'assigned' | 'note_added';

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string | null;
  actorName: string;
  action: AuditAction;
  claimId: string;
  claimNumber: string;
  detail: string;
}

export interface AuditPage {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}
