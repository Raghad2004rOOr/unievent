'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Eye, EyeOff, GraduationCap, Languages, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { authClient } from '@/lib/auth/client'

type AuthMode = 'sign-in' | 'sign-up'

const labels = {
  ar: {
    brand: 'UniEvent',
    eyebrow: 'مجتمعك الجامعي، في مكان واحد',
    signIn: 'مرحباً بعودتك',
    signUp: 'انضمي إلى مجتمع الجامعة',
    signInHint: 'سجّلي الدخول لمتابعة فعالياتك وتذاكرك.',
    signUpHint: 'أنشئي حساباً طالبياً واحجزي مقعدك في الفعاليات.',
    name: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    namePlaceholder: 'اسمك كما تحبين أن يظهر',
    emailPlaceholder: 'name@university.edu',
    passwordPlaceholder: '٨ أحرف على الأقل',
    submitIn: 'تسجيل الدخول',
    submitUp: 'إنشاء حساب طالبة',
    pendingIn: 'جارٍ تسجيل الدخول…',
    pendingUp: 'جارٍ إنشاء الحساب…',
    switchIn: 'لديك حساب بالفعل؟',
    switchUp: 'جديدة على UniEvent؟',
    linkIn: 'تسجيل الدخول',
    linkUp: 'إنشاء حساب',
    back: 'العودة إلى استكشاف الفعاليات',
    genericError: 'تعذر إكمال الطلب. تحققي من بياناتك وحاولي مرة أخرى.',
    setupError: 'تعذر إعداد حسابك كطالبة. تحققي من إعدادات الأدوار أو حاولي لاحقاً.',
    verify: 'تم إنشاء الحساب. تحققي من بريدك الإلكتروني، ثم سجّلي الدخول.',
    role: 'حساب طالبة',
    secure: 'دخول آمن عبر Neon Auth',
    minPassword: 'يجب أن تتكون كلمة المرور من ٨ أحرف على الأقل.',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
  },
  en: {
    brand: 'UniEvent',
    eyebrow: 'Your campus community, all in one place',
    signIn: 'Welcome back',
    signUp: 'Join your campus community',
    signInHint: 'Sign in to manage your events and tickets.',
    signUpHint: 'Create a student account and reserve your next seat.',
    name: 'Full name',
    email: 'University email',
    password: 'Password',
    namePlaceholder: 'How should we address you?',
    emailPlaceholder: 'name@university.edu',
    passwordPlaceholder: 'At least 8 characters',
    submitIn: 'Sign in',
    submitUp: 'Create student account',
    pendingIn: 'Signing in…',
    pendingUp: 'Creating account…',
    switchIn: 'Already have an account?',
    switchUp: 'New to UniEvent?',
    linkIn: 'Sign in',
    linkUp: 'Create account',
    back: 'Back to event discovery',
    genericError: 'We could not complete that request. Check your details and try again.',
    setupError: 'We could not set up your student profile. Check role configuration or try again later.',
    verify: 'Your account was created. Check your email, then sign in.',
    role: 'Student account',
    secure: 'Secure sign-in powered by Neon Auth',
    minPassword: 'Password must be at least 8 characters.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  },
} as const

export function AuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const [locale, setLocale] = useState<'ar' | 'en'>('ar')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const ar = locale === 'ar'
  const t = labels[locale]
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setMessage(null)

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('name') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')

    if (isSignUp && password.length < 8) {
      setMessage({ kind: 'error', text: t.minPassword })
      setPending(false)
      return
    }

    try {
      const result = isSignUp
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password })

      if (result.error) {
        setMessage({ kind: 'error', text: result.error.message || t.genericError })
        return
      }

      const profileResponse = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provisionStudent: true }),
      })

      if (profileResponse.status === 401) {
        setMessage({ kind: 'success', text: t.verify })
        return
      }

      if (!profileResponse.ok) {
        setMessage({ kind: 'error', text: t.setupError })
        return
      }

      router.replace('/')
      router.refresh()
    } catch {
      setMessage({ kind: 'error', text: t.genericError })
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="auth-page" dir={ar ? 'rtl' : 'ltr'}>
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-topline">
          <Link className="auth-brand" href="/" aria-label={t.brand}>
            <span className="auth-brand-mark"><GraduationCap /></span>
            <span>{t.brand}</span>
          </Link>
          <button className="auth-language" type="button" onClick={() => setLocale(ar ? 'en' : 'ar')} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}>
            <Languages />{ar ? 'EN' : 'عربي'}
          </button>
        </div>

        <div className="auth-heading">
          <span className="auth-kicker"><CalendarDays />{t.eyebrow}</span>
          <h1 id="auth-title">{isSignUp ? t.signUp : t.signIn}</h1>
          <p>{isSignUp ? t.signUpHint : t.signInHint}</p>
          <span className="auth-role"><UserRound />{t.role}</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp && (
            <label className="auth-field">
              <span>{t.name}</span>
              <span className="auth-input-wrap"><UserRound /><input name="name" type="text" autoComplete="name" maxLength={100} placeholder={t.namePlaceholder} required /></span>
            </label>
          )}
          <label className="auth-field">
            <span>{t.email}</span>
            <span className="auth-input-wrap"><Mail /><input name="email" type="email" autoComplete="email" maxLength={254} placeholder={t.emailPlaceholder} required /></span>
          </label>
          <label className="auth-field">
            <span>{t.password}</span>
            <span className="auth-input-wrap"><LockKeyhole /><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={8} maxLength={128} placeholder={t.passwordPlaceholder} required /><button className="auth-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t.hidePassword : t.showPassword}>{showPassword ? <EyeOff /> : <Eye />}</button></span>
          </label>

          {message && <p className={`auth-message auth-message-${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}

          <button className="auth-submit" type="submit" disabled={pending}>
            {pending ? (isSignUp ? t.pendingUp : t.pendingIn) : (isSignUp ? t.submitUp : t.submitIn)}
            {ar ? <ArrowLeft /> : <ArrowRight />}
          </button>
        </form>

        <p className="auth-switch">
          {isSignUp ? t.switchIn : t.switchUp}{' '}
          <Link href={isSignUp ? '/auth/sign-in' : '/auth/sign-up'}>{isSignUp ? t.linkIn : t.linkUp}</Link>
        </p>
        <Link className="auth-back" href="/">{ar ? <ArrowRight /> : <ArrowLeft />}{t.back}</Link>
        <p className="auth-security"><LockKeyhole />{t.secure}</p>
      </section>
    </main>
  )
}
