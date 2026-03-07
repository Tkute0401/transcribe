import Editor from '@/components/Editor';

export default function EditorPage() {
    return (
        <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50 dark:bg-gray-900">
            <div className="w-full max-w-6xl">
                <div className="mb-8 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Editor</h1>
                </div>
                <Editor />
            </div>
        </main>
    );
}
