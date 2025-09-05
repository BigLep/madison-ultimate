'use client'

import { useState, useEffect } from 'react'

interface DebugData {
  unmatchedEmails: {
    email: string
    nickname: string
    status: string
  }[]
  matchedEmails: {
    email: string
    playerName: string
    parentType: string
  }[]
  totalMailingListEmails: number
  totalPlayerEmails: number
}

export default function DebugPage() {
  const [data, setData] = useState<DebugData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDebugData() {
      try {
        const response = await fetch('/api/debug')
        if (!response.ok) {
          throw new Error('Failed to fetch debug data')
        }
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchDebugData()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Debug Information</h1>
        <div>Loading debug data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Debug Information</h1>
        <div className="text-red-600">Error: {error}</div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Debug Information</h1>
      
      {/* Summary Stats */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Email Matching Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xl font-bold text-blue-600">{data.totalMailingListEmails}</div>
            <div className="text-gray-600">Total Mailing List</div>
          </div>
          <div>
            <div className="text-xl font-bold text-green-600">{data.matchedEmails.length}</div>
            <div className="text-gray-600">Matched Emails</div>
          </div>
          <div>
            <div className="text-xl font-bold text-red-600">{data.unmatchedEmails.length}</div>
            <div className="text-gray-600">Unmatched Emails</div>
          </div>
          <div>
            <div className="text-xl font-bold text-gray-600">{data.totalPlayerEmails}</div>
            <div className="text-gray-600">Parent Emails in Final Forms</div>
          </div>
        </div>
      </div>

      {/* Unmatched Emails */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">
          Emails on Mailing List NOT matching any player families ({data.unmatchedEmails.length})
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nickname
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.unmatchedEmails.map((email, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    {email.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {email.nickname}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      email.status === 'member' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {email.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Matched Emails */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Successfully Matched Emails ({data.matchedEmails.length})
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parent Type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.matchedEmails.map((match, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    {match.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {match.playerName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {match.parentType}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}