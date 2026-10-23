import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { roles, users } from '@/lib/db/schema'

export type UserRole = 'student' | 'organizer' | 'admin'

export async function getUserProfile(userId: string) {
  const [profile] = await db
    .select({ role: users.userType })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1)

  if (!profile || !['student', 'organizer', 'admin'].includes(profile.role)) return null
  return { role: profile.role as UserRole }
}

export async function createStudentProfile(userId: string) {
  const existing = await getUserProfile(userId)
  if (existing) return existing

  const [studentRole] = await db
    .select({ roleId: roles.roleId })
    .from(roles)
    .where(eq(roles.roleName, 'student'))
    .limit(1)

  if (!studentRole) return null

  await db.insert(users).values({
    userId,
    roleId: studentRole.roleId,
    userType: 'student',
  }).onConflictDoNothing()

  return getUserProfile(userId)
}
