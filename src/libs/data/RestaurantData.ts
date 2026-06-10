import { api, type ApiResponse } from '@/src/libs/api/client'

// ─── Restaurant Config ────────────────────────────────────────────────────────

export type QmsMode = 'STANDARD' | 'RESTAURANT'

export interface RestaurantCapabilities {
  floorPlan: boolean
  waitlist: boolean
  reservations: boolean
  openTabs: boolean
  kitchenDisplay: boolean
  serverSections: boolean
  qrJoin: boolean
  feedback: boolean
}

export interface RestaurantConfig {
  id: string
  tenantId: string
  mode: QmsMode
  capabilities: RestaurantCapabilities
  updatedAt: string
}

export interface UpdateRestaurantConfigInput {
  mode?: QmsMode
  capabilities?: Partial<RestaurantCapabilities>
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export type TableStatus =
  | 'open'
  | 'reserved'
  | 'seated'
  | 'ordering'
  | 'entree'
  | 'check_dropped'
  | 'needs_bussing'

export type TableShape = 'square' | 'round' | 'rectangle'

export interface RestaurantTable {
  id: string
  number: string
  section?: string | null
  seats: number
  shape: TableShape
  status: TableStatus
  serverId?: string | null
  serverName?: string | null
  activeTabId?: string | null
  partyName?: string | null
  seatedAt?: string | null
  combinedIntoId?: string | null
  combinedTables?: {
    id: string
    number: string
    seats: number
    partyName?: string | null
    activeTabId?: string | null
  }[]
  createdAt: string
  updatedAt: string
}

export interface CreateTableInput {
  number: string
  section?: string
  seats: number
  shape?: TableShape
}

export interface UpdateTableInput {
  number?: string
  section?: string
  seats?: number
  shape?: TableShape
  status?: TableStatus
  serverId?: string | null
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export type TabStatus = 'open' | 'closed' | 'voided'

export interface TabLine {
  id: string
  tabId: string
  itemId: string
  itemName: string
  sku?: string | null
  quantity: number
  unitPrice: number
  modifiers?: string | null
  notes?: string | null
  firedAt?: string | null
  createdAt: string
}

export interface RestaurantTab {
  id: string
  tableId: string
  tableName: string
  status: TabStatus
  serverId?: string | null
  serverName?: string | null
  partyName?: string | null
  partySize?: number | null
  lines: TabLine[]
  subtotal: number
  openedAt: string
  closedAt?: string | null
  posTransactionId?: string | null
  createdAt: string
  updatedAt: string
}

export interface OpenTabInput {
  tableId: string
  partyName?: string
  partySize?: number
  serverId?: string
}

export interface AddTabLineInput {
  itemId: string
  itemName: string
  sku?: string
  quantity: number
  unitPrice: number
  modifiers?: string
  notes?: string
}

export interface UpdateTabLineInput {
  quantity?: number
  modifiers?: string
  notes?: string
}

export interface CloseTabResult {
  posTransactionId: string
  tableId: string
  lines: Array<{
    itemId: string
    itemName: string
    sku?: string | null
    quantity: number
    unitPrice: number
  }>
  subtotal: number
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export type WaitlistStatus = 'waiting' | 'called' | 'seated' | 'no_show'

export interface WaitlistParty {
  id: string
  name: string
  partySize: number
  size?: number
  phone?: string | null
  seatingPreference?: string | null
  quotedWait?: number | null
  status: WaitlistStatus
  joinedAt: string
  seatedAt?: string | null
  tableId?: string | null
}

export interface AddWaitlistPartyInput {
  name: string
  size: number
  phone?: string
  seatingPreference?: string
}

// ─── Sections ─────────────────────────────────────────────────────────────────

export interface RestaurantSection {
  id: string
  name: string
  description?: string | null
  color?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateSectionInput {
  name: string
  description?: string
  color?: string
}

// ─── Server Sections ──────────────────────────────────────────────────────────

export interface ServerSection {
  id: string
  serverId: string
  serverName: string
  sectionId: string
  sectionName: string
  shiftDate: string
  coverCount: number
  createdAt: string
}

export interface AssignServerSectionInput {
  serverId: string
  sectionId: string
  shiftDate: string
}

export interface ServerCoverCount {
  serverId: string
  serverName: string
  coverCount: number
  sectionIds: string[]
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export interface Feedback {
  id: string
  serverId?: string | null
  serverName?: string | null
  guestName?: string | null
  rating: number
  comment?: string | null
  tableId?: string | null
  createdAt: string
}

export interface SubmitFeedbackInput {
  serverId?: string
  guestName?: string
  rating: number
  comment?: string
  tableId?: string
}

export interface FeedbackSummary {
  averageRating: number
  totalResponses: number
  byServer: Array<{
    serverId: string
    serverName: string
    averageRating: number
    responseCount: number
  }>
  ratingDistribution: Record<string, number>
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SEATED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

export interface Booking {
  id: string
  tableId?: string | null
  date: string
  time: string
  partySize: number
  guestName: string
  guestPhone?: string | null
  guestEmail?: string | null
  status: BookingStatus
  notes?: string | null
  createdAt: string
}

export interface CreateBookingInput {
  date: string
  time: string
  partySize: number
  guestName: string
  guestPhone?: string
  guestEmail?: string
  tableId?: string
  notes?: string
}

// ─── Kitchen ──────────────────────────────────────────────────────────────────

export type KitchenTicketStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DONE'

export interface KitchenTicket {
  id: string
  tabId: string
  tableNumber: string
  courseLabel?: string | null
  items: Array<{ name: string; quantity: number; notes?: string | null; modifiers?: string | null }>
  status: KitchenTicketStatus
  firedAt: string
  readyAt?: string | null
}

// ─── Floor Board ──────────────────────────────────────────────────────────────

export interface FloorBoardTable extends RestaurantTable {
  partySize?: number | null
  activeTab?: { id: string; itemCount: number; subtotal: number } | null
  upcomingBooking?: { guestName: string; time: string; partySize: number } | null
}

// ─── API ──────────────────────────────────────────────────────────────────────

// Backend stores capabilities as flat columns and names the QR field "qrWaitlist".
// These two helpers bridge the flat backend shape ↔ nested frontend shape.
function mapBackendToConfig(raw: Record<string, unknown>): RestaurantConfig {
  return {
    id: raw.id as string,
    tenantId: raw.tenantId as string,
    mode: raw.mode as QmsMode,
    updatedAt: (raw.updatedAt ?? raw.createdAt) as string,
    capabilities: {
      floorPlan: Boolean(raw.floorPlan),
      waitlist: Boolean(raw.waitlist),
      reservations: Boolean(raw.reservations),
      openTabs: Boolean(raw.openTabs),
      kitchenDisplay: Boolean(raw.kitchenDisplay),
      serverSections: Boolean(raw.serverSections),
      qrJoin: Boolean(raw.qrWaitlist),
      feedback: Boolean(raw.feedback),
    },
  }
}

function flattenUpdateInput(input: UpdateRestaurantConfigInput): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (input.mode !== undefined) out.mode = input.mode
  if (input.capabilities) {
    const c = input.capabilities
    if (c.floorPlan !== undefined) out.floorPlan = c.floorPlan
    if (c.waitlist !== undefined) out.waitlist = c.waitlist
    if (c.reservations !== undefined) out.reservations = c.reservations
    if (c.openTabs !== undefined) out.openTabs = c.openTabs
    if (c.kitchenDisplay !== undefined) out.kitchenDisplay = c.kitchenDisplay
    if (c.serverSections !== undefined) out.serverSections = c.serverSections
    if (c.qrJoin !== undefined) out.qrWaitlist = c.qrJoin
    if (c.feedback !== undefined) out.feedback = c.feedback
  }
  return out
}

async function wrapConfigResponse(
  res: ApiResponse<Record<string, unknown>>
): Promise<ApiResponse<RestaurantConfig>> {
  if (res.success && res.data) return { ...res, data: mapBackendToConfig(res.data) }
  return { success: res.success, error: res.error } as ApiResponse<RestaurantConfig>
}

export const RestaurantConfigAPI = {
  get: () => api.get<Record<string, unknown>>('/restaurant/config').then(wrapConfigResponse),
  update: (data: UpdateRestaurantConfigInput) =>
    api
      .patch<Record<string, unknown>>('/restaurant/config', flattenUpdateInput(data))
      .then(wrapConfigResponse),
  recommendedSetup: () =>
    api
      .post<Record<string, unknown>>('/restaurant/config/recommended-setup', {})
      .then(wrapConfigResponse),
}

export const RestaurantTables = {
  list: () => api.get<RestaurantTable[]>('/restaurant/tables'),
  get: (id: string) => api.get<RestaurantTable>(`/restaurant/tables/${id}`),
  create: (data: CreateTableInput) => api.post<RestaurantTable>('/restaurant/tables', data),
  update: (id: string, data: UpdateTableInput) =>
    api.patch<RestaurantTable>(`/restaurant/tables/${id}`, data),
  remove: (id: string) => api.delete(`/restaurant/tables/${id}`),
  updateStatus: (id: string, status: TableStatus) =>
    api.patch<RestaurantTable>(`/restaurant/tables/${id}/status`, { status: status.toUpperCase() }),
  clearTable: (id: string) => api.post<RestaurantTable>(`/restaurant/tables/${id}/clear`, {}),
  combine: (tableIds: string[]) =>
    api.post<RestaurantTable>('/restaurant/tables/combine', { tableIds }),
  split: (id: string) => api.post<RestaurantTable[]>(`/restaurant/tables/${id}/split`, {}),
}

export const RestaurantTabs = {
  list: () => api.get<RestaurantTab[]>('/restaurant/tabs'),
  get: (tabId: string) => api.get<RestaurantTab>(`/restaurant/tabs/${tabId}`),
  getActiveByTable: (tableId: string) =>
    api.get<RestaurantTab>(`/restaurant/tabs/active/${tableId}`),
  open: (tableId: string, data?: Omit<OpenTabInput, 'tableId'>) =>
    api.post<RestaurantTab>('/restaurant/tabs', { tableId, ...(data ?? {}) }),
  addLine: (tabId: string, data: AddTabLineInput) =>
    api.post<TabLine>(`/restaurant/tabs/${tabId}/lines`, data),
  updateLine: (tabId: string, lineId: string, data: UpdateTabLineInput) =>
    api.patch<TabLine>(`/restaurant/tabs/${tabId}/lines/${lineId}`, data),
  removeLine: (tabId: string, lineId: string) =>
    api.delete(`/restaurant/tabs/${tabId}/lines/${lineId}`),
  close: (tabId: string) => api.post<CloseTabResult>(`/restaurant/tabs/${tabId}/close`, {}),
  void: (tabId: string, reason?: string) =>
    api.post<RestaurantTab>(`/restaurant/tabs/${tabId}/void`, { reason }),
  fireCourse: (tabId: string, courseItems: unknown) =>
    api.post(`/restaurant/tabs/${tabId}/fire-course`, { courseItems }),
}

export const RestaurantWaitlist = {
  list: () => api.get<WaitlistParty[]>('/restaurant/waitlist'),
  add: (data: AddWaitlistPartyInput) => api.post<WaitlistParty>('/restaurant/waitlist', data),
  seat: (id: string, tableId: string) =>
    api.post<WaitlistParty>(`/restaurant/waitlist/${id}/seat`, { tableId }),
  noShow: (id: string) => api.patch<WaitlistParty>(`/restaurant/waitlist/${id}/no-show`, {}),
  moveBack: (id: string) => api.patch<WaitlistParty>(`/restaurant/waitlist/${id}/move-back`, {}),
}

export const RestaurantBookings = {
  list: (date?: string) => api.get<Booking[]>('/restaurant/bookings', date ? { date } : undefined),
  create: (data: CreateBookingInput) => api.post<Booking>('/restaurant/bookings', data),
  update: (id: string, data: Partial<CreateBookingInput & { status: BookingStatus }>) =>
    api.patch<Booking>(`/restaurant/bookings/${id}`, data),
  remove: (id: string) => api.delete(`/restaurant/bookings/${id}`),
  availableSlots: (date: string, partySize: number) =>
    api.get<string[]>('/restaurant/bookings/available-slots', { date, partySize }),
}

export const RestaurantSections = {
  list: () => api.get<RestaurantSection[]>('/restaurant/sections'),
  create: (data: CreateSectionInput) => api.post<RestaurantSection>('/restaurant/sections', data),
  update: (id: string, data: Partial<CreateSectionInput>) =>
    api.patch<RestaurantSection>(`/restaurant/sections/${id}`, data),
  remove: (id: string) => api.delete(`/restaurant/sections/${id}`),
}

export const RestaurantServerSections = {
  list: (shiftDate?: string) =>
    api.get<ServerSection[]>('/restaurant/server-sections', shiftDate ? { shiftDate } : undefined),
  assign: (data: AssignServerSectionInput) =>
    api.post<ServerSection>('/restaurant/server-sections', data),
  coverCounts: (shiftDate?: string) =>
    api.get<ServerCoverCount[]>(
      '/restaurant/server-sections/cover-counts',
      shiftDate ? { shiftDate } : undefined
    ),
  suggest: (partySize: number, sectionId?: string) =>
    api.get<{ serverId: string; serverName: string }>('/restaurant/server-sections/suggest', {
      partySize,
      ...(sectionId ? { sectionId } : {}),
    }),
  remove: (id: string) => api.delete(`/restaurant/server-sections/${id}`),
}

export const RestaurantFeedback = {
  submit: (data: SubmitFeedbackInput) => api.post<Feedback>('/restaurant/feedback', data),
  summary: (params?: { serverId?: string; from?: string; to?: string }) =>
    api.get<FeedbackSummary>('/restaurant/feedback/summary', params),
}

export const RestaurantKitchen = {
  tickets: () => api.get<KitchenTicket[]>('/restaurant/kitchen/tickets'),
  updateStatus: (id: string, status: KitchenTicketStatus) =>
    api.patch<KitchenTicket>(`/restaurant/kitchen/tickets/${id}/status`, { status }),
}

export const RestaurantFloor = {
  board: () => api.get<FloorBoardTable[]>('/restaurant/floor-board'),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  open: 'Open',
  reserved: 'Reserved',
  seated: 'Seated',
  ordering: 'Ordering',
  entree: 'Entrée',
  check_dropped: 'Check Dropped',
  needs_bussing: 'Needs Bussing',
}

export const TABLE_STATUS_COLORS: Record<
  TableStatus,
  { bg: string; text: string; border: string }
> = {
  open: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  reserved: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  seated: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  ordering: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  entree: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  check_dropped: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  needs_bussing: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
}

export const CAPABILITY_LABELS: Record<keyof RestaurantCapabilities, string> = {
  floorPlan: 'Floor Plan & Tables',
  waitlist: 'Waitlist & Seating',
  reservations: 'Reservations',
  openTabs: 'Open Tabs & Orders',
  kitchenDisplay: 'Kitchen Display',
  serverSections: 'Server Sections',
  qrJoin: 'QR Waitlist Join',
  feedback: 'Post-Visit Feedback',
}

export const RECOMMENDED_CAPABILITIES: RestaurantCapabilities = {
  floorPlan: true,
  waitlist: true,
  reservations: true,
  openTabs: true,
  kitchenDisplay: true,
  serverSections: false,
  qrJoin: true,
  feedback: false,
}

export const DEFAULT_CAPABILITIES: RestaurantCapabilities = {
  floorPlan: false,
  waitlist: false,
  reservations: false,
  openTabs: false,
  kitchenDisplay: false,
  serverSections: false,
  qrJoin: false,
  feedback: false,
}
