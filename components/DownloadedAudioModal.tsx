import { colors } from "@/constants/theme";
import { DownloadedAudioModalProps } from "@/types";
import { showErrorToast } from "@/utils/toast";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Modal, StatusBar, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AudioPlayer from "./AudioPlayer";

const DownloadedAudioModal: React.FC<DownloadedAudioModalProps> = ({
  visible,
  onClose,
  audio,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Generate thumbnail URL from YouTube ID
  const thumbnailUrl = `https://img.youtube.com/vi/${audio.youtubeId}/maxresdefault.jpg`;

  // Handle audio player errors
  const handleError = (err: Error) => {
    console.error("[DownloadedAudioModal] Audio error:", err);
    setError(err);
    setIsLoading(false);
    showErrorToast("Unable to play audio file");
  };

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setError(null);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.background.primary}
      />

      {/* Full Height Modal Container */}
      <View className="flex-1 bg-black">
        {/* Modal Content Container */}
        <View className="flex-1">
          <View className="flex-1 bg-neutral-900 overflow-hidden">
            {/* Header without Close Button */}
            <SafeAreaView className="bg-neutral-800 border-b border-neutral-700">
              <View className="px-5 py-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-bold text-white leading-tight">
                      {audio.title}
                    </Text>
                    <Text className="text-sm text-neutral-400 mt-1">
                      Downloaded Audio
                    </Text>
                  </View>
                </View>
              </View>
            </SafeAreaView>

            {/* Audio Player or Loading/Error State */}
            {isLoading && !error ? (
              <View className="flex-1 items-center justify-center bg-black">
                <ActivityIndicator size="large" color={colors.accent.primary} />
                <Text className="mt-3 text-sm text-neutral-400">
                  Loading audio...
                </Text>
              </View>
            ) : error ? (
              <View className="flex-1 items-center justify-center px-8 bg-black">
                <Ionicons
                  name="alert-circle"
                  size={64}
                  color={colors.accent.error}
                />
                <Text className="mt-4 text-center text-xl font-bold text-white">
                  Playback Error
                </Text>
                <Text className="mt-2 text-center text-base text-neutral-400">
                  {error.message ||
                    "Unable to play this audio file. It may be corrupted or deleted."}
                </Text>
              </View>
            ) : (
              <View className="flex-1">
                <AudioPlayer
                  audioUrl={audio.localUri}
                  title={audio.title}
                  channelName="Downloaded Audio"
                  thumbnailUrl={thumbnailUrl}
                  onError={handleError}
                  autoPlay={true}
                  isLocalFile={true}
                />
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default DownloadedAudioModal;
