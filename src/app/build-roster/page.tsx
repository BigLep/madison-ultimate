'use client';

import { useState } from 'react';
import type { RosterSynthesisResult } from '@/lib/roster-synthesizer';

export default function BuildRosterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RosterSynthesisResult | null>(null);
  const [error, setError] = useState<string>('');

  const handleSynthesizeRoster = async () => {
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/roster/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to synthesize roster');
      }

      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Build/Update Team Roster
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              This tool will update the team roster Google Sheet based on the latest data from:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>SPS Final Forms (most recent export)</li>
              <li>Additional Questionnaire responses</li>
              <li>Team Mailing List (most recent export)</li>
            </ul>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Warning:</strong> This will modify the live roster Google Sheet. 
                    Make sure you have a backup or are confident in the changes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mb-8">
            <button
              onClick={handleSynthesizeRoster}
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                'Build/Update Roster'
              )}
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Roster Updated Successfully!</h3>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-900">{result.newPlayersAdded}</div>
                  <div className="text-sm text-blue-600">New Players Added</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-900">{result.existingPlayersUpdated}</div>
                  <div className="text-sm text-orange-600">Players Updated</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-900">{result.orphanedPlayers.length}</div>
                  <div className="text-sm text-red-600">Orphaned Players</div>
                </div>
              </div>

              {result.orphanedPlayers.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">
                    Players on roster but not found in Final Forms:
                  </h4>
                  <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                    {result.orphanedPlayers.map((playerName, index) => (
                      <li key={index}>{playerName}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-yellow-600 mt-2">
                    These players were not removed from the roster. Review manually if needed.
                  </p>
                </div>
              )}

              <div className="border border-gray-200 rounded-md">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h4 className="text-lg font-medium text-gray-900">Change Log</h4>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {result.changes.map((change, index) => (
                    <div key={index} className="px-4 py-3 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{change.playerName}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          change.action === 'added' ? 'bg-green-100 text-green-800' :
                          change.action === 'updated' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {change.action}
                        </span>
                      </div>
                      
                      {change.reason && (
                        <p className="text-sm text-gray-600 mb-2">{change.reason}</p>
                      )}
                      
                      {change.changes && Object.keys(change.changes).length > 0 && (
                        <div className="text-sm space-y-1">
                          {Object.entries(change.changes).map(([field, values]) => (
                            <div key={field} className="text-gray-600">
                              <span className="font-medium">{field}:</span>
                              <span className="text-red-600 line-through ml-1">{values.old || '(empty)'}</span>
                              <span className="mx-1">→</span>
                              <span className="text-green-600">{values.new || '(empty)'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-md p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Source Files Used:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• SPS Final Forms: {result.sourceFileInfo.spsFormsFile}</li>
                  <li>• Team Mailing List: {result.sourceFileInfo.mailingListFile}</li>
                  <li>• Questionnaire: Sheet ID {result.sourceFileInfo.questionnaireSheetId}</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}