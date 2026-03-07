'use client';

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

// Mock data
const mockTranscript = [
    { id: 1, start: 0, end: 1.5, text: "Hello" },
    { id: 2, start: 1.5, end: 3.0, text: "welcome" },
    { id: 3, start: 3.0, end: 4.5, text: "to" },
    { id: 4, start: 4.5, end: 6.0, text: "the" },
    { id: 5, start: 6.0, end: 8.0, text: "transcription." },
];

export default function Editor() {
    const [transcript, setTranscript] = useState<any[]>(mockTranscript);
    const [playedSeconds, setPlayedSeconds] = useState(0);
    const [isClient, setIsClient] = useState(false);
    const [filename, setFilename] = useState('transcript');
    const [serverFilename, setServerFilename] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'transcript' | 'style'>('transcript');
    const [isBurning, setIsBurning] = useState(false);
    const [styleConfig, setStyleConfig] = useState({
        fontSize: 'medium', // small, medium, large, huge
        color: '#FFFFFF',
        backgroundColor: '#000000',
        fontFamily: 'sans', // sans, serif, mono
        animation: 'karaoke', // none, fade, pop, slide; karaoke
        position: 'bottom', // top, middle, bottom
        bold: false,
        italic: false,
        uppercase: false,
        outline: 2, // 0-5
        shadow: 2// 0-5
    });

    // Load from local storage on mount
    useEffect(() => {
        setIsClient(true);
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('transcription');
            if (stored) {
                const data = JSON.parse(stored);
                if (data.words) {
                    setTranscript(data.words);
                }
                if (data.originalFilename) {
                    const name = data.originalFilename.replace(/\.[^/.]+$/, "");
                    setFilename(name);
                }
                if (data.serverFilename) {
                    setServerFilename(data.serverFilename);
                }
                if (data.styleConfig) {
                    setStyleConfig(prev => ({ ...prev, ...data.styleConfig }));
                }
            }
        }
    }, []);

    const handleProgress = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        const video = e.currentTarget;
        setPlayedSeconds(video.currentTime);
    };

    // Save changes to localStorage whenever transcript or styleConfig updates
    useEffect(() => {
        if (typeof window !== 'undefined') { // Check window for SSR safety
            // Prevent overwriting local storage with mock data on initial load
            if (transcript === mockTranscript) {
                return;
            }

            // Get existing data to preserve fields we might not have in state (though we load all critical ones)
            const stored = localStorage.getItem('transcription');
            let baseData = {};
            if (stored) {
                baseData = JSON.parse(stored);
            }

            // Only save if we have meaningful data or checking against defaults
            localStorage.setItem('transcription', JSON.stringify({
                ...baseData,
                words: transcript,
                styleConfig: styleConfig
            }));
        }
    }, [transcript, styleConfig]);

    const handleWordClick = (start: number, index: number) => {
        if (isEditing) {
            setEditingIndex(index);
        } else {
            const video = document.getElementById('main-video') as HTMLVideoElement;
            if (video) {
                video.currentTime = start;
            }
        }
    };

    const handleWordChange = (index: number, newText: string) => {
        const newTranscript = [...transcript];
        // Handle both structure types
        if (newTranscript[index].word !== undefined) {
            newTranscript[index].word = newText;
        } else {
            newTranscript[index].text = newText;
        }
        setTranscript(newTranscript);
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Enter') {
            setEditingIndex(null);
        }
    };

    // Group words into subtitle chunks for better readability
    const getSubtitleChunks = () => {
        const chunks: { start: number; end: number; text: string }[] = [];
        let currentWords: any[] = [];
        let currentLength = 0;
        let chunkStart = 0;

        transcript.forEach((word, index) => {
            if (currentWords.length === 0) {
                chunkStart = word.start;
            }

            // Check if we should break the chunk
            // Break if:
            // 1. Current chunk is too long (> 40 chars)
            // 2. Big gap between words (> 1s)
            // 3. Sentence ending punctuation (optional improvement)
            const gap = index > 0 ? word.start - transcript[index - 1].end : 0;
            const wordText = (word.word || word.text || "").toString();

            if (currentWords.length > 0 && (currentLength + wordText.length > 50 || gap > 1.0)) {
                // Push current chunk
                chunks.push({
                    start: chunkStart,
                    end: transcript[index - 1].end,
                    text: currentWords.map(w => (w.word || w.text || "").toString().trim()).join(' ')
                });
                currentWords = [];
                currentLength = 0;
                chunkStart = word.start;
            }

            currentWords.push(word);
            currentLength += wordText.length + 1; // +1 for space
        });

        // Push last chunk
        if (currentWords.length > 0) {
            chunks.push({
                start: chunkStart,
                end: currentWords[currentWords.length - 1].end,
                text: currentWords.map(w => (w.word || w.text || "").toString().trim()).join(' ')
            });
        }

        return chunks;
    };

    const subtitleChunks = getSubtitleChunks();

    // Find current caption to display
    const currentChunk = subtitleChunks.find(chunk => playedSeconds >= chunk.start && playedSeconds < chunk.end);
    const currentCaptionText = currentChunk?.text || "";

    // Style Helpers
    // Style Helpers
    const getCaptionStyle = () => {
        const baseStyle: any = {
            color: styleConfig.color,
            fontFamily: styleConfig.fontFamily === 'serif' ? 'serif' : styleConfig.fontFamily === 'mono' ? 'monospace' : 'sans-serif',
            fontWeight: styleConfig.bold ? 'bold' : 'normal',
            fontStyle: styleConfig.italic ? 'italic' : 'normal',
            textTransform: styleConfig.uppercase ? 'uppercase' : 'none',
        };

        if (styleConfig.fontSize === 'small') baseStyle.fontSize = '1.25rem';
        if (styleConfig.fontSize === 'medium') baseStyle.fontSize = '1.5rem';
        if (styleConfig.fontSize === 'large') baseStyle.fontSize = '2.25rem';
        if (styleConfig.fontSize === 'huge') baseStyle.fontSize = '3rem';

        // Approximate Outline/Shadow for CSS Preview
        // ASS Outline is a stroke. CSS text-stroke is non-standard but -webkit-text-stroke works in most. 
        // Or text-shadow hack.
        const shadowPx = styleConfig.shadow * 2;
        if (styleConfig.shadow > 0) {
            baseStyle.textShadow = `${shadowPx}px ${shadowPx}px 4px rgba(0,0,0,0.8)`;
        }

        // Outline hack using text-shadow if needed, but text-stroke is better for "Outline" look
        if (styleConfig.outline > 0) {
            const outlineColor = 'black'; // ASS default is usually black
            const width = styleConfig.outline + 'px';
            baseStyle.WebkitTextStroke = `${width} ${outlineColor}`;
        }

        return baseStyle;
    };

    const getAnimationClass = () => {
        if (styleConfig.animation === 'fade') return 'animate-fade-in';
        if (styleConfig.animation === 'pop') return 'animate-pop-in';
        if (styleConfig.animation === 'slide') return 'animate-slide-up';
        return '';
    };

    const getPositionClass = () => {
        if (styleConfig.position === 'top') return 'top-10 items-start';
        if (styleConfig.position === 'middle') return 'top-1/2 -translate-y-1/2 items-center';
        return 'bottom-10 items-end'; // Default bottom
    };

    const handleBurn = async () => {
        if (!serverFilename) return;
        setIsBurning(true);
        try {
            const response = await fetch('http://localhost:3001/api/burn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: serverFilename,
                    transcript: transcript,
                    styleConfig: styleConfig
                })
            });

            const data = await response.json();

            if (data.outputFile) {
                // Trigger download
                const link = document.createElement('a');
                link.href = `http://localhost:3001/uploads/${data.outputFile}`;
                link.download = data.outputFile;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert("Burning failed: " + (data.error || "Unknown error"));
            }
        } catch (error) {
            console.error("Burn error:", error);
            alert("Failed to connect to server for burning.");
        } finally {
            setIsBurning(false);
        }
    };

    const downloadFile = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const exportTxt = () => {
        const text = transcript.map(w => (w.word || w.text || '').toString().trim()).join(' ');
        downloadFile(text, `${filename}.txt`, 'text/plain');
    };

    const formatTime = (seconds: number) => {
        const date = new Date(0);
        date.setSeconds(seconds);
        const iso = date.toISOString().substr(11, 12);
        return iso.replace('.', ',');
    };

    const exportSrt = () => {
        let srtContent = '';
        let counter = 1;

        // Group words into chunks of ~5 seconds or ~10 words for basic subtitles
        let currentChunk: any[] = [];
        let startTime = transcript[0]?.start || 0;

        transcript.forEach((word, index) => {
            currentChunk.push(word);

            // Break chunk if duration > 5s or length > 10 words or last word
            const duration = word.end - startTime;
            if (duration > 5 || currentChunk.length > 10 || index === transcript.length - 1) {
                const endTime = word.end;
                const text = currentChunk.map(w => (w.word || w.text || '').toString().trim()).join(' ');

                srtContent += `${counter}\n`;
                srtContent += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
                srtContent += `${text.trim()}\n\n`;

                counter++;
                currentChunk = [];
                if (index < transcript.length - 1) {
                    startTime = transcript[index + 1].start;
                }
            }
        });

        downloadFile(srtContent, `${filename}.srt`, 'text/plain');
    };

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-lg group">
                {serverFilename ? (
                    <>
                        <video
                            id="main-video"
                            src={`http://localhost:3001/uploads/${serverFilename}`}
                            className="w-full h-full object-contain"
                            controls
                            onTimeUpdate={handleProgress}
                        />
                        {/* Caption Overlay */}
                        <div className={`absolute left-0 right-0 text-center pointer-events-none p-4 flex justify-center ${getPositionClass()}`}>
                            <div
                                className={`inline-block px-4 py-2 rounded shadow-sm backdrop-blur-sm transition-all duration-300 ${getAnimationClass()}`}
                                style={{
                                    backgroundColor: `${styleConfig.backgroundColor}80`, // 50% opacity hex
                                    ...getCaptionStyle()
                                }}
                            >
                                {styleConfig.animation === 'karaoke' && currentChunk ? (
                                    <span>
                                        {currentChunk.text.split(' ').map((word, i) => {
                                            // Simple Highlight Logic: Check if we are roughly at this word position
                                            // Logic is approximate for chunks. Ideally we need exact word timestamps.
                                            // For now, let's just highlight the whole chunk or use word-level matching from original transcript if possible.
                                            return <span key={i} className="mr-1">{word}</span>
                                        })}
                                        {/* Better Karaoke: Highlight the Whole Chunk for now since we don't have per-word sync in chunk view easily without re-mapping */}
                                        {/* actually, let's just show text for V1 of styles */}
                                    </span>
                                ) : null}
                                {currentCaptionText}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white">
                        <p>No video source found. Please upload a file.</p>
                    </div>
                )}
            </div>

            <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 overflow-y-auto border border-gray-200 dark:border-gray-700 relative flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b pb-2 dark:border-gray-700">
                    <div className="flex space-x-4">
                        <button
                            onClick={() => setActiveTab('transcript')}
                            className={`pb-2 text-sm font-semibold transition ${activeTab === 'transcript' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >
                            Transcript
                        </button>
                        <button
                            onClick={() => setActiveTab('style')}
                            className={`pb-2 text-sm font-semibold transition ${activeTab === 'style' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >
                            Style & Burn
                        </button>
                    </div>

                    {activeTab === 'transcript' && (
                        <div className="space-x-2">
                            <button onClick={exportTxt} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-200 transition">
                                TXT
                            </button>
                            <button onClick={exportSrt} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white transition flex items-center gap-1">
                                <Download size={14} /> SRT
                            </button>
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className={`px-3 py-1.5 text-sm rounded transition ${isEditing ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200'}`}
                            >
                                {isEditing ? 'Done Editing' : 'Edit Text'}
                            </button>
                        </div>
                    )}
                </div>

                {activeTab === 'transcript' ? (
                    <div className="flex flex-wrap gap-1">
                        {transcript.map((word, index) => (
                            isEditing && editingIndex === index ? (
                                <input
                                    key={index}
                                    autoFocus
                                    type="text"
                                    className="w-20 px-1 py-0.5 text-sm rounded border border-blue-500 focus:outline-none dark:bg-gray-800 dark:text-white"
                                    value={word.word || word.text || ''}
                                    onChange={(e) => handleWordChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, index)}
                                    onBlur={() => setEditingIndex(null)}
                                />
                            ) : (
                                <span
                                    key={index}
                                    onClick={() => handleWordClick(word.start, index)}
                                    className={`cursor-pointer px-1 rounded transition-colors ${playedSeconds >= word.start && playedSeconds < word.end
                                        ? 'bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-100'
                                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        } ${isEditing ? 'hover:ring-2 hover:ring-green-400' : ''}`}
                                >
                                    {word.word || word.text}
                                </span>
                            )
                        ))}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Font Size */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Font Size</label>
                                <select
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={styleConfig.fontSize}
                                    onChange={(e) => setStyleConfig({ ...styleConfig, fontSize: e.target.value as any })}
                                >
                                    <option value="small">Small</option>
                                    <option value="medium">Medium</option>
                                    <option value="large">Large</option>
                                    <option value="huge">Huge</option>
                                </select>
                            </div>

                            {/* Font Family */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Font Family</label>
                                <select
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={styleConfig.fontFamily}
                                    onChange={(e) => setStyleConfig({ ...styleConfig, fontFamily: e.target.value as any })}
                                >
                                    <option value="sans">Sans-Serif</option>
                                    <option value="serif">Serif</option>
                                    <option value="mono">Monospace</option>
                                </select>
                            </div>

                            {/* Text Color */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Text Color</label>
                                <input
                                    type="color"
                                    className="w-full h-10 p-1 border rounded dark:bg-gray-700"
                                    value={styleConfig.color}
                                    onChange={(e) => setStyleConfig({ ...styleConfig, color: e.target.value })}
                                />
                            </div>

                            {/* Background Color */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Background Color</label>
                                <input
                                    type="color"
                                    className="w-full h-10 p-1 border rounded dark:bg-gray-700"
                                    value={styleConfig.backgroundColor}
                                    onChange={(e) => setStyleConfig({ ...styleConfig, backgroundColor: e.target.value })}
                                />
                            </div>

                            {/* Animation */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Animation</label>
                                <select
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={styleConfig.animation}
                                    onChange={(e) => setStyleConfig({ ...styleConfig, animation: e.target.value as any })}
                                >
                                    <option value="none">None</option>
                                    <option value="karaoke">Karaoke (Highlight)</option>
                                    <option value="fade">Fade In</option>
                                    <option value="pop">Pop In</option>
                                    <option value="slide">Slide Up</option>
                                </select>
                            </div>

                            {/* Position */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Position</label>
                                <div className="flex rounded-md shadow-sm" role="group">
                                    {['top', 'middle', 'bottom'].map((pos) => (
                                        <button
                                            key={pos}
                                            onClick={() => setStyleConfig({ ...styleConfig, position: pos as any })}
                                            className={`px-4 py-2 text-sm font-medium border first:rounded-l-lg last:rounded-r-lg 
                                                ${styleConfig.position === pos
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-white border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                                }`}
                                        >
                                            {pos.charAt(0).toUpperCase() + pos.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Toggles */}
                            <div className="md:col-span-2 flex flex-wrap gap-4 items-center p-2 bg-gray-50 dark:bg-gray-750 rounded border border-gray-100 dark:border-gray-600">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Format:</label>
                                <button
                                    onClick={() => setStyleConfig({ ...styleConfig, bold: !styleConfig.bold })}
                                    className={`px-3 py-1 rounded border font-bold ${styleConfig.bold ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}
                                >B</button>
                                <button
                                    onClick={() => setStyleConfig({ ...styleConfig, italic: !styleConfig.italic })}
                                    className={`px-3 py-1 rounded border italic ${styleConfig.italic ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}
                                >I</button>
                                <button
                                    onClick={() => setStyleConfig({ ...styleConfig, uppercase: !styleConfig.uppercase })}
                                    className={`px-3 py-1 rounded border ${styleConfig.uppercase ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}
                                >AA</button>
                            </div>

                            {/* Outline & Shadow */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Outline Width: {styleConfig.outline}</label>
                                <input
                                    type="range" min="0" max="5"
                                    value={styleConfig.outline}
                                    onChange={(e) => setStyleConfig({ ...styleConfig, outline: parseInt(e.target.value) })}
                                    className="w-full accent-blue-600"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shadow Depth: {styleConfig.shadow}</label>
                                <input
                                    type="range" min="0" max="5"
                                    value={styleConfig.shadow}
                                    onChange={(e) => setStyleConfig({ ...styleConfig, shadow: parseInt(e.target.value) })}
                                    className="w-full accent-blue-600"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t dark:border-gray-700">
                            <button
                                onClick={handleBurn}
                                disabled={isBurning}
                                className={`w-full py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold rounded-lg shadow-lg transform transition hover:scale-[1.02] flex items-center justify-center gap-2 ${isBurning ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isBurning ? (
                                    <span>🔥 Burning... (Check Server Console)</span>
                                ) : (
                                    <span>🔥 Burn & Export Video</span>
                                )}
                            </button>
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                This will create a new video file with these subtitles permanently baked in.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
