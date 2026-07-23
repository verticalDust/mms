import { sql } from 'drizzle-orm'
import {
  sqliteTable,
  integer,
  text,
  real,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core'

// Shared timestamp helpers — everything is stored UTC (epoch ms). Factory
// timezone is applied only at the display/scheduling edges (see PLAN §1.5).
const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())

// ── Users, sessions, settings ────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'technician'] })
    .notNull()
    .default('technician'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // opaque random token stored in the cookie
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: createdAt(),
})

export const passwordResets = sqliteTable('password_resets', {
  id: text('id').primaryKey(), // opaque random token, emailed
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp_ms' }),
  createdAt: createdAt(),
})

// Single-row factory configuration (id is always 1).
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  factoryName: text('factory_name').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

// ── Machines & downtime (invariant #2: downtime lives ONLY here) ──────────────

export const machines = sqliteTable(
  'machines',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull().unique(), // e.g. M-014
    name: text('name').notNull(),
    location: text('location'),
    notes: text('notes'),
    photoPath: text('photo_path'),
    // Running/Down is DERIVED from an open downtime_period, never stored here.
    // retiredAt is a separate lifecycle state (not downtime).
    retiredAt: integer('retired_at', { mode: 'timestamp_ms' }),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('machines_code_idx').on(t.code)],
)

// The single source of truth for downtime. A machine is "Down" iff it has a
// period with endedAt IS NULL. Duration is stored on close and recomputed on
// edit — nothing else keeps a copy.
export const downtimePeriods = sqliteTable(
  'downtime_periods',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    machineId: integer('machine_id')
      .notNull()
      .references(() => machines.id),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
    durationMs: integer('duration_ms'), // set on close/edit; endedAt - startedAt
    openedBy: integer('opened_by').references(() => users.id),
    closedBy: integer('closed_by').references(() => users.id),
    // Set when a breakdown work order closes this period (E3-S8). Plain column
    // (no FK) to avoid a work_orders ↔ downtime circular reference.
    workOrderId: integer('work_order_id'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('downtime_open_idx').on(t.machineId, t.endedAt)],
)

// ── Parts & the append-only stock ledger (invariant #1) ───────────────────────

export const parts = sqliteTable(
  'parts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sku: text('sku').notNull().unique(), // e.g. BRG-6204
    name: text('name').notNull(),
    unit: text('unit').notNull().default('pcs'),
    binLocation: text('bin_location'),
    photoPath: text('photo_path'),
    minLevel: integer('min_level').notNull().default(0),
    unitCost: real('unit_cost'),
    // Cached balance. Updated in the SAME transaction as every movement insert,
    // and must equal SUM(stock_movements.quantity). Never negative.
    onHand: integer('on_hand').notNull().default(0),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('parts_sku_idx').on(t.sku)],
)

// Fitment (E2-S8/S9, PLAN §6): which spare parts a machine uses — the industry's
// bill of materials. Informational and DECOUPLED from the stock ledger; a link
// row never touches on_hand or stock_movements. unique(machine_id, part_id) keeps
// a part attached at most once; deleting a link removes only the row.
export const machineParts = sqliteTable(
  'machine_parts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    machineId: integer('machine_id')
      .notNull()
      .references(() => machines.id),
    partId: integer('part_id')
      .notNull()
      .references(() => parts.id),
    quantity: integer('quantity'), // how many the machine uses (nullable)
    note: text('note'), // e.g. position — "front bearing"
    createdBy: integer('created_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('machine_parts_unq').on(t.machineId, t.partId),
    index('machine_parts_machine_idx').on(t.machineId),
    index('machine_parts_part_idx').on(t.partId),
  ],
)

// Append-only. `quantity` is a SIGNED delta (+receive, −issue, ±adjust,
// reversal = negation of the referenced movement). SUM(quantity) == parts.onHand.
// Corrections are new reversing rows — nothing is ever updated or deleted.
export const stockMovements = sqliteTable(
  'stock_movements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    partId: integer('part_id')
      .notNull()
      .references(() => parts.id),
    type: text('type', {
      enum: ['receive', 'issue', 'adjust', 'reverse'],
    }).notNull(),
    quantity: integer('quantity').notNull(), // signed delta
    balanceAfter: integer('balance_after').notNull(), // onHand immediately after
    reason: text('reason'),
    note: text('note'),
    workOrderId: integer('work_order_id'), // plain column (avoids FK cycle)
    reversesMovementId: integer('reverses_movement_id'), // self-pointer, plain
    actorId: integer('actor_id').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index('movements_part_idx').on(t.partId, t.createdAt)],
)

// ── Work orders ───────────────────────────────────────────────────────────────

