'use client';

import { useState } from 'react';
import axios from 'axios';
import { UploadCloud, FileAudio, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Upload() {
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [language, setLanguage] = useState('auto');
    const [prompt, setPrompt] = useState('');
    const [shouldTranslate, setShouldTranslate] = useState(false);
    const [model, setModel] = useState('base');
    const [progresses, setProgresses] = useState<{ [key: string]: number }>({});
    const [statuses, setStatuses] = useState<{ [key: string]: string }>({});
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(Array.from(e.target.files));
            setProgresses({});
            setStatuses({});
            setError(null);
        }
    };

    const handleLanguageChange = (value: string) => {
        setLanguage(value);

        // Auto-configure for preset mixed languages
        if (value === 'hinglish') {
            setPrompt('This is a conversation mixing English and Hindi words.');
            setShouldTranslate(false); // Keep original scripts
        } else if (value === 'mr-en') {
            setPrompt('This is a conversation mixing English and Marathi words.');
            setShouldTranslate(false); // Keep original scripts
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setUploading(true);
        setError(null);

        let actualLanguage = language;
        if (language === 'hinglish') actualLanguage = 'en';
        if (language === 'mr-en') actualLanguage = 'en';

        const completedTranscriptions = [];

        // Load existing transcriptions from local storage if they exist
        const existingData = localStorage.getItem('transcription_bulk');
        if (existingData) {
            try {
                completedTranscriptions.push(...JSON.parse(existingData));
            } catch (e) {
                console.error("Failed to parse existing bulk transcriptions");
            }
        }

        for (let i = 0; i < files.length; i++) {
            const currentFile = files[i];
            const fileId = currentFile.name; // Simple unique ID for status tracking

            try {
                // 1. Upload
                setStatuses(prev => ({ ...prev, [fileId]: 'Uploading...' }));
                const formData = new FormData();
                formData.append('file', currentFile);

                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                const response = await axios.post(`${API_URL}/api/upload`, formData, {
                    onUploadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            setProgresses(prev => ({ ...prev, [fileId]: percentCompleted }));
                        }
                    },
                });

                // 2. Transcribe
                setStatuses(prev => ({ ...prev, [fileId]: 'Transcribing (This may take a while)...' }));
                const transcribeResponse = await axios.post(`${API_URL}/api/transcribe`, {
                    filename: response.data.filename,
                    language: actualLanguage,
                    model: model,
                    prompt: prompt,
                    task: shouldTranslate ? 'translate' : 'transcribe'
                });

                setStatuses(prev => ({ ...prev, [fileId]: 'Completed' }));

                // Add to our completed list
                completedTranscriptions.push({
                    ...transcribeResponse.data,
                    originalFilename: currentFile.name,
                    serverFilename: response.data.filename
                });

            } catch (err) {
                console.error(`Error processing ${currentFile.name}:`, err);
                setStatuses(prev => ({ ...prev, [fileId]: 'Error' }));
            }
        }

        // Save all completed to new bulk storage key
        localStorage.setItem('transcription_bulk', JSON.stringify(completedTranscriptions));

        setUploading(false);
        // Do not redirect immediately to editor, router.push('/dashboard') or similar instead.
        // For now, we'll stay here and show completed statuses, but eventually move to a dashboard.
        router.push('/dashboard');
    };

    return (
        <div className="max-w-xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col items-center justify-center space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                    <UploadCloud className="w-10 h-10 text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Media</h2>
                <p className="text-gray-500 dark:text-gray-400 text-center">
                    Upload audio or video files to generate captions automatically.
                </p>

                <label className="w-full flex flex-col items-center px-4 py-6 bg-white dark:bg-gray-800 text-blue rounded-lg shadow-lg tracking-wide uppercase border border-blue cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 transition duration-200 ease-in-out group">
                    <span className="mt-2 text-base leading-normal group-hover:text-blue-600">Select files</span>
                    <input type='file' className="hidden" onChange={handleFileChange} accept="audio/*,video/*" multiple />
                </label>

                {files.length > 0 && (
                    <div className="w-full space-y-4">
                        <div className="space-y-2">
                            {files.map((f, i) => (
                                <div key={i} className="flex flex-col bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-lg overflow-hidden relative">
                                    <div className="flex items-center justify-between z-10">
                                        <div className="flex items-center space-x-3 truncate">
                                            <FileAudio className="w-5 h-5 text-gray-500" />
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{f.name}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs font-semibold text-blue-600">{statuses[f.name] || 'Pending'}</span>
                                            <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 text-sm font-medium ml-2" disabled={uploading}>Remove</button>
                                        </div>
                                    </div>
                                    {/* Progress Bar Background */}
                                    {(progresses[f.name] > 0 || statuses[f.name] === 'Completed') && (
                                        <div
                                            className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all duration-300"
                                            style={{ width: statuses[f.name] === 'Completed' ? '100%' : `${progresses[f.name] || 0}%` }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Language (Optional)
                            </label>
                            <select
                                value={language}
                                onChange={(e) => handleLanguageChange(e.target.value)}
                                className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white sm:text-sm"
                            >
                                <option value="auto">Auto Detect</option>
                                <option value="en">English</option>
                                <option value="hinglish">🔥 Hinglish (English + Hindi Mix)</option>
                                <option value="mr-en">🔥 Marathi + English Mix</option>
                                <option disabled>──────────</option>
                                <option value="hi">Hindi</option>
                                <option value="mr">Marathi</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="it">Italian</option>
                                <option value="pt">Portuguese</option>
                                <option value="nl">Dutch</option>
                                <option value="ja">Japanese</option>
                                <option value="zh">Chinese</option>
                                <option value="ru">Russian</option>
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Tip: Select <b>Hindi</b> or <b>Marathi</b> manually if "Auto Detect" confuses them with Urdu.
                            </p>
                        </div>

                        <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Context / Prompt (Optional)
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="E.g. 'This is a mix of English and Hindi words about coding.'"
                                className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white sm:text-sm resize-none h-20"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Describe the audio style or terminology to improve accuracy. Helpful for mixed languages (Hinglish).
                            </p>
                        </div>

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="translate-check"
                                checked={shouldTranslate}
                                onChange={(e) => setShouldTranslate(e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="translate-check" className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none cursor-pointer">
                                Translate to English (Convert all foreign words to English)
                            </label>
                        </div>

                        <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Model Size (Accuracy vs Speed)
                            </label>
                            <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white sm:text-sm"
                            >
                                <option value="tiny">Tiny (Fastest, Least Accurate)</option>
                                <option value="base">Base (Fast, Decent)</option>
                                <option value="small">Small (Balanced)</option>
                                <option value="medium">Medium (Slow, Accurate - Recommended for Marathi)</option>
                                <option value="large-v3">Large (Slowest, Best Accuracy)</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Global loading state removed in favor of per-file progress inside the card above */}

                {error && (
                    <div className="flex items-center space-x-2 text-red-500">
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                    </div>
                )}

                <button
                    onClick={handleUpload}
                    disabled={files.length === 0 || uploading}
                    className={`w-full py-3 px-6 rounded-lg text-white font-medium transition-colors ${files.length === 0 || uploading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 shadow-md transform active:scale-95'
                        }`}
                >
                    {uploading ? 'Processing...' : 'Start Bulk Transcription'}
                </button>
            </div>
        </div>
    );
}
