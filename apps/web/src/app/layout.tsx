import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BoardGame Navigator',
  description: '보드게임 룰을 검색하고 세팅 가이드를 확인하세요',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="sticky top-0 z-20 border-b bg-white px-4 py-3 flex items-center gap-3">
          <a href="/" className="text-lg font-bold text-indigo-600 shrink-0">🎲 BoardGame</a>
          <div className="flex-1" />
          <a href="/submit"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 shrink-0">
            룰북 등록
          </a>
        </header>
        <main className="mx-auto max-w-2xl px-4 pt-4 pb-6">{children}</main>
      </body>
    </html>
  )
}
