import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BoardGame Navigator',
  description: '보드게임 룰을 질문하세요',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b bg-white px-6 py-4 flex items-center">
          <a href="/" className="text-xl font-bold text-indigo-600">BoardGame Navigator</a>
          <a href="/submit" className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            + 룰북 등록 신청
          </a>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
