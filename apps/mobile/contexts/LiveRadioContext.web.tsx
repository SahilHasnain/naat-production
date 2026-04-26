import { usePlaybackMode } from "@/contexts/PlaybackModeContext";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface LiveRadioContextType {
  isPlaying: boolean;
  currentNaat: { title: string };
  upcomingNaats: never[];
  listenerCount: number;
  isLoading: boolean;
  error: string | null;
  showMiniPlayer: boolean;
  play: () => Promise<void>;
  pause: (fromLivePage?: boolean) => Promise<void>;
  pauseFromMiniPlayer: () => Promise<void>;
  stop: () => Promise<void>;
  refresh: () => Promise<void>;
}

const LiveRadioContext = createContext<LiveRadioContextType | undefined>(
  undefined,
);

const LIVE_RADIO_STREAM_URL = "https://owaisrazaqadri.duckdns.org/live";

export const LiveRadioProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { setMode, isNormalAudioActive } = usePlaybackMode();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopSource = useRef<"dismiss" | "mini-pause" | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);

  const currentNaat = { title: "Naat Radio" };
  const upcomingNaats: never[] = [];
  const listenerCount = 0;

  useEffect(() => {
    const audio = new Audio(LIVE_RADIO_STREAM_URL);
    audio.preload = "none";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const handlePlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
      setShowMiniPlayer(true);
      setMode("live");
    };

    const handlePause = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handleError = () => {
      const mediaError = audio.error;
      setError(mediaError ? mediaError.message : "Unable to play live radio.");
      setIsPlaying(false);
      setIsLoading(false);
      setShowMiniPlayer(false);
      if (!isNormalAudioActive) {
        setMode("none");
      }
    };

    const handleEnded = () => {
      const shouldKeepMiniVisible = stopSource.current === "mini-pause";
      setIsPlaying(false);
      setIsLoading(false);
      setShowMiniPlayer(shouldKeepMiniVisible);
      if (!isNormalAudioActive) {
        setMode("none");
      }
      stopSource.current = null;
    };

    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("error", handleError);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.src = "";
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("ended", handleEnded);
      audioRef.current = null;
    };
  }, [isNormalAudioActive, setMode]);

  const stopInternal = useCallback(
    async (source: "dismiss" | "mini-pause") => {
      stopSource.current = source;
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setIsLoading(false);
      setShowMiniPlayer(source === "mini-pause");
      if (!isNormalAudioActive) {
        setMode("none");
      }
    },
    [isNormalAudioActive, setMode],
  );

  const refresh = useCallback(async () => {}, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      setIsPlaying(false);
      setShowMiniPlayer(true);
      setMode("live");
      audio.src = LIVE_RADIO_STREAM_URL;
      await audio.play();
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
      setIsPlaying(false);
      setShowMiniPlayer(false);
      setMode("none");
    }
  }, [setMode]);

  const stop = useCallback(async () => {
    await stopInternal("dismiss");
  }, [stopInternal]);

  const pause = useCallback(async () => {
    await stop();
  }, [stop]);

  const pauseFromMiniPlayer = useCallback(async () => {
    await stopInternal("mini-pause");
  }, [stopInternal]);

  useEffect(() => {
    if (isNormalAudioActive && (isPlaying || showMiniPlayer)) {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
      }
      setIsPlaying(false);
      setIsLoading(false);
      setShowMiniPlayer(false);
    }
  }, [isNormalAudioActive, isPlaying, showMiniPlayer]);

  return (
    <LiveRadioContext.Provider
      value={{
        isPlaying,
        currentNaat,
        upcomingNaats,
        listenerCount,
        isLoading,
        error,
        showMiniPlayer,
        play,
        pause,
        pauseFromMiniPlayer,
        stop,
        refresh,
      }}
    >
      {children}
    </LiveRadioContext.Provider>
  );
};

export const useLiveRadioPlayer = () => {
  const context = useContext(LiveRadioContext);
  if (context === undefined) {
    throw new Error(
      "useLiveRadioPlayer must be used within a LiveRadioProvider",
    );
  }
  return context;
};
