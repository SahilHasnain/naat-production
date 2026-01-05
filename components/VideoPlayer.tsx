import { VideoPlayerProps } from "@/types";
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  initialPosition = 0,
  onPositionChange,
  onComplete,
  onError,
}) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const playerRef = React.useRef<any>(null);
  const positionIntervalRef = React.useRef<ReturnType<
    typeof setInterval
  > | null>(null);

  // Extract YouTube video ID from URL
  const getYouTubeId = (url: string): string => {
    const regExp =
      /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[7].length === 11 ? match[7] : "";
  };

  const videoId = getYouTubeId(videoUrl);

  // Track position changes when playing
  React.useEffect(() => {
    if (isPlaying && playerRef.current) {
      positionIntervalRef.current = setInterval(async () => {
        try {
          const currentTime = await playerRef.current.getCurrentTime();
          const positionInSeconds = Math.floor(currentTime);
          onPositionChange(positionInSeconds);
        } catch (err) {
          console.error("Failed to get current time:", err);
        }
      }, 1000);
    } else {
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
        positionIntervalRef.current = null;
      }
    }

    return () => {
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
      }
    };
  }, [isPlaying, onPositionChange]);

  const handleReady = () => {
    setIsLoading(false);
    // Seek to initial position if provided
    if (initialPosition > 0 && playerRef.current) {
      playerRef.current.seekTo(initialPosition, true);
    }
  };

  const handleError = (_errorType: string) => {
    const errorMessage = "Unable to play video. Please try another naat.";
    setError(errorMessage);
    setIsLoading(false);
    onError(new Error(errorMessage));
  };

  const handleStateChange = (state: string) => {
    if (state === "ended") {
      onComplete();
      setIsPlaying(false);
    } else if (state === "playing") {
      setIsPlaying(true);
    } else if (state === "paused") {
      setIsPlaying(false);
    }
  };

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-black p-8">
        <Text className="text-5xl mb-6">⚠️</Text>
        <Text className="mb-6 text-center text-lg leading-relaxed text-white">
          {error}
        </Text>
        <Pressable
          onPress={() => {
            setError(null);
            setIsLoading(true);
          }}
          className="rounded-xl bg-primary-600 px-8 py-4 active:bg-primary-700"
        >
          <Text className="text-base font-bold text-white">Try Again</Text>
        </Pressable>
      </View>
    );
  }

  if (!videoId) {
    return (
      <View className="flex-1 items-center justify-center bg-black p-8">
        <Text className="text-5xl mb-6">⚠️</Text>
        <Text className="mb-6 text-center text-lg leading-relaxed text-white">
          Invalid YouTube video URL
        </Text>
      </View>
    );
  }

  return (
    <View className="relative flex-1 bg-black">
      <View style={{ flex: 1, justifyContent: "center" }}>
        <YoutubePlayer
          ref={playerRef}
          height={400}
          videoId={videoId}
          play={false}
          onReady={handleReady}
          onError={handleError}
          onChangeState={handleStateChange}
          webViewStyle={{ opacity: isLoading ? 0 : 1 }}
          initialPlayerParams={{
            controls: true,
            modestbranding: true,
            rel: false,
          }}
        />
      </View>

      {isLoading && (
        <View className="absolute inset-0 items-center justify-center bg-black">
          <ActivityIndicator size="large" color="#ffffff" />
          <Text className="mt-4 text-base text-white">Loading video...</Text>
        </View>
      )}
    </View>
  );
};

export default VideoPlayer;
