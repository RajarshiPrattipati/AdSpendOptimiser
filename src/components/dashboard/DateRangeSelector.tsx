'use client';

import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Calendar } from 'lucide-react';

interface DateRangeSelectorProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
}

export default function DateRangeSelector({ startDate, endDate, onChange }: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localStartDate, setLocalStartDate] = useState(startDate);
  const [localEndDate, setLocalEndDate] = useState(endDate);

  const presets = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 14 days', days: 14 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 60 days', days: 60 },
    { label: 'Last 90 days', days: 90 },
  ];

  const handlePresetClick = (days: number) => {
    const end = format(new Date(), 'yyyy-MM-dd');
    const start = format(subDays(new Date(), days), 'yyyy-MM-dd');
    onChange(start, end);
    setIsOpen(false);
  };

  const handleApply = () => {
    onChange(localStartDate, localEndDate);
    setIsOpen(false);
  };

  const formatDisplayDate = (date: string) => {
    return format(new Date(date), 'MMM d, yyyy');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-700">
          {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)}
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Select Date Range</h3>

              {/* Quick Presets */}
              <div className="mb-4">
                <p className="text-xs text-gray-600 mb-2">Quick Select</p>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.days}
                      onClick={() => handlePresetClick(preset.days)}
                      className="px-3 py-2 text-sm text-gray-700 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Inputs */}
              <div className="mb-4">
                <p className="text-xs text-gray-600 mb-2">Custom Range</p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={localStartDate}
                      onChange={(e) => setLocalStartDate(e.target.value)}
                      max={localEndDate}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={localEndDate}
                      onChange={(e) => setLocalEndDate(e.target.value)}
                      min={localStartDate}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setLocalStartDate(startDate);
                    setLocalEndDate(endDate);
                    setIsOpen(false);
                  }}
                  className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
