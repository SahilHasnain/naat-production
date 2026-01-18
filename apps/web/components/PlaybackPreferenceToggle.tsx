"use client";

import { usePlaybackPreference } from "@/hooks/usePlaybackPreference";

export function PlaybackPreferenceToggle() {
  const { playbackMode, updatePlaybackMode, isLoaded } =
    usePlaybackPreference();

  if (!isLoaded) return null;

  return (
    <div className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl">
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-white mb-1">
          Default Playback Mode
        </h3>
        <p className="text-xs text-neutral-400">
          Choose how naats should play when you click on them
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => updatePlaybackMode("video")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            playbackMode === "video"
              ? "bg-primary-600 text-white"
              : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
          }`}
          aria-pressed={playbackMode === "video"}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
            Video
          </div>
        </button>

        <button
          onClick={() => updatePlaybackMode("audio")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            playbackMode === "audio"
              ? "bg-accent-primary text-white"
              : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
          }`}
          aria-pressed={playbackMode === "audio"}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z" />
            </svg>
            Audio
          </div>
        </button>
      </div>
    </div>
  );
}
