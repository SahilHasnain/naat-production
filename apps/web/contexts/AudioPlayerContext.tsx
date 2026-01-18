"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Audio metadata interface
export interface AudioMetadata {
  audioUrl: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  audioId?: string;
  youtubeId: string;
  isLocalFile?: boolean;
}

// Audio player state interface
export interface AudioPlayerState {
  currentAudio: AudioMetadata | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  isLoading: boolean;
}

// Audio player actions interface
export interface AudioPlayerActions {
  loadAndPlay: (audio: AudioMetadata) => Promise<void>;
  togglePlayPause: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  stop: () => void;
}

// Combined context type
interface AudioPlayerContextType {
  state: AudioPlayerState;
  actions: AudioPlayerActions;
}

// Create context with undefined default
const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(
  undefined,
);

// Provider props
interface AudioPlayerProviderProps {
  children: ReactNode;
}

export function AudioPlayerProvider({ children }: AudioPlayerProviderProps) {
  // State management
  const [state, setState] = useState<AudioPlayerState>({
    currentAudio: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    volume: 1,
    isLoading: false,
  });

  // Audio element ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element with event listeners
  useEffect(() => {
    const audio = new Audio();
    audio.volume = state.volume;
    audioRef.current = audio;

    // Event listener: onPlay
    const handlePlay = () => {
      setState((prev) => ({ ...prev, isPlaying: true, isLoading: false }));
    };

    // Event listener: onPause
    const handlePause = () => {
      setState((prev) => ({ ...prev, isPlaying: false }));
    };

    // Event listener: onTimeUpdate
    const handleTimeUpdate = () => {
      if (audio.currentTime !== undefined) {
        setState((prev) => ({ ...prev, position: audio.currentTime }));
      }
    };

    // Event listener: onLoadedMetadata (duration available)
    const handleLoadedMetadata = () => {
      if (audio.duration !== undefined && !isNaN(audio.duration)) {
        setState((prev) => ({ ...prev, duration: audio.duration }));
      }
    };

    // Event listener: onEnded
    const handleEnded = () => {
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        position: 0,
      }));
      audio.currentTime = 0;
    };

    // Event listener: onError
    const handleError = (e: ErrorEvent | Event) => {
      console.error("Audio playback error:", audio.error);
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        isLoading: false,
      }));
    };

    // Attach event listeners
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    // Cleanup
    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);

      audio.pause();
      audio.src = "";
    };
  }, []);

  // Load and play audio with comprehensive error handling
  const loadAndPlay = useCallback(async (audio: AudioMetadata) => {
    if (!audioRef.current) {
      throw new Error("Audio element not initialized");
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      // Stop current playback
      audioRef.current.pause();
      audioRef.current.currentTime = 0;

      // Load new audio
      audioRef.current.src = audio.audioUrl;

      // Update state with new audio
      setState((prev) => ({
        ...prev,
        currentAudio: audio,
        position: 0,
        duration: 0,
        isLoading: true,
      }));

      // Load the audio
      audioRef.current.load();

      // Wait for audio to be ready and play
      await audioRef.current.play();

      setState((prev) => ({
        ...prev,
        isPlaying: true,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Failed to load and play audio:", error);

      // Provide user feedback based on error type
      let errorMessage = "Failed to play audio. Please try again.";

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          errorMessage =
            "Playback was blocked. Please interact with the page first.";
        } else if (error.name === "NotSupportedError") {
          errorMessage = "This audio format is not supported by your browser.";
        } else if (error.name === "AbortError") {
          errorMessage = "Audio loading was interrupted.";
        }
      }

      setState((prev) => ({
        ...prev,
        isPlaying: false,
        isLoading: false,
      }));

      // Re-throw with user-friendly message
      throw new Error(errorMessage);
    }
  }, []);

  // Toggle play/pause with error handling
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || !state.currentAudio) return;

    if (state.isPlaying) {
      audioRef.current.pause();
      setState((prev) => ({ ...prev, isPlaying: false }));
    } else {
      audioRef.current
        .play()
        .then(() => {
          setState((prev) => ({ ...prev, isPlaying: true }));
        })
        .catch((error) => {
          console.error("Failed to play audio:", error);
          setState((prev) => ({ ...prev, isPlaying: false }));
        });
    }
  }, [state.isPlaying, state.currentAudio]);

  // Seek to position
  const seek = useCallback((position: number) => {
    if (!audioRef.current) return;

    audioRef.current.currentTime = position;
    setState((prev) => ({ ...prev, position }));
  }, []);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    if (!audioRef.current) return;

    const clampedVolume = Math.max(0, Math.min(1, volume));
    audioRef.current.volume = clampedVolume;
    setState((prev) => ({ ...prev, volume: clampedVolume }));
  }, []);

  // Stop playback
  const stop = useCallback(() => {
    if (!audioRef.current) return;

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setState({
      currentAudio: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      volume: state.volume,
      isLoading: false,
    });
  }, [state.volume]);

  // Actions object
  const actions: AudioPlayerActions = {
    loadAndPlay,
    togglePlayPause,
    seek,
    setVolume,
    stop,
  };

  // Context value
  const value: AudioPlayerContextType = {
    state,
    actions,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

// Custom hook to use audio player context
export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);

  if (context === undefined) {
    throw new Error(
      "useAudioPlayer must be used within an AudioPlayerProvider",
    );
  }

  return context;
}
