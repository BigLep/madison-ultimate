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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold" style={{color: 'var(--page-title)'}}>{title}</h2>
        {allUpcomingResponded && (
          <span className="text-green-600 text-lg">✓</span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 text-sm">
        {/* Upcoming items stats - always show all */}
        {upcomingItemsForStats.length > 0 && (
          <>
            <div className={`flex justify-between items-center py-2 px-3 rounded-lg border ${upcomingNoResponse > 0 ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex-1">
                <div className={`flex items-center gap-2 ${upcomingNoResponse > 0 ? 'text-blue-800' : 'text-gray-600'}`}>
                  <span>❗</span>
                  <span>Haven't entered availability for</span>
                </div>
                {upcomingNoResponse > 0 && (
                  <div className="text-xs text-blue-700 mt-1">👇 Enter your availability below</div>
                )}
              </div>
              <span className={`font-semibold ${upcomingNoResponse > 0 ? 'text-blue-800' : 'text-gray-600'}`}>{upcomingNoResponse}</span>
            </div>
            <div className={`flex justify-between items-center py-2 px-3 rounded-lg border ${upcomingPlanToMake > 0 ? 'bg-green-100 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
              <span className={`flex items-center gap-2 ${upcomingPlanToMake > 0 ? 'text-green-800' : 'text-gray-600'}`}>
                <span>👍</span>
                <span>Planning to attend</span>
              </span>
              <span className={`font-semibold ${upcomingPlanToMake > 0 ? 'text-green-800' : 'text-gray-600'}`}>{upcomingPlanToMake}</span>
            </div>
            <div className={`flex justify-between items-center py-2 px-3 rounded-lg border ${upcomingCantMake > 0 ? 'bg-red-100 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
              <span className={`flex items-center gap-2 ${upcomingCantMake > 0 ? 'text-red-800' : 'text-gray-600'}`}>
                <span>👎</span>
                <span>Can't make it</span>
              </span>
              <span className={`font-semibold ${upcomingCantMake > 0 ? 'text-red-800' : 'text-gray-600'}`}>{upcomingCantMake}</span>
            </div>
            <div className={`flex justify-between items-center py-2 px-3 rounded-lg border ${upcomingNotSure > 0 ? 'bg-yellow-100 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
              <span className={`flex items-center gap-2 ${upcomingNotSure > 0 ? 'text-yellow-800' : 'text-gray-600'}`}>
                <span>❓</span>
                <span>Not sure yet</span>
              </span>
              <span className={`font-semibold ${upcomingNotSure > 0 ? 'text-yellow-800' : 'text-gray-600'}`}>{upcomingNotSure}</span>
            </div>
          </>
        )}
        {/* Past items stats - always show all */}
        {pastItemsForStats.length > 0 && (
          <>
            <div className="flex justify-between items-center py-2 px-3 rounded-lg border attendance-present">
              <span className="flex items-center gap-2 text-white">
                <span>✅</span>
                <span>Was present</span>
              </span>
              <span className="font-semibold text-white">{pastWasPresent}</span>
            </div>
            <div className="flex justify-between items-center py-2 px-3 rounded-lg border attendance-absent">
              <span className="flex items-center gap-2 text-white">
                <span>❌</span>
                <span>Wasn't present</span>
              </span>
              <span className="font-semibold text-white">{pastWasntPresent}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}