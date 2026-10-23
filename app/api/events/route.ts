import { and, count, eq, ilike, or, asc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { categories, events, registrations } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20
const MAX_PAGE = 1_000
const MAX_QUERY_LENGTH = 120

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isFinite(rawPage) ? Math.min(MAX_PAGE, Math.max(1, Math.floor(rawPage))) : 1
  const search = (searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH)
  const offset = (page - 1) * PAGE_SIZE

  try {
    const searchFilter = search
      ? or(ilike(events.title, `%${search}%`), ilike(events.description, `%${search}%`), ilike(categories.categoryName, `%${search}%`))
      : undefined

    const rows = await db
      .select({
        id: events.eventId,
        title: events.title,
        description: events.description,
        category: categories.categoryName,
        mode: events.eventMode,
        location: events.location,
        onlineUrl: events.onlineUrl,
        startTime: events.startTime,
        endTime: events.endTime,
        registrationDeadline: events.registrationDeadline,
        capacity: events.capacity,
        registered: count(registrations.registrationId),
      })
      .from(events)
      .innerJoin(categories, eq(events.categoryId, categories.categoryId))
      .leftJoin(registrations, and(
        eq(registrations.eventId, events.eventId),
        eq(registrations.status, 'registered'),
      ))
      .where(and(eq(events.status, 'approved'), searchFilter))
      .groupBy(events.eventId, categories.categoryId)
      .orderBy(asc(events.startTime), asc(events.eventId))
      .limit(PAGE_SIZE)
      .offset(offset)

    return NextResponse.json({ events: rows, page, pageSize: PAGE_SIZE }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'Unable to load events right now.' }, { status: 503 })
  }
}
