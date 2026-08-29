interface AvailabilitySummaryProps {
  title: string;
  upcomingItems: Array<{ availability: { availability: string }, isBye?: boolean }>;
  pastItems: Array<{ availability: { availability: string }, isBye?: boolean }>;
  availabilityOptions: Record<string, string>;
  allUpcomingResponded: boolean;
  pastPresentValue?: string;
  pastAbsentValue?: string;
}

export function AvailabilitySummary({
  title,
  upcomingItems,
  pastItems,
  availabilityOptions,
  allUpcomingResponded,
  pastPresentValue = 'Was there',
  pastAbsentValue = "Wasn't there"
}: AvailabilitySummaryProps) {
  // Filter out byes for statistics calculations
  const upcomingItemsForStats = upcomingItems.filter(item => !item.isBye);
  const pastItemsForStats = pastItems.filter(item => !item.isBye);

  // Calculate summary stats (excluding byes)
  const upcomingNoResponse = upcomingItemsForStats.filter(item => !item.availability.availability).length;
  const upcomingPlanToMake = upcomingItemsForStats.filter(item => item.availability.availability === availabilityOptions.PLANNING).length;
  const upcomingCantMake = upcomingItemsForStats.filter(item => item.availability.availability === availabilityOptions.CANT_MAKE).length;
  const upcomingNotSure = upcomingItemsForStats.filter(item => item.availability.availability === availabilityOptions.NOT_SURE).length;
  const pastWasPresent = pastItemsForStats.filter(item => item.availability.availability === pastPresentValue).length;
  const pastWasntPresent = pastItemsForStats.filter(item => item.availability.availability === pastAbsentValue).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold" style={{color: 'var(--page-title)'}}>{title}</h2>
        {allUpcomingResponded && (
          <span className="text-green-600 text-lg">✓</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse" style={{borderColor: 'var(--border)'}}>
          <thead>
            <tr style={{borderBottom: '2px solid var(--border)'}}>
              <th className="text-left py-2 px-3 font-semibold" style={{color: 'var(--primary-text)'}}>Status</th>
              <th className="text-right py-2 px-3 font-semibold" style={{color: 'var(--primary-text)'}}>Count</th>
            </tr>
          </thead>
          <tbody>
            {/* Upcoming items stats */}
            {upcomingItemsForStats.length > 0 && (
              <>
                <tr
                  className={upcomingNoResponse > 0 ? '' : 'border-b'}
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="py-2 px-3" style={{color: 'var(--primary-text)'}}>
                    <div className="flex items-center gap-2">
                      <span>❗</span>
                      <span>Haven't entered availability</span>
                    </div>
                  </td>
                  <td
                    className={`text-right py-2 px-3 font-semibold ${upcomingNoResponse > 0 ? 'text-red-600' : 'text-[var(--primary-text)]'}`}
                  >
                    {upcomingNoResponse}
                  </td>
                </tr>
                {upcomingNoResponse > 0 && (
                  <tr style={{borderBottom: '1px solid var(--border)'}}>
                    <td colSpan={2} className="py-1 px-3 text-xs text-center" style={{color: 'var(--secondary-text)'}}>
                      Enter your availability below
                    </td>
                  </tr>
                )}
                <tr style={{borderBottom: '1px solid var(--border)'}}>
                  <td className="py-2 px-3" style={{color: 'var(--primary-text)'}}>
                    <span>👍 Planning to attend</span>
                  </td>
                  <td className="text-right py-2 px-3 font-semibold" style={{color: 'var(--primary-text)'}}>{upcomingPlanToMake}</td>
                </tr>
                <tr style={{borderBottom: '1px solid var(--border)'}}>
                  <td className="py-2 px-3" style={{color: 'var(--primary-text)'}}>
                    <span>👎 Can't make it</span>
                  </td>
                  <td className="text-right py-2 px-3 font-semibold" style={{color: 'var(--primary-text)'}}>{upcomingCantMake}</td>
                </tr>
                <tr style={{borderBottom: '1px solid var(--border)'}}>
                  <td className="py-2 px-3" style={{color: 'var(--primary-text)'}}>
                    <span>❓ Not sure yet</span>
                  </td>
                  <td className="text-right py-2 px-3 font-semibold" style={{color: 'var(--primary-text)'}}>{upcomingNotSure}</td>
                </tr>
              </>
            )}
            {/* Past items stats */}
            {pastItemsForStats.length > 0 && (
              <>
                <tr style={{borderBottom: '1px solid var(--border)'}}>
                  <td className="py-2 px-3" style={{color: 'var(--primary-text)'}}>
                    <span>✅ Was present</span>
                  </td>
                  <td className="text-right py-2 px-3 font-semibold" style={{color: 'var(--primary-text)'}}>{pastWasPresent}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3" style={{color: 'var(--primary-text)'}}>
                    <span>❌ Wasn't present</span>
                  </td>
                  <td className="text-right py-2 px-3 font-semibold" style={{color: 'var(--primary-text)'}}>{pastWasntPresent}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}