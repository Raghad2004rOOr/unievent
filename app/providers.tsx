'use client'

import { ThemeProvider } from 'next-themes'
import { LanguageProvider } from '@/components/language-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>{children}</LanguageProvider>
    </ThemeProvider>
  )
}

export { useLanguage } from '@/components/language-provider'
