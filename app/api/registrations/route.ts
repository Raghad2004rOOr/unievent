import { and, asc, count, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { attendance, events, registrations, users } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

async function getStudentId() {
  const { data } = await auth.getSession()
  const user = data?.user
  if (!user) return { id: null, response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }) }

  const [profile] = await db
    .select({ userId: users.userId, userType: users.userType })
    .from(users)
    .where(eq(users.userId, user.id))
    .limit(1)

  if (!profile || profile.userType !== 'student') {
    return { id: null, response: NextResponse.json({ error: 'A student account is required to manage event tickets.' }, { status: 403 }) }
  }

  return { id: profile.userId, response: null }
}

function hasSameOrigin(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite) return fetchSite === 'same-origin'

  const origin = request.headers.get('origin')
  return !!origin && origin === new URL(request.url).origin
}

async function readEventId(request: Request) {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || !('eventId' in body)) return null
    const value = Number(body.eventId)
    return Number.isSafeInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })

  const { id: userId, response } = await getStudentId()
  if (response) return response
  const eventId = await readEventId(request)
  if (!eventId || !userId) return NextResponse.json({ error: 'A valid event is required.' }, { status: 400 })

  try {
    const result = await db.transaction(async (tx) => {
      const [event] = await tx
        .select({
          id: events.eventId,
          status: events.status,
          registrationMode: events.registrationMode,
          registrationDeadline: events.registrationDeadline,
          startTime: events.startTime,
          capacity: events.capacity,
        })
        .from(events)
        .where(eq(events.eventId, eventId))
        .for('update')
        .limit(1)

      if (!event || event.status !== 'approved') return { error: 'This event is not open for registration.', httpStatus: 404 as const }
      const now = new Date()
      if (event.startTime <= now || (event.registrationDeadline && event.registrationDeadline <= now)) {
        return { error: 'Registration for this event has closed.', httpStatus: 409 as const }
      }
      if (event.registrationMode === 'approval_required') {
        return { error: 'This event requires organizer approval and cannot use one-click registration.', httpStatus: 409 as const }
      }

      const [existing] = await tx
        .select({ id: registrations.registrationId, status: registrations.status })
        .from(registrations)
        .where(and(eq(registrations.eventId, eventId), eq(registrations.userId, userId)))
        .limit(1)

      if (existing?.status === 'registered' || existing?.status === 'waitlisted') {
        return { registrationId: existing.id, status: existing.status }
      }

      const [activeCount] = await tx
        .select({ total: count() })
        .from(registrations)
        .where(and(eq(registrations.eventId, eventId), eq(registrations.status, 'registered')))

      const status = event.capacity !== null && activeCount.total >= event.capacity ? 'waitlisted' : 'registered'
      const timestamp = new Date()

      if (existing) {
        await tx.update(registrations)
          .set({ status, registeredAt: timestamp, waitlistedAt: status === 'waitlisted' ? timestamp : null, promotedAt: null, cancelledAt: null })
          .where(eq(registrations.registrationId, existing.id))
        return { registrationId: existing.id, status }
      }

      const [registration] = await tx.insert(registrations).values({
        eventId,
        userId,
        status,
        waitlistedAt: status === 'waitlisted' ? timestamp : null,
      }).returning({ id: registrations.registrationId })

      return { registrationId: registration.id, status }
    })

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.httpStatus })
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to register for this event right now.' }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })

  const { id: userId, response } = await getStudentId()
  if (response) return response
  const eventId = await readEventId(request)
  if (!eventId || !userId) return NextResponse.json({ error: 'A valid event is required.' }, { status: 400 })

  try {
    const result = await db.transaction(async (tx) => {
      const [event] = await tx.select({ id: events.eventId })
        .from(events)
        .where(eq(events.eventId, eventId))
        .for('update')
        .limit(1)
      if (!event) return { error: 'Event not found.', httpStatus: 404 as const }

      const [registration] = await tx.select({ id: registrations.registrationId, status: registrations.status })
        .from(registrations)
        .where(and(eq(registrations.eventId, eventId), eq(registrations.userId, userId)))
        .for('update')
        .limit(1)
      if (!registration) return { error: 'Registration not found.', httpStatus: 404 as const }
      if (registration.status === 'cancelled') return { cancelled: true }

      const [checkedIn] = await tx.select({ id: attendance.attendanceId })
        .from(attendance)
        .where(eq(attendance.registrationId, registration.id))
        .limit(1)
      if (checkedIn) return { error: 'A checked-in ticket cannot be cancelled.', httpStatus: 409 as const }

      await tx.update(registrations)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(registrations.registrationId, registration.id))

      if (registration.status === 'registered') {
        const [nextWaitlisted] = await tx.select({ id: registrations.registrationId })
          .from(registrations)
          .where(and(eq(registrations.eventId, eventId), eq(registrations.status, 'waitlisted')))
          .orderBy(asc(registrations.registeredAt), asc(registrations.registrationId))
          .for('update')
          .limit(1)

        if (nextWaitlisted) {
          await tx.update(registrations)
            .set({ status: 'registered', promotedAt: new Date() })
            .where(eq(registrations.registrationId, nextWaitlisted.id))
        }
      }

      return { cancelled: true }
    })

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.httpStatus })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to cancel this registration right now.' }, { status: 503 })
  }
}
