import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'
import { Mic2, LayoutDashboard, Upload } from 'lucide-react'
import { ToastProvider } from '@/components/Toast'
import ThemeToggle from '@/components/ThemeToggle'

export const metadata: Metadata = {
    title: 'Captionly — AI Video Transcription',
    description: 'Upload videos, generate accurate captions, style and export in seconds.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;600;700&family=Space+Mono:wght@400;700&family=Oswald:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                <ToastProvider>
                    <header className="fixed top-0 left-0 right-0 z-50 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(8,8,16,0.85)', backdropFilter: 'blur(12px)' }}>
                        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}>
                                    <Mic2 size={16} className="text-white" />
                                </div>
                                <span className="gradient-text">Captionly</span>
                            </Link>
                            <nav className="flex items-center gap-2">
                                <Link href="/" className="btn-ghost flex items-center gap-2 py-2 px-3 text-sm">
                                    <Upload size={15} /> Upload
                                </Link>
                                <Link href="/dashboard" className="btn-ghost flex items-center gap-2 py-2 px-3 text-sm">
                                    <LayoutDashboard size={15} /> Dashboard
                                </Link>
                                <ThemeToggle />
                            </nav>
                        </div>
                    </header>
                    <div className="pt-16">
                        {children}
                    </div>
                </ToastProvider>
            </body>
        </html>
    )
}
