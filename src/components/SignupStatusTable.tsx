'use client'

import { useState, useEffect } from 'react'
import { PlayerSignupStatus } from '@/lib/types'
import { obfuscatePlayerName } from '@/lib/privacy'

interface SignupStatusTableProps {
  searchTerm?: string
}

interface PlayersApiResponse {
  players: PlayerSignupStatus[]
  statistics: {
    totalPlayers: number
    caretakerSignedFinalForms: number
    playerSignedFinalForms: number
    playerClearedPhysical: number
    caretakerFilledQuestionnaire: number
    caretaker1JoinedMailingList: number
    caretaker2JoinedMailingList: number
  }
  lastUpdated: string
}

export default function SignupStatusTable({ searchTerm = '' }: SignupStatusTableProps) {
  const [data, setData] = useState<PlayersApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const response = await fetch('/api/players')
        
        if (!response.ok) {
          throw new Error('Failed to fetch player data')
        }
        
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Filter players based on search term (search against full names but display obfuscated)
  const filteredPlayers = data?.players.filter(player => {
    const fullName = `${player.firstName} ${player.lastName}`;
    const obfuscatedName = obfuscatePlayerName(player.firstName, player.lastName);
    return fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           obfuscatedName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           player.grade.includes(searchTerm) ||
           player.gender.toLowerCase().includes(searchTerm.toLowerCase());
  }) || []

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading player data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading data: {error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const StatusBadge = ({ status, label }: { status: boolean; label: string }) => (
    <div className="flex items-center justify-center">
      <span className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        ${status 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
        }
      `}>
        {status ? '✓' : '✗'}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Statistics Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">Signup Progress Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{data.statistics.totalPlayers}</div>
            <div className="text-gray-600">Total Players</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{data.statistics.caretakerSignedFinalForms}</div>
            <div className="text-gray-600">Parent Signed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{data.statistics.playerSignedFinalForms}</div>
            <div className="text-gray-600">Student Signed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{data.statistics.playerClearedPhysical}</div>
            <div className="text-gray-600">Physical Cleared</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{data.statistics.caretakerFilledQuestionnaire}</div>
            <div className="text-gray-600">Questionnaire</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{data.statistics.caretaker1JoinedMailingList}</div>
            <div className="text-gray-600">Mailing List</div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Last updated: {new Date(data.lastUpdated).toLocaleString()}
        </p>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            {/* Top header row for grouping */}
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-r border-gray-300" rowSpan={2}>
                Player Name
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-r border-gray-300" rowSpan={2}>
                Grade
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-r border-gray-300" rowSpan={2}>
                Gender
              </th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-r border-gray-300" colSpan={3}>
                <a 
                  href="https://docs.google.com/document/d/1A2F7ThHtcMm23bxk8-30rMT2svaqT3gMbRWeSR_QXXY/edit?tab=t.rmrdcntgom85#bookmark=id.xa6bxpq5mxh1" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  SPS Final Forms ↗
                </a>
              </th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-r border-gray-300" rowSpan={2}>
                Coach Questionnaire
              </th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300" rowSpan={2}>
                Team Mailing List
              </th>
            </tr>
            {/* Bottom header row with SPS Final Forms specific columns */}
            <tr>
              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                Parent Signed
              </th>
              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                Student Signed
              </th>
              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                Physical
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredPlayers.map((player, index) => (
              <tr key={`${player.firstName}-${player.lastName}-${index}`} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">
                    {obfuscatePlayerName(player.firstName, player.lastName)}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {player.grade}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {player.gender}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <StatusBadge 
                    status={player.hasCaretakerSignedFinalForms} 
                    label="Parent signed final forms"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <StatusBadge 
                    status={player.hasPlayerSignedFinalForms} 
                    label="Student signed final forms"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <StatusBadge 
                    status={player.hasPlayerClearedPhysical} 
                    label="Physical cleared"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <StatusBadge 
                    status={player.hasCaretakerFilledQuestionnaire} 
                    label="Questionnaire filled"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex space-x-1 justify-center">
                    <StatusBadge 
                      status={player.hasCaretaker1JoinedMailingList} 
                      label="Parent 1 on mailing list"
                    />
                    <StatusBadge 
                      status={player.hasCaretaker2JoinedMailingList} 
                      label="Parent 2 on mailing list"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {filteredPlayers.map((player, index) => (
          <div key={`${player.firstName}-${player.lastName}-${index}`} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-medium text-gray-900">
                  {obfuscatePlayerName(player.firstName, player.lastName)}
                </h3>
                <p className="text-sm text-gray-500">
                  Grade {player.grade} • {player.gender}
                </p>
              </div>
            </div>
            
            <div className="space-y-3 text-sm">
              {/* SPS Final Forms Section */}
              <div>
                <h4 className="font-medium text-gray-700 text-xs uppercase tracking-wider mb-2">SPS Final Forms</h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex justify-between">
                    <span>Parent Signed:</span>
                    <StatusBadge status={player.hasCaretakerSignedFinalForms} label="Parent signed" />
                  </div>
                  <div className="flex justify-between">
                    <span>Student Signed:</span>
                    <StatusBadge status={player.hasPlayerSignedFinalForms} label="Student signed" />
                  </div>
                  <div className="flex justify-between">
                    <span>Physical Cleared:</span>
                    <StatusBadge status={player.hasPlayerClearedPhysical} label="Physical cleared" />
                  </div>
                </div>
              </div>
              
              {/* Other Requirements Section */}
              <div>
                <h4 className="font-medium text-gray-700 text-xs uppercase tracking-wider mb-2">Other Requirements</h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex justify-between">
                    <span>Coach Questionnaire:</span>
                    <StatusBadge status={player.hasCaretakerFilledQuestionnaire} label="Questionnaire" />
                  </div>
                  <div className="flex justify-between">
                    <span>Team Mailing List:</span>
                    <div className="flex space-x-1">
                      <StatusBadge status={player.hasCaretaker1JoinedMailingList} label="Parent 1" />
                      <StatusBadge status={player.hasCaretaker2JoinedMailingList} label="Parent 2" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* No results message */}
      {filteredPlayers.length === 0 && searchTerm && (
        <div className="text-center py-8 text-gray-500">
          No players found matching "{searchTerm}"
        </div>
      )}
    </div>
  )
}