'use client';

import { useState } from 'react';
import axios from 'axios';
import { UploadCloud, FileAudio, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Upload() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [language, setLanguage] = useState('auto');
    const [prompt, setPrompt] = useState('');
    const [shouldTranslate, setShouldTranslate] = useState(false);
    const [model, setModel] = useState('base');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
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
        if (!file) return;

        setUploading(true);
        setProgress(0);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post('http://localhost:3001/api/upload', formData, {
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setProgress(percentCompleted);
                    }
                },
            });

            console.log('Upload success:', response.data);

            // Start real transcription
            // Map special language codes to actual Whisper language codes
            let actualLanguage = language;
            if (language === 'hinglish') actualLanguage = 'en';
            if (language === 'mr-en') actualLanguage = 'en';

            const transcribeResponse = await axios.post('http://localhost:3001/api/transcribe', {
                filename: response.data.filename,
                language: actualLanguage,
                model: model,
                prompt: prompt,
                task: shouldTranslate ? 'translate' : 'transcribe'
            });

            console.log('Transcription success:', transcribeResponse.data);

            // Store transcription data in localStorage or context (simple MVP approach)
            localStorage.setItem('transcription', JSON.stringify({
                ...transcribeResponse.data,
                originalFilename: file.name,
                serverFilename: response.data.filename
            }));

            // Redirect to editor
            router.push('/editor');

        } catch (err) {
            console.error(err);
            setError('Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
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
                    <span className="mt-2 text-base leading-normal group-hover:text-blue-600">Select a file</span>
                    <input type='file' className="hidden" onChange={handleFileChange} accept="audio/*,video/*" />
                </label>

                {file && (
                    <div className="w-full space-y-4">
                        <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-lg">
                            <div className="flex items-center space-x-3 truncate">
                                <FileAudio className="w-5 h-5 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{file.name}</span>
                            </div>
                            <button onClick={() => setFile(null)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>
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

                {uploading && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-4">
                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                )}

                {error && (
                    <div className="flex items-center space-x-2 text-red-500">
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                    </div>
                )}

                <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className={`w-full py-3 px-6 rounded-lg text-white font-medium transition-colors ${!file || uploading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 shadow-md transform active:scale-95'
                        }`}
                >
                    {uploading ? 'Uploading...' : 'Start Transcription'}
                </button>
            </div>
        </div>
    );
}
