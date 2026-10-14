import { generateText } from 'ai'
import { NextResponse } from 'next/server'

const MODEL = 'google/gemini-3.8-flash'
const MAX_INPUT_LENGTH = 1400

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { kind, text, language } = body as Record<string, unknown>
  if ((kind !== 'chat' && kind !== 'description') || typeof text !== 'string' || !text.trim() || text.length > MAX_INPUT_LENGTH) {
    return NextResponse.json({ error: 'Please provide a valid request.' }, { status: 400 })
  }
  if (language !== 'ar' && language !== 'en') {
    return NextResponse.json({ error: 'Unsupported language.' }, { status: 400 })
  }

  const isArabic = language === 'ar'
  const instructions = kind === 'description'
    ? 'Create polished, concise bilingual event descriptions for a university event management platform. Respond in Arabic first, then English, with clear headings. Do not invent a time, location, speaker, or claims not present in the input. Keep each language description to 2-3 sentences.'
    : 'You are UniEvent, a helpful assistant for Al Noor University campus events. Only use the example events provided below. If a question asks for information not provided, say that the student should check the event details page. Never claim to have live registration or personal student records.'
  const prompt = kind === 'description'
    ? `Write the bilingual event description for this organizer-provided event information:\n${text}`
    : `${isArabic ? 'Reply in Arabic.' : 'Reply in English.'}\nUniversity event examples: Innovation & Entrepreneurship Forum on Oct 23 at the Innovation Center; Campus Movie Night on Oct 24 at North Plaza; UX Design Workshop on Oct 26 at Computer Science Lab 3; Inter-University Basketball on Oct 27 at the Sports Arena.\nStudent question: ${text}`

  try {
    const { text: output } = await generateText({
      model: MODEL,
      instructions,
      prompt,
      maxOutputTokens: kind === 'description' ? 320 : 240,
    })
    return NextResponse.json({ text: output })
  } catch (error) {
    const message = `${error instanceof Error ? error.message : ''} ${error instanceof Error && error.cause instanceof Error ? error.cause.message : ''}`.toLowerCase()
    if (message.includes('valid credit card') || message.includes('customer_verification_required')) {
      return NextResponse.json({
        error: isArabic
          ? 'تحتاج ميزات الذكاء الاصطناعي إلى تفعيل فوترة Vercel AI Gateway. أضيفي وسيلة دفع ثم حاولي مجدداً.'
          : 'AI features require Vercel AI Gateway billing to be enabled. Add a payment method and try again.',
      }, { status: 503 })
    }
    return NextResponse.json({ error: isArabic ? 'المساعد الذكي غير متاح مؤقتاً. حاولي لاحقاً.' : 'The AI assistant is temporarily unavailable. Please try again.' }, { status: 503 })
  }
}
