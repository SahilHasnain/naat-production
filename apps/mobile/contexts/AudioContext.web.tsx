import { usePlaybackMode } from "@/contexts/PlaybackModeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface AudioMetadata {
  audioUrl: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  isLocalFile: boolean;
  audioId?: string;
  youtubeId?: string;
  naatId?: string;
}

interface AudioContextType {
  currentAudio: AudioMetadata | null;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  volume: number;
  error: Error | null;
  isRepeatEnabled: boolean;
  isAutoplayEnabled: boolean;
  abRepeatPointA: number | null;
  abRepeatPointB: number | null;
  isABRepeatActive: boolean;
  loadAndPlay: (audio: AudioMetadata) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (positionMillis: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  stop: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  toggleRepeat: () => Promise<void>;
  toggleAutoplay: () => Promise<void>;
  setAutoplayCallback: (callback: (() => Promise<void>) | null) => void;
  setABRepeatPointA: (position: number | null) => void;
  setABRepeatPointB: (position: number | null) => void;
  clearABRepeat: () => void;
  toggleABRepeat: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const REPEAT_KEY = "@audio_repeat_enabled";
const AUTOPLAY_KEY = "@audio_autoplay_enabled";

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { setMode, isLiveRadioActive } = usePlaybackMode();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoplayCallbackRef = useRef<(() => Promise<void>) | null>(null);
  const isRepeatEnabledRef = useRef(false);
  const isAutoplayEnabledRef = useRef(false);
  const abRepeatPointARef = useRef<number | null>(null);
  const abRepeatPointBRef = useRef<number | null>(null);
  const isABRepeatActiveRef = useRef(false);

  const [currentAudio, setCurrentAudio] = useState<AudioMetadata | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [error, setError] = useState<Error | null>(null);
  const [isRepeatEnabled, setIsRepeatEnabled] = useState(false);
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(false);
  const [abRepeatPointA, setAbRepeatPointA] = useState<number | null>(null);
  const [abRepeatPointB, setAbRepeatPointB] = useState<number | null>(null);
  const [isABRepeatActive, setIsABRepeatActive] = useState(false);

  useEffect(() => {
    abRepeatPointARef.current = abRepeatPointA;
  }, [abRepeatPointA]);

  useEffect(() => {
    isRepeatEnabledRef.current = isRepeatEnabled;
  }, [isRepeatEnabled]);

  useEffect(() => {
    isAutoplayEnabledRef.current = isAutoplayEnabled;
  }, [isAutoplayEnabled]);

  useEffect(() => {
    abRepeatPointBRef.current = abRepeatPointB;
  }, [abRepeatPointB]);

  useEffect(() => {
    isABRepeatActiveRef.current = isABRepeatActive;
  }, [isABRepeatActive]);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [repeatValue, autoplayValue] = await Promise.all([
          AsyncStorage.getItem(REPEAT_KEY),
          AsyncStorage.getItem(AUTOPLAY_KEY),
        ]);
        if (repeatValue !== null) {
          setIsRepeatEnabled(repeatValue === "true");
        }
        if (autoplayValue !== null) {
          setIsAutoplayEnabled(autoplayValue === "true");
        }
      } catch {}
    };

    loadPreferences();
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audio.volume = 1;
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration * 1000 : 0);
    };

    const handleTimeUpdate = () => {
      const nextPosition = audio.currentTime * 1000;
      setPosition(nextPosition);

      if (
        isABRepeatActiveRef.current &&
        abRepeatPointARef.current !== null &&
        abRepeatPointBRef.current !== null &&
        nextPosition >= abRepeatPointBRef.current
      ) {
        audio.currentTime = abRepeatPointARef.current / 1000;
      }
    };

    const handlePlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
      setMode("normal");
    };

    const handlePause = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handleEnded = async () => {
      setIsPlaying(false);
      setPosition(0);
      if (isRepeatEnabledRef.current) {
        audio.currentTime = 0;
        await audio.play();
        return;
      }
      if (isAutoplayEnabledRef.current && autoplayCallbackRef.current) {
        await autoplayCallbackRef.current();
      }
    };

    const handleError = () => {
      setError(new Error("Unable to play audio."));
      setIsPlaying(false);
      setIsLoading(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.pause();
      audio.src = "";
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audioRef.current = null;
    };
  }, [setMode]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (isLiveRadioActive) {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
      }
      setIsPlaying(false);
      setIsLoading(false);
    }
  }, [isLiveRadioActive]);

  const loadAndPlay = useCallback(
    async (audioMetadata: AudioMetadata) => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      try {
        setError(null);
        setIsLoading(true);
        setAbRepeatPointA(null);
        setAbRepeatPointB(null);
        setIsABRepeatActive(false);
        setMode("normal");
        audio.src = audioMetadata.audioUrl;
        audio.currentTime = 0;
        audio.volume = volume;
        setCurrentAudio(audioMetadata);
        audio.load();
        await audio.play();
      } catch (err) {
        setError(err as Error);
        setIsLoading(false);
        setIsPlaying(false);
      }
    },
    [setMode, volume],
  );

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    await audio.play();
  }, []);

  const pause = useCallback(async () => {
    audioRef.current?.pause();
  }, []);

  const seek = useCallback(async (positionMillis: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.currentTime = positionMillis / 1000;
    setPosition(positionMillis);
  }, []);

  const setVolume = useCallback(async (nextVolume: number) => {
    setVolumeState(nextVolume);
    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
    }
  }, []);

  const stop = useCallback(async () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    setCurrentAudio(null);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setError(null);
    setIsLoading(false);
    setMode("none");
  }, [setMode]);

  const togglePlayPause = useCallback(async () => {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }, [isPlaying, pause, play]);

  const toggleRepeat = useCallback(async () => {
    const nextValue = !isRepeatEnabled;
    setIsRepeatEnabled(nextValue);
    await AsyncStorage.setItem(REPEAT_KEY, String(nextValue));
  }, [isRepeatEnabled]);

  const toggleAutoplay = useCallback(async () => {
    const nextValue = !isAutoplayEnabled;
    setIsAutoplayEnabled(nextValue);
    await AsyncStorage.setItem(AUTOPLAY_KEY, String(nextValue));
  }, [isAutoplayEnabled]);

  const setAutoplayCallback = useCallback(
    (callback: (() => Promise<void>) | null) => {
      autoplayCallbackRef.current = callback;
    },
    [],
  );

  const setABRepeatPointAFunc = useCallback((nextPosition: number | null) => {
    setAbRepeatPointA(nextPosition);
  }, []);

  const setABRepeatPointBFunc = useCallback(
    (nextPosition: number | null) => {
      setAbRepeatPointB(nextPosition);
      if (nextPosition !== null && abRepeatPointA !== null) {
        setIsABRepeatActive(true);
      }
    },
    [abRepeatPointA],
  );

  const clearABRepeat = useCallback(() => {
    setAbRepeatPointA(null);
    setAbRepeatPointB(null);
    setIsABRepeatActive(false);
  }, []);

  const toggleABRepeat = useCallback(() => {
    if (abRepeatPointA !== null && abRepeatPointB !== null) {
      setIsABRepeatActive((prev) => !prev);
    }
  }, [abRepeatPointA, abRepeatPointB]);

  return (
    <AudioContext.Provider
      value={{
        currentAudio,
        isPlaying,
        isLoading,
        position,
        duration,
        volume,
        error,
        isRepeatEnabled,
        isAutoplayEnabled,
        abRepeatPointA,
        abRepeatPointB,
        isABRepeatActive,
        loadAndPlay,
        play,
        pause,
        seek,
        setVolume,
        stop,
        togglePlayPause,
        toggleRepeat,
        toggleAutoplay,
        setAutoplayCallback,
        setABRepeatPointA: setABRepeatPointAFunc,
        setABRepeatPointB: setABRepeatPointBFunc,
        clearABRepeat,
        toggleABRepeat,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudioPlayer = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error("useAudioPlayer must be used within AudioProvider");
  }
  return context;
};