export const pmSchedules = sqliteTable('pm_schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  machineId: integer('machine_id')
    .notNull()
    .references(() => machines.id),
  title: text('title').notNull(),
  intervalDays: integer('interval_days').notNull(),
  nextDueDate: integer('next_due_date', { mode: 'timestamp_ms' }).notNull(),
  defaultAssigneeId: integer('default_assignee_id').references(() => users.id),
  checklistTemplate: text('checklist_template'), // JSON array of step strings
  paused: integer('paused', { mode: 'boolean' }).notNull().default(false),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  machineId: integer('machine_id')
    .notNull()
    .references(() => machines.id),
  description: text('description').notNull(),
  reporterName: text('reporter_name'),
  photoPath: text('photo_path'),
  status: text('status', { enum: ['new', 'handled', 'dismissed'] })
    .notNull()
    .default('new'),
  workOrderId: integer('work_order_id'), // set when converted (plain, avoids cycle)
  dismissReason: text('dismiss_reason'),
  handledBy: integer('handled_by').references(() => users.id),
  handledAt: integer('handled_at', { mode: 'timestamp_ms' }),
  createdAt: createdAt(),
})

export const workOrders = sqliteTable(
  'work_orders',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    machineId: integer('machine_id')
      .notNull()
      .references(() => machines.id),
    priority: text('priority', {
      enum: ['low', 'medium', 'high', 'critical'],
    })
      .notNull()
      .default('medium'),
    status: text('status', {
      enum: ['open', 'in_progress', 'done', 'cancelled'],
    })
      .notNull()
      .default('open'),
    assigneeId: integer('assignee_id').references(() => users.id),
    dueDate: integer('due_date', { mode: 'timestamp_ms' }),
    description: text('description'),
    source: text('source', { enum: ['manual', 'pm', 'report'] })
      .notNull()
      .default('manual'),
    // PM-generated jobs carry their schedule + the due date they were made for.
    // The unique index below makes generation idempotent (invariant #3).
    pmScheduleId: integer('pm_schedule_id').references(() => pmSchedules.id),
    reportId: integer('report_id'), // plain column (avoids reports ↔ WO cycle)
    cancelReason: text('cancel_reason'),
    completionNote: text('completion_note'),
    timeSpentMinutes: integer('time_spent_minutes'),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('wo_status_idx').on(t.status, t.dueDate),
    index('wo_assignee_idx').on(t.assigneeId, t.status),
    // Idempotent PM generation: at most one work order per (schedule, due date).
    uniqueIndex('wo_pm_due_unq')
      .on(t.pmScheduleId, t.dueDate)
      .where(sql`${t.pmScheduleId} is not null`),
  ],
)

export const workOrderStatusHistory = sqliteTable('wo_status_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workOrderId: integer('work_order_id')
    .notNull()
    .references(() => workOrders.id),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  note: text('note'),
  actorId: integer('actor_id').references(() => users.id),
  createdAt: createdAt(),
})

// Each line links to the ledger movement that issued it (invariant #1).
// Removing a line inserts a reversing movement and flips `reversed` — both the
// original and the reversal stay visible.
export const workOrderParts = sqliteTable('work_order_parts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workOrderId: integer('work_order_id')
    .notNull()
    .references(() => workOrders.id),
  partId: integer('part_id')
    .notNull()
    .references(() => parts.id),
  quantity: integer('quantity').notNull(),
  movementId: integer('movement_id')
    .notNull()
    .references(() => stockMovements.id),
  reversed: integer('reversed', { mode: 'boolean' }).notNull().default(false),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: createdAt(),
})

export const checklistItems = sqliteTable('checklist_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workOrderId: integer('work_order_id')
    .notNull()
    .references(() => workOrders.id),
  position: integer('position').notNull(),
  text: text('text').notNull(),
  checked: integer('checked', { mode: 'boolean' }).notNull().default(false),
  checkedBy: integer('checked_by').references(() => users.id),
  checkedAt: integer('checked_at', { mode: 'timestamp_ms' }),
  createdAt: createdAt(),
})

// Polymorphic attachment: entityType ∈ machine | work_order | report.
export const photos = sqliteTable(
  'photos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entityType: text('entity_type', {
      enum: ['machine', 'work_order', 'report'],
    }).notNull(),
    entityId: integer('entity_id').notNull(),
    path: text('path').notNull(),
    uploadedBy: integer('uploaded_by').references(() => users.id), // null for public reports
    createdAt: createdAt(),
  },
  (t) => [index('photos_entity_idx').on(t.entityType, t.entityId)],
)

export type User = typeof users.$inferSelect
export type Machine = typeof machines.$inferSelect
export type Part = typeof parts.$inferSelect
export type WorkOrder = typeof workOrders.$inferSelect
export type StockMovement = typeof stockMovements.$inferSelect
export type DowntimePeriod = typeof downtimePeriods.$inferSelect
export type MachinePart = typeof machineParts.$inferSelect
