import { and, eq, inArray } from 'drizzle-orm'
import { UniEventApp } from '@/components/unievent/unievent-app'
import { auth } from '@/lib/auth/server'
import { getUserProfile, type UserRole } from '@/lib/auth/profile'
import { db } from '@/lib/db'
import { registrations } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export default async function Page() {
  let user: { id: string; name: string; email: string } | null = null
  let role: UserRole | null = null
  let registeredEventIds: number[] = []

  try {
    const { data } = await auth.getSession()
    if (data?.user) {
      user = {
        id: data.user.id,
        name: data.user.name || data.user.email,
        email: data.user.email,
      }
      const profile = await getUserProfile(data.user.id)
      role = profile?.role ?? null
      if (profile) {
        const rows = await db
          .select({ eventId: registrations.eventId })
          .from(registrations)
          .where(and(
            eq(registrations.userId, data.user.id),
            inArray(registrations.status, ['registered', 'waitlisted']),
          ))
        registeredEventIds = rows.map((row) => row.eventId)
      }
    }
  } catch {
    user = null
    role = null
    registeredEventIds = []
  }

  return <UniEventApp initialUser={user} initialRole={role} initialRegistered={registeredEventIds} />
}
