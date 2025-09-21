export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            Madison Ultimate Portal
          </h1>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/player-portal"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Current Players Login
            </a>
            <a
              href="https://bit.ly/MadisonUltimate2025Fall"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors"
            >
              Learn More About Madison Ultimate
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}