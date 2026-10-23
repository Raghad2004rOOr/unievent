import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const neonAuth = pgSchema('neon_auth')
export const authUser = neonAuth.table('user', {
  id: uuid('id').primaryKey(),
})

const id = (name: string) => bigint(name, { mode: 'number' }).generatedByDefaultAsIdentity()
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

export const colleges = pgTable('colleges', {
  collegeId: id('college_id').primaryKey(),
  collegeName: text('college_name').notNull().unique(),
  createdAt: createdAt(),
})

export const roles = pgTable('roles', {
  roleId: smallint('role_id').generatedByDefaultAsIdentity().primaryKey(),
  roleName: text('role_name').notNull().unique(),
  description: text('description'),
  createdAt: createdAt(),
})

export const categories = pgTable('categories', {
  categoryId: id('category_id').primaryKey(),
  categoryName: text('category_name').notNull().unique(),
  description: text('description'),
  createdAt: createdAt(),
})

export const clubs = pgTable('clubs', {
  clubId: id('club_id').primaryKey(),
  collegeId: bigint('college_id', { mode: 'number' }).notNull().references(() => colleges.collegeId, { onDelete: 'restrict' }),
  clubName: text('club_name').notNull().unique(),
  description: text('description'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const users = pgTable('users', {
  userId: uuid('user_id').primaryKey().references(() => authUser.id, { onDelete: 'cascade' }),
  collegeId: bigint('college_id', { mode: 'number' }).references(() => colleges.collegeId, { onDelete: 'set null' }),
  roleId: smallint('role_id').notNull().references(() => roles.roleId, { onDelete: 'restrict' }),
  major: text('major'),
  userType: text('user_type').notNull().default('student'),
  isActive: boolean('is_active').notNull().default(true),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  check('users_user_type_check', sql`${table.userType} in ('student', 'organizer', 'admin')`),
])

export const clubOrganizers = pgTable('club_organizers', {
  clubOrganizerId: id('club_organizer_id').primaryKey(),
  clubId: bigint('club_id', { mode: 'number' }).notNull().references(() => clubs.clubId, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().unique().references(() => users.userId, { onDelete: 'cascade' }),
  addedBy: uuid('added_by').references(() => users.userId, { onDelete: 'set null' }),
  createdAt: createdAt(),
})

export const studentInterests = pgTable('student_interests', {
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  categoryId: bigint('category_id', { mode: 'number' }).notNull().references(() => categories.categoryId, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (table) => [primaryKey({ columns: [table.userId, table.categoryId] })])

export const events = pgTable('events', {
  eventId: id('event_id').primaryKey(),
  categoryId: bigint('category_id', { mode: 'number' }).notNull().references(() => categories.categoryId, { onDelete: 'restrict' }),
  createdBy: uuid('created_by').notNull().references(() => users.userId, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  eventMode: text('event_mode').notNull(),
  location: text('location'),
  onlineUrl: text('online_url'),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  registrationDeadline: timestamp('registration_deadline', { withTimezone: true }),
  registrationMode: text('registration_mode').notNull().default('open'),
  capacity: integer('capacity'),
  status: text('status').notNull().default('pending'),
  approvedBy: uuid('approved_by').references(() => users.userId, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  cancellationReason: text('cancellation_reason'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  check('events_mode_check', sql`${table.eventMode} in ('in_person', 'online', 'hybrid')`),
  check('events_registration_mode_check', sql`${table.registrationMode} in ('open', 'approval_required')`),
  check('events_status_check', sql`${table.status} in ('draft', 'pending', 'approved', 'rejected', 'cancelled', 'completed')`),
  check('events_capacity_check', sql`${table.capacity} is null or ${table.capacity} > 0`),
  check('events_valid_times', sql`${table.endTime} > ${table.startTime}`),
  check('events_approval_metadata', sql`(${table.approvedBy} is null and ${table.approvedAt} is null) or (${table.approvedBy} is not null and ${table.approvedAt} is not null)`),
  check('events_mode_location', sql`(${table.eventMode} = 'online' and ${table.onlineUrl} is not null) or (${table.eventMode} = 'in_person' and ${table.location} is not null) or ${table.eventMode} = 'hybrid'`),
])

export const eventClubs = pgTable('event_clubs', {
  eventId: bigint('event_id', { mode: 'number' }).notNull().references(() => events.eventId, { onDelete: 'cascade' }),
  clubId: bigint('club_id', { mode: 'number' }).notNull().references(() => clubs.clubId, { onDelete: 'restrict' }),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: createdAt(),
}, (table) => [
  primaryKey({ columns: [table.eventId, table.clubId] }),
  uniqueIndex('event_clubs_one_primary_per_event').on(table.eventId).where(sql`${table.isPrimary} = true`),
])

export const eventSessions = pgTable('event_sessions', {
  sessionId: id('session_id').primaryKey(),
  eventId: bigint('event_id', { mode: 'number' }).notNull().references(() => events.eventId, { onDelete: 'cascade' }),
  sessionTitle: text('session_title').notNull(),
  description: text('description'),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  location: text('location'),
  createdAt: createdAt(),
}, (table) => [check('event_sessions_valid_times', sql`${table.endTime} > ${table.startTime}`)])

export const savedEvents = pgTable('saved_events', {
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  eventId: bigint('event_id', { mode: 'number' }).notNull().references(() => events.eventId, { onDelete: 'cascade' }),
  savedAt: timestamp('saved_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.eventId] })])

export const registrations = pgTable('registrations', {
  registrationId: id('registration_id').primaryKey(),
  eventId: bigint('event_id', { mode: 'number' }).notNull().references(() => events.eventId, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  status: text('status').notNull().default('registered'),
  registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  waitlistedAt: timestamp('waitlisted_at', { withTimezone: true }),
  promotedAt: timestamp('promoted_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
}, (table) => [
  unique('registrations_event_user_unique').on(table.eventId, table.userId),
  check('registrations_status_check', sql`${table.status} in ('registered', 'waitlisted', 'cancelled')`),
  check('registrations_status_timestamps', sql`(${table.status} <> 'waitlisted' or ${table.waitlistedAt} is not null) and (${table.status} <> 'cancelled' or ${table.cancelledAt} is not null)`),
])

export const attendance = pgTable('attendance', {
  attendanceId: id('attendance_id').primaryKey(),
  registrationId: bigint('registration_id', { mode: 'number' }).notNull().unique().references(() => registrations.registrationId, { onDelete: 'cascade' }),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }).notNull().defaultNow(),
  checkInMethod: text('check_in_method').notNull().default('manual'),
  verifiedBy: uuid('verified_by').references(() => users.userId, { onDelete: 'set null' }),
  attendanceStatus: text('attendance_status').notNull().default('present'),
  createdAt: createdAt(),
}, (table) => [
  check('attendance_method_check', sql`${table.checkInMethod} in ('manual', 'qr', 'other')`),
  check('attendance_status_check', sql`${table.attendanceStatus} in ('present', 'late', 'excused')`),
])

export const certificates = pgTable('certificates', {
  certificateId: id('certificate_id').primaryKey(),
  registrationId: bigint('registration_id', { mode: 'number' }).notNull().unique().references(() => registrations.registrationId, { onDelete: 'cascade' }),
  certificateCode: text('certificate_code').notNull().unique(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  status: text('status').notNull().default('issued'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  certificateUrl: text('certificate_url'),
}, (table) => [
  check('certificates_status_check', sql`${table.status} in ('issued', 'revoked')`),
  check('certificates_revocation', sql`(${table.status} = 'issued' and ${table.revokedAt} is null) or (${table.status} = 'revoked' and ${table.revokedAt} is not null)`),
])

export const feedback = pgTable('feedback', {
  feedbackId: id('feedback_id').primaryKey(),
  registrationId: bigint('registration_id', { mode: 'number' }).notNull().unique().references(() => registrations.registrationId, { onDelete: 'cascade' }),
  rating: smallint('rating').notNull(),
  comment: text('comment'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: updatedAt(),
}, (table) => [check('feedback_rating_check', sql`${table.rating} between 1 and 5`)])

export const auditLogs = pgTable('audit_logs', {
  logId: id('log_id').primaryKey(),
  userId: uuid('user_id').references(() => users.userId, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: jsonb('details').notNull().default({}),
  createdAt: createdAt(),
})

export const promoPosts = pgTable('promo_posts', {
  postId: id('post_id').primaryKey(),
  eventId: bigint('event_id', { mode: 'number' }).notNull().references(() => events.eventId, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').notNull().references(() => users.userId, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  contentAr: text('content_ar'),
  contentEn: text('content_en'),
  posterUrl: text('poster_url'),
  aiGenerated: boolean('ai_generated').notNull().default(false),
  status: text('status').notNull().default('draft'),
  approvedBy: uuid('approved_by').references(() => users.userId, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  check('promo_posts_status_check', sql`${table.status} in ('draft', 'pending', 'approved', 'rejected', 'published')`),
  check('promo_posts_approval_metadata', sql`${table.status} <> 'approved' or (${table.approvedBy} is not null and ${table.approvedAt} is not null)`),
])

export const notifications = pgTable('notifications', {
  notificationId: id('notification_id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  eventId: bigint('event_id', { mode: 'number' }).references(() => events.eventId, { onDelete: 'set null' }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  notificationType: text('notification_type').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: createdAt(),
})
