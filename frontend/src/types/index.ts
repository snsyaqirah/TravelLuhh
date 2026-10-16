// Wire types for the TravelLuhh API (contract: scratchpad/contracts/API.md).
// Every id is a number (Java Long). Dates are 'YYYY-MM-DD' strings, timestamps are ISO local date-times
// without an offset. Parse them with lib/dates, never with new Date('YYYY-MM-DD').
import type { CategoryKey } from '@/design/tokens';

export type Id = number;
export type Role = 'owner' | 'editor' | 'viewer';
export type AuthProvider = 'local' | 'google';
export type BudgetType = 'solo' | 'shared' | 'separated';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'tropical';
/** Server-side status. Not date-driven; derive the phase from dates with lib/phase instead. */
export type TripStatus = 'PLANNED' | 'ONGOING' | 'COMPLETED';
export type ExpenseCategory = CategoryKey;

/** Exchange rates with `base` as the unit: rates[X] = how many X one unit of base buys. */
export interface Rates {
  base: string;
  /** Date the rates were published ('YYYY-MM-DD'). */
  date: string;
  rates: Record<string, number>;
}

// ── Errors ──────────────────────────────────────────────────────────────────

/** Error body the backend sends for every 4xx/5xx. */
export interface ApiError {
  status: number;
  error?: string;
  message?: string;
  path?: string;
  timestamp?: string;
  /** Only on 400 validation errors: field name to message. */
  fieldErrors?: Record<string, string>;
}

// ── Users and auth ──────────────────────────────────────────────────────────

/** UserResponse. Never contains a password hash. */
export interface User {
  id: Id;
  name: string;
  email: string;
  avatar?: string | null;
  authProvider: AuthProvider;
  country?: string | null;
  /** Home currency (ISO 4217). */
  currency?: string | null;
  onboardingCompleted?: boolean;
  emailVerified?: boolean;
  /** false for Google-only accounts: hide change-password. */
  hasPassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSummary {
  id: Id;
  name: string;
  email?: string | null;
  avatar?: string | null;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface UpdateProfileRequest {
  name?: string;
  country?: string;
  currency?: string;
  onboardingCompleted?: boolean;
}

export interface MessageResponse {
  message: string;
}

/** PUT /users/change-password: every other session ends, so a fresh token pair comes back. */
export interface ChangePasswordResponse extends MessageResponse, Partial<LoginResponse> {}

// ── Members ─────────────────────────────────────────────────────────────────

/** MemberDto. `id` is the membership id (use it for PATCH/DELETE), `userId` the person. */
export interface Member {
  id: Id;
  userId: Id;
  name: string;
  email: string;
  avatar?: string | null;
  role: Role;
  joinedAt: string;
}

/** @deprecated Use Member. Kept so older components still compile. */
export type TripMember = Member;

export interface AddMemberRequest {
  email: string;
  role: Exclude<Role, 'owner'>;
}

/** Separated-mode allocation row (GET/PUT /trips/{id}/budgets). Trip currency. */
export interface MemberBudget {
  userId: Id;
  name: string;
  avatar?: string | null;
  allocated: number;
  spent: number;
  remaining: number;
}

export interface MemberBudgetInput {
  userId: Id;
  /** 0 removes the allocation. */
  allocated: number;
}

// ── Trips ───────────────────────────────────────────────────────────────────

export interface Trip {
  id: Id;
  ownerId: Id;
  owner?: UserSummary;
  name: string;
  /** ISO 3166 alpha-2 code. */
  destinationCountry: string;
  startDate: string;
  endDate: string;
  description?: string | null;
  image?: string | null;
  /** Target, in the trip currency. 0 means no budget. */
  budget: number;
  /** Trip currency: every trip-level amount (budget, spent, saved, expense.amount) is in it. */
  currency: string;
  budgetType: BudgetType;
  season?: Season | null;
  notes?: string | null;
  status?: TripStatus;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  members?: Member[];
  memberCount?: number;
  /** trips.spent_amount, trigger-maintained. Same value as spentAmount. */
  totalExpenses?: number;
  spentAmount?: number;
  /** SUM(trip_fund_entries.amount); 0 when nothing has been dropped in. */
  savedAmount?: number;
  /** trips.remaining_budget (budget − spent, trip currency). Negative when over. */
  remainingBudget?: number;
  myRole?: Role;
}

/** POST /api/trips body. */
export interface CreateTripRequest {
  name: string;
  destinationCountry: string;
  startDate: string;
  endDate: string;
  budget: number;
  currency: string;
  budgetType: BudgetType;
  season?: Season | null;
  description?: string;
  notes?: string;
}

/** PUT /api/trips/{id} body (partial). budgetType and isArchived are owner-only. */
export interface UpdateTripRequest extends Partial<CreateTripRequest> {
  isArchived?: boolean;
  image?: string;
}

/**
 * Input accepted by useTrips().createTrip. Prefer the contract fields (budget, currency).
 * `totalBudget` / `favoriteCurrency` are the pre-revamp names, still accepted so the old TripForm works.
 */
export interface CreateTripInput {
  name: string;
  destinationCountry: string;
  startDate: string;
  endDate: string;
  budget?: number;
  currency?: string;
  budgetType?: BudgetType;
  season?: Season | null;
  description?: string;
  notes?: string;
  image?: string;
  /** @deprecated use budget */
  totalBudget?: number;
  /** @deprecated use currency */
  favoriteCurrency?: string;
}

export interface UpdateTripInput extends Partial<CreateTripInput> {
  id: Id | string;
  isArchived?: boolean;
}

// ── Expenses ────────────────────────────────────────────────────────────────

export interface ExpenseSubItem {
  id: Id;
  description: string;
  amount: number;
  category?: ExpenseCategory | null;
}

export interface Expense {
  id: Id;
  tripId: Id;
  description: string;
  /** In the trip currency. */
  amount: number;
  /** Always the trip currency. */
  currency: string;
  /** What was actually paid, in the currency it was paid in. Equal to amount/currency when not converted. */
  originalAmount?: number | null;
  originalCurrency?: string | null;
  /** originalAmount × fxRate ≈ amount. Null when no conversion happened. */
  fxRate?: number | null;
  category: ExpenseCategory;
  expenseDate: string;
  notes?: string | null;
  /** userId of whoever logged it. */
  addedBy?: Id | null;
  addedByUser?: UserSummary | null;
  /** userId of whoever paid; falls back to addedBy. */
  paidBy?: Id | null;
  paidByUser?: UserSummary | null;
  subItems?: ExpenseSubItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubItemInput {
  description: string;
  amount: number;
  category?: ExpenseCategory;
}

/** POST /api/expenses and PUT /api/expenses/{id} body. amount/currency are in the trip currency. */
export interface CreateExpenseRequest {
  tripId: Id;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  expenseDate: string;
  notes?: string;
  originalAmount?: number;
  originalCurrency?: string;
  fxRate?: number;
  paidBy?: Id;
  subItems?: CreateSubItemInput[];
}

/**
 * Input accepted by useExpenses().createExpense / updateExpense. tripId defaults to the hook's trip.
 * `date` is the pre-revamp name of expenseDate and is still accepted.
 */
export interface CreateExpenseInput {
  tripId?: Id | string;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  expenseDate?: string;
  /** @deprecated use expenseDate */
  date?: string;
  notes?: string;
  originalAmount?: number;
  originalCurrency?: string;
  fxRate?: number;
  paidBy?: Id;
  subItems?: CreateSubItemInput[];
}

export interface UpdateExpenseInput extends CreateExpenseInput {
  id: Id | string;
}

// ── Itinerary ───────────────────────────────────────────────────────────────

export interface ItineraryItem {
  id: Id;
  tripId: Id;
  itemDate: string;
  /** 'HH:mm' or 'HH:mm:ss'. */
  startTime?: string | null;
  endTime?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  category?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItineraryItemRequest {
  itemDate: string;
  title: string;
  /** Send 'HH:mm'. */
  startTime?: string;
  endTime?: string;
  description?: string;
  location?: string;
  category?: string;
}

// ── Packing ─────────────────────────────────────────────────────────────────

export interface PackingItem {
  id: Id;
  tripId: Id;
  label: string;
  category?: string | null;
  isChecked: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PackingPreset = 'general' | 'beach' | 'hiking' | 'business' | 'umrah';

// ── Notes ───────────────────────────────────────────────────────────────────

export type NoteType = 'quick_info' | 'custom';
export type NoteCategory = 'local_tips' | 'food' | 'transport' | 'safety' | 'emergency' | 'custom';

export interface Note {
  id: Id;
  tripId: Id;
  noteType: NoteType;
  /** Custom notes: the NoteCategory. Quick info: the field key (language, plug, tipping, emergency_number…). */
  infoKey?: string | null;
  title?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  noteType: NoteType;
  infoKey?: string;
  title?: string;
  content: string;
}

/** @deprecated Use Note. */
export type DestinationNote = Note;

// ── Travel fund ─────────────────────────────────────────────────────────────

export interface FundEntry {
  id: Id;
  tripId: Id;
  userId?: Id | null;
  userName?: string | null;
  /** Trip currency; negative for a withdrawal. */
  amount: number;
  note?: string | null;
  entryDate: string;
  createdAt: string;
}

export interface FundSummary {
  /** trip.budget */
  target: number;
  /** SUM of entries */
  saved: number;
  currency: string;
  /** Newest first. */
  entries: FundEntry[];
}

export interface FundEntryInput {
  /** Non-zero; negative takes money out. */
  amount: number;
  entryDate: string;
  note?: string;
}

// ── Settlement ──────────────────────────────────────────────────────────────

export interface SettlementBalance {
  userId: Id;
  name: string;
  avatar?: string | null;
  paid: number;
  share: number;
  /** paid − share: positive is owed money, negative owes. */
  net: number;
  /**
   * false: paid on the trip but has since left or been removed. Takes no share (0); the others pay them back.
   * Show as "left the trip". Absent on older servers: treat as true.
   */
  onTrip?: boolean;
}

export interface SettlementTransaction {
  fromUserId: Id;
  fromName: string;
  toUserId: Id;
  toName: string;
  amount: number;
}

export interface Settlement {
  totalSpent: number;
  currency?: string;
  perPerson?: number;
  balances: SettlementBalance[];
  transactions: SettlementTransaction[];
}

// ── Activity ────────────────────────────────────────────────────────────────

export type ActivityType =
  | 'trip_created'
  | 'trip_updated'
  | 'expense_added'
  | 'expense_updated'
  | 'expense_deleted'
  | 'itinerary_added'
  | 'itinerary_updated'
  | 'itinerary_deleted'
  | 'packing_added'
  | 'packing_checked'
  | 'packing_unchecked'
  | 'packing_deleted'
  | 'packing_preset'
  | 'member_added'
  | 'member_removed'
  | 'member_role_changed'
  | 'member_left'
  | 'fund_added'
  | 'fund_deleted'
  | 'note_saved'
  | 'note_deleted'
  | 'budgets_updated';

export interface Activity {
  id: Id;
  tripId: Id;
  userId?: Id | null;
  actorName: string;
  /** One of ActivityType; typed as string so unknown future values still render. */
  actionType: ActivityType | (string & {});
  description: string;
  createdAt: string;
}

// ── Reference data ──────────────────────────────────────────────────────────

export type Region = 'asia' | 'europe' | 'americas' | 'africa_me' | 'oceania';

export interface Country {
  code: string;
  name: string;
  /** false for tropical destinations: the season shows as Tropical. */
  hasSeason: boolean;
  currency: string;
  region?: Region;
  capital?: string;
  lat?: number;
  lng?: number;
}

// ── Pre-revamp shapes still imported by older pages ─────────────────────────

export interface BudgetOverview {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  percentageSpent: number;
}

export interface CategoryBreakdown {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
  color: string;
}

export interface DashboardData {
  budgetOverview: BudgetOverview;
  categoryBreakdown: CategoryBreakdown[];
  recentExpenses: Expense[];
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

/** Budget alerts are computed client-side (no API). */
export interface BudgetAlert {
  id: string;
  tripId: Id;
  thresholdPercentage: number;
  triggered: boolean;
  triggeredAt?: string;
}
