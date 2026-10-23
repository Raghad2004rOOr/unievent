import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/server'
import { createStudentProfile, getUserProfile } from '@/lib/auth/profile'

export const dynamic = 'force-dynamic'

async function getAuthenticatedUser() {
  const { data } = await auth.getSession()
  return data?.user ?? null
}

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  try {
    const profile = await getUserProfile(user.id)
    if (!profile) return NextResponse.json({ error: 'Account profile is not configured.' }, { status: 404 })
    return NextResponse.json(profile, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to load the account profile.' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site')
  const origin = request.headers.get('origin')
  const sameOrigin = fetchSite
    ? fetchSite === 'same-origin'
    : !!origin && origin === new URL(request.url).origin
  if (!sameOrigin) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })

  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || !('provisionStudent' in body) || body.provisionStudent !== true) {
      return NextResponse.json({ error: 'Invalid profile request.' }, { status: 400 })
    }

    const profile = await createStudentProfile(user.id)
    if (!profile) {
      return NextResponse.json({ error: 'The student role has not been configured yet.' }, { status: 503 })
    }

    return NextResponse.json(profile, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to create the account profile.' }, { status: 503 })
  }
}
