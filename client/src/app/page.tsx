import Upload from '@/components/Upload';

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-gray-50 dark:bg-gray-900">
            <div className="z-10 max-w-5xl w-full items-center justify-between text-sm lg:flex flex-col space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
                        AI Transcription <span className="text-blue-600">Made Easy</span>
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        Upload your audio or video file and let our AI generate accurate captions in minutes. Edit, export, and share.
                    </p>
                </div>
                <Upload />
            </div>
        </main>
    );
}
