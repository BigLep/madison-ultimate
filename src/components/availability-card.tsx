import { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PRACTICE_CONFIG } from '@/lib/practice-config';

interface AvailabilityCardProps {
  title: string;
  subtitle: string;
  location?: string;
  locationUrl?: string | null;
  availabilityOptions: Record<string, string>;
  currentAvailability: string;
  currentNote: string;
  onUpdateAvailability: (availability: string, note: string) => void;
  isUpdating: boolean;
  isEditable: boolean;
  isBye?: boolean; // Whether this is a bye week (FYI only)
  children?: React.ReactNode; // For additional content like time details
}

export function AvailabilityCard({
  title,
  subtitle,
  location,
  locationUrl,
  availabilityOptions,
  currentAvailability,
  currentNote,
  onUpdateAvailability,
  isUpdating,
  isEditable,
  isBye = false,
  children
}: AvailabilityCardProps) {
  const [selectedAvailability, setSelectedAvailability] = useState(currentAvailability);
  const [note, setNote] = useState(currentNote);
  // Debounce the note value - wait before auto-saving
  const [debouncedNote] = useDebounce(note, PRACTICE_CONFIG.NOTE_DEBOUNCE_DELAY);

  const handleAvailabilityChange = (availability: string) => {
    setSelectedAvailability(availability);
    onUpdateAvailability(availability, note);
  };

  const handleNoteChange = (newNote: string) => {
    setNote(newNote);
    // Note: We don't call onUpdateAvailability here anymore - it's handled by the useEffect below
  };

  // Auto-save when debounced note changes
  useEffect(() => {
    if (debouncedNote !== currentNote) {
      onUpdateAvailability(selectedAvailability, debouncedNote);
    }
  }, [debouncedNote, selectedAvailability, currentNote, onUpdateAvailability]);

  // Update local state when props change (e.g., after successful save)
  useEffect(() => {
    setSelectedAvailability(currentAvailability);
    setNote(currentNote);
  }, [currentAvailability, currentNote]);

  const getButtonStyle = (value: string) => {
    const isSelected = selectedAvailability === value;
    if (!isSelected) {
      return "bg-white border-gray-300 text-gray-700 hover:bg-gray-50";
    }
    if (value === availabilityOptions.PLANNING) {
      return "availability-planning hover:opacity-80";
    } else if (value === availabilityOptions.CANT_MAKE) {
      return "availability-cant-make hover:opacity-80";
    } else {
      return "availability-unsure hover:opacity-80";
    }
  };

  return (
    <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold" style={{color: 'var(--page-title)'}}>
          {title}
        </CardTitle>
        <div className="text-sm space-y-1" style={{color: 'var(--secondary-text)'}}>
          <div>{subtitle}</div>
          {location && (
            <div className="flex items-center gap-1">
              <span>Location:</span>
              {locationUrl ? (
                <a href={locationUrl} target="_blank" rel="noopener noreferrer" className="hyperlink">
                  {location}
                </a>
              ) : (
                <span>{location}</span>
              )}
            </div>
          )}
          {children}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isBye ? (
          /* Bye Week Display - No availability selection */
          <div className="text-center py-4 px-6 rounded-lg" style={{backgroundColor: 'var(--secondary-bg)'}}>
            <div className="text-lg mb-2">🗓️</div>
            <div className="text-sm font-medium" style={{color: 'var(--primary-text)'}}>
              Bye Week - No Game Scheduled
            </div>
            <div className="text-xs mt-1" style={{color: 'var(--secondary-text)'}}>
              Enjoy your week off!
            </div>
          </div>
        ) : (
          /* Regular Game - Show availability selection */
          <>
{isEditable ? (
              <div className="space-y-3">
                <div className="text-sm font-medium" style={{color: 'var(--primary-text)'}}>Your availability:</div>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(availabilityOptions).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => handleAvailabilityChange(value)}
                      disabled={isUpdating}
                      className={`
                        px-3 py-2 text-sm font-medium border rounded-lg transition-colors text-left
                        ${getButtonStyle(value)}
                        cursor-pointer
                        ${isUpdating ? 'opacity-50' : ''}
                      `}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Read-only display for past items
              <div className="space-y-2">
                <p className="text-sm font-medium" style={{color: 'var(--primary-text)'}}>
                  Your attendance: {currentAvailability === 'Was there' ? '✅ ' : currentAvailability === "Wasn't there" ? '❌ ' : ''}{currentAvailability || 'No response'}
                </p>
              </div>
            )}

{/* Note Section */}
            {isEditable ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{color: 'var(--primary-text)'}}>
                  Note (optional):
                </label>
                <textarea
                  value={note}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  placeholder="Add any additional comments..."
                  disabled={isUpdating}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border rounded-md resize-none"
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--border)',
                    color: 'var(--primary-text)'
                  }}
                />
              </div>
            ) : (
              // Show note below attendance for read-only
              currentNote && (
                <div className="p-2 rounded-md" style={{background: 'var(--secondary-bg)'}}>
                  <p className="text-xs" style={{color: 'var(--secondary-text)'}}>
                    {currentNote}
                  </p>
                </div>
              )
            )}

            {isUpdating && (
              <div className="text-xs text-center" style={{color: 'var(--secondary-text)'}}>
                Saving...
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}