'use client';

export const dynamic = 'force-dynamic';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md">
            <h1 className="text-6xl font-bold text-gray-900 mb-4">Error</h1>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-8">
              A global error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
