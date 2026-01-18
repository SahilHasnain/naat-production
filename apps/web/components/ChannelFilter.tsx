"use client";

import type { Channel } from "@naat-collection/shared";

interface ChannelFilterProps {
  channels: Channel[];
  selectedChannelId: string | null;
  onChannelChange: (channelId: string | null) => void;
  loading?: boolean;
  isMobile?: boolean;
}

export function ChannelFilter({
  channels,
  selectedChannelId,
  onChannelChange,
  loading = false,
  isMobile = false,
}: ChannelFilterProps) {
  const sortedChannels = [...channels].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // Mobile: Horizontal scrollable pills
  if (isMobile) {
    const filterOptions = [
      { id: null, name: "All", icon: "🌐" },
      ...sortedChannels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        icon: "📺",
      })),
    ];

    return (
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="overflow-x-auto px-4 py-3">
          <div className="flex gap-2 pb-1">
            {filterOptions.map((option) => {
              const isSelected = selectedChannelId === option.id;
              return (
                <button
                  key={option.id || "all"}
                  onClick={() => onChannelChange(option.id)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-full flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold transition-colors ${
                    isSelected
                      ? "bg-blue-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  <span>{option.icon}</span>
                  {option.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Dropdown
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="channel-filter"
        className="text-gray-400 text-sm font-medium"
      >
        Channel:
      </label>
      <select
        id="channel-filter"
        value={selectedChannelId || ""}
        onChange={(e) => onChannelChange(e.target.value || null)}
        disabled={loading}
        className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 text-sm font-medium outline-none cursor-pointer hover:bg-gray-600 transition-colors"
      >
        <option value="">🌐 All Channels</option>
        {sortedChannels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            📺 {channel.name}
          </option>
        ))}
      </select>
    </div>
  );
}
