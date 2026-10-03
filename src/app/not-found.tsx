import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-black">
      <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 text-center max-w-md">
        <h2 className="text-6xl font-bold mb-4">404</h2>
        <p className="text-gray-400 mb-6">Page not found</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition-colors"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
