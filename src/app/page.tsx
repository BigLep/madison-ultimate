import SignupStatusTable from '@/components/SignupStatusTable'

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">
        Madison Ultimate App
      </h1>
      <div className="text-center text-gray-600 mb-8">
        <p>Signup tracking for Madison Middle School Ultimate Frisbee team</p>
      </div>
      
      <SignupStatusTable />
    </main>
  )
}