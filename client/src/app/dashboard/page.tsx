'use client';

import Link from 'next/link';
import { FileText, ArrowRight, Play, LayoutDashboard } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Dashboard() {
    const [transcriptions, setTranscriptions] = useState<any[]>([]);

    useEffect(() => {
        // Load bulk transcriptions
        const existingData = localStorage.getItem('transcription_bulk');
        if (existingData) {
            try {
                setTranscriptions(JSON.parse(existingData));
            } catch (e) {
                console.error("Failed to parse bulk transcriptions");
            }
        }
    }, []);

    const formatDuration = (seconds: number) => {
        if (!seconds) return "Unknown";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return [h, m > 9 ? m : h ? '0' + m : m || '0', s > 9 ? s : '0' + s].filter(Boolean).join(':');
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex items-center space-x-3 mb-8">
                <LayoutDashboard className="w-8 h-8 text-blue-600" />
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                    Your Transcriptions
                </h1>
            </div>

            {transcriptions.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center border border-gray-200 dark:border-gray-700">
                    <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No transcriptions yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">Upload some files from the home page to get started.</p>
                    <Link href="/" className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                        Go to Upload
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {transcriptions.map((t, i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                            <div className="p-5 flex-1 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                        <Play className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                        Completed
                                    </span>
                                </div>

                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate" title={t.originalFilename}>
                                        {t.originalFilename}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex justify-between">
                                        <span>Language: {t.language || 'Auto'}</span>
                                        <span>{formatDuration(t.duration)}</span>
                                    </p>
                                </div>

                                <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 italic opacity-80">
                                    &quot;{t.text}&quot;
                                </div>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-750 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
                                <Link
                                    href={`/editor?id=${i}`}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 flex items-center justify-between"
                                >
                                    Open Editor
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
