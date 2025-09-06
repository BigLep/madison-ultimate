export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Coming Soon
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Something exciting is in the works!
          </p>
          <a 
            href="https://bit.ly/MadisonUltimate2025Fall" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Learn More About Madison Ultimate
          </a>
        </div>
      </div>
    </main>
  )
}