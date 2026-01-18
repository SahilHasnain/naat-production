"use client";

import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

interface FullPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToVideo?: () => void;
}

export function FullPlayerModal({
  isOpen,
  onClose,
  onSwitchToVideo,
}: FullPlayerModalProps) {
  const { state, actions } = useAudioPlayer();
  const modalRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Don't render if no audio is loaded
  if (!state.currentAudio) {
    return null;
  }

  // Handle click outside to close
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200); // Match fade-out animation duration
  };

  // Format time in MM:SS format
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate progress percentage
  const progressPercentage =
    state.duration > 0 ? (state.position / state.duration) * 100 : 0;

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for handled keys
      const handledKeys = [
        " ",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Escape",
      ];
      if (handledKeys.includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case " ": // Space - play/pause
          actions.togglePlayPause();
          setAnnouncement(state.isPlaying ? "Paused" : "Playing");
          break;

        case "ArrowLeft": // Left arrow - seek backward 10s
          {
            const newPosition = Math.max(0, state.position - 10);
            actions.seek(newPosition);
            setAnnouncement(`Seeked to ${formatTime(newPosition)}`);
          }
          break;

        case "ArrowRight": // Right arrow - seek forward 10s
          {
            const newPosition = Math.min(state.duration, state.position + 10);
            actions.seek(newPosition);
            setAnnouncement(`Seeked to ${formatTime(newPosition)}`);
          }
          break;

        case "ArrowUp": // Up arrow - increase volume
          {
            const newVolume = Math.min(1, state.volume + 0.1);
            actions.setVolume(newVolume);
            setAnnouncement(`Volume ${Math.round(newVolume * 100)}%`);
          }
          break;

        case "ArrowDown": // Down arrow - decrease volume
          {
            const newVolume = Math.max(0, state.volume - 0.1);
            actions.setVolume(newVolume);
            setAnnouncement(`Volume ${Math.round(newVolume * 100)}%`);
          }
          break;

        case "Escape": // Escape - close modal
          handleClose();
          setAnnouncement("Player closed");
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    state.isPlaying,
    state.position,
    state.duration,
    state.volume,
    actions,
    handleClose,
  ]);

  // Focus trap implementation
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element when modal opens
    firstElement?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);
    return () => document.removeEventListener("keydown", handleTabKey);
  }, [isOpen]);

  // Screen reader announcements for playback state changes
  useEffect(() => {
    if (isOpen && state.isPlaying !== undefined) {
      setAnnouncement(state.isPlaying ? "Playing" : "Paused");
    }
  }, [state.isPlaying, isOpen]);

  // Don't render if not open
  if (!isOpen && !isClosing) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 ${
        isClosing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-title"
      aria-describedby="player-description"
    >
      {/* Screen reader announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>

      {/* Modal container */}
      <div
        ref={modalRef}
        className="bg-neutral-800 rounded-2xl p-8 max-w-[480px] w-full relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button in top-right corner */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full hover:bg-neutral-700 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 focus:ring-offset-neutral-800"
          aria-label="Close player"
        >
          <svg
            className="w-6 h-6 text-neutral-400 hover:text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Large thumbnail */}
        <div className="w-80 h-80 mx-auto rounded-xl overflow-hidden shadow-lg mb-6">
          <Image
            src={state.currentAudio.thumbnailUrl}
            alt={state.currentAudio.title}
            width={320}
            height={320}
            className="w-full h-full object-cover"
            priority
          />
        </div>

        {/* Title and channel */}
        <h2
          id="player-title"
          className="text-2xl font-bold text-white text-center mb-2"
        >
          {state.currentAudio.title}
        </h2>
        <p
          id="player-description"
          className="text-lg text-neutral-300 text-center mb-6"
        >
          {state.currentAudio.channelName}
        </p>

        {/* Progress slider */}
        <div className="mb-2">
          <input
            type="range"
            min="0"
            max={state.duration || 100}
            value={state.position}
            onChange={(e) => actions.seek(parseFloat(e.target.value))}
            className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider focus:outline-none focus:ring-2 focus:ring-primary-600"
            aria-label="Seek position"
            aria-valuemin={0}
            aria-valuemax={state.duration}
            aria-valuenow={state.position}
            aria-valuetext={`${formatTime(state.position)} of ${formatTime(state.duration)}`}
          />
        </div>

        {/* Time display */}
        <div className="flex justify-between text-sm text-neutral-400 mb-6">
          <span>{formatTime(state.position)}</span>
          <span>{formatTime(state.duration)}</span>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {/* Previous button */}
          <button
            className="w-12 h-12 rounded-full bg-neutral-700 hover:bg-neutral-600 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 focus:ring-offset-neutral-800"
            aria-label="Previous track"
            disabled
          >
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          {/* Play/Pause button (larger) */}
          <button
            onClick={actions.togglePlayPause}
            className="w-16 h-16 rounded-full bg-accent-primary hover:bg-accent-primary/90 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 focus:ring-offset-neutral-800"
            aria-label={state.isPlaying ? "Pause" : "Play"}
            aria-pressed={state.isPlaying}
          >
            {state.isPlaying ? (
              <svg
                className="w-8 h-8 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg
                className="w-8 h-8 text-white ml-1"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next button */}
          <button
            className="w-12 h-12 rounded-full bg-neutral-700 hover:bg-neutral-600 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 focus:ring-offset-neutral-800"
            aria-label="Next track"
            disabled
          >
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* Volume control */}
        <div className="flex items-center gap-3 mb-6">
          {/* Mute toggle button */}
          <button
            onClick={() => {
              if (state.volume > 0) {
                actions.setVolume(0);
              } else {
                actions.setVolume(1);
              }
            }}
            className="w-10 h-10 rounded-full hover:bg-neutral-700 transition-colors flex items-center justify-center shrink-0 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 focus:ring-offset-neutral-800"
            aria-label={state.volume === 0 ? "Unmute" : "Mute"}
          >
            {state.volume === 0 ? (
              <svg
                className="w-6 h-6 text-neutral-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : state.volume < 0.5 ? (
              <svg
                className="w-6 h-6 text-neutral-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M7 9v6h4l5 5V4l-5 5H7z" />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-neutral-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>

          {/* Volume slider */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={state.volume}
            onChange={(e) => actions.setVolume(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer slider focus:outline-none focus:ring-2 focus:ring-primary-600"
            aria-label="Volume"
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={state.volume}
            aria-valuetext={`Volume ${Math.round(state.volume * 100)}%`}
          />
        </div>

        {/* Watch Video Button */}
        {onSwitchToVideo && state.currentAudio?.youtubeId && (
          <button
            onClick={onSwitchToVideo}
            className="w-full flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-2xl transition-colors mb-6 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:ring-offset-neutral-800"
            aria-label="Switch to video mode"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
            <span>Watch Video</span>
          </button>
        )}

        {/* Keyboard shortcuts hint */}
        <div className="mt-6 pt-6 border-t border-neutral-700">
          <p className="text-xs text-neutral-500 text-center">
            Keyboard shortcuts: Space (play/pause) • ← → (seek ±10s) • ↑ ↓
            (volume) • Esc (close)
          </p>
        </div>
      </div>
    </div>
  );
}
