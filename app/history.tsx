import { BackToTopButton, VideoModal } from "@/components";
import EmptyState from "@/components/EmptyState";
import NaatCard from "@/components/NaatCard";
import { colors } from "@/constants/theme";
import { AudioMetadata, useAudioPlayer } from "@/contexts/AudioContext";
import { useHistory } from "@/hooks/useHistory";
import { appwriteService } from "@/services/appwrite";
import { audioDownloadService } from "@/services/audioDownload";
import { storageService } from "@/services/storage";
import type { Naat } from "@/types";
import { showErrorToast } from "@/utils/toast";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HistoryScreen() {
  // Modal state
  const [selectedNaat, setSelectedNaat] = useState<Naat | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isVideoFallback, setIsVideoFallback] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Back to top state
  const [showBackToTop, setShowBackToTop] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Audio player context
  const { loadAndPlay } = useAudioPlayer();

  // Data fetching hook
  const { history, loading, error, refresh, clearHistory } = useHistory();

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter history based on search query
  const displayData = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return history;
    }

    const query = debouncedQuery.toLowerCase();
    return history.filter(
      (naat) =>
        naat.title.toLowerCase().includes(query) ||
        naat.channelName.toLowerCase().includes(query)
    );
  }, [history, debouncedQuery]);

  // Handle naat selection
  const handleNaatPress = useCallback(
    async (naatId: string) => {
      const naat = displayData.find((n) => n.$id === naatId);
      if (!naat) return;

      // Track watch history
      await storageService.addToWatchHistory(naat.$id);

      try {
        // Check saved playback mode preference
        const savedMode = await storageService.loadPlaybackMode();

        // If user prefers audio mode, load audio directly
        if (savedMode === "audio") {
          await loadAudioDirectly(naat);
        } else {
          // Default to video mode
          setIsVideoFallback(false);
          setSelectedNaat(naat);
          setModalVisible(true);
        }
      } catch (error) {
        console.error("Error checking playback preference:", error);
        // Fallback to video mode on error
        setIsVideoFallback(false);
        setSelectedNaat(naat);
        setModalVisible(true);
      }
    },
    [displayData]
  );

  // Load audio directly without opening video modal
  const loadAudioDirectly = useCallback(
    async (naat: Naat) => {
      // Track watch history
      await storageService.addToWatchHistory(naat.$id);

      // Fallback to video if no audio ID
      if (!naat.audioId) {
        console.log("No audio ID available, falling back to video mode");
        showErrorToast("Audio not available. Playing video instead.");
        setIsVideoFallback(true);
        setSelectedNaat(naat);
        setModalVisible(true);
        return;
      }

      try {
        // Check if audio is downloaded first
        let audioUrl: string;
        let isLocalFile = false;

        const downloaded = await audioDownloadService.isDownloaded(
          naat.audioId
        );

        if (downloaded) {
          // Use local file
          audioUrl = audioDownloadService.getLocalPath(naat.audioId);
          isLocalFile = true;
        } else {
          // Fetch from storage
          const response = await appwriteService.getAudioUrl(naat.audioId);

          if (response.success && response.audioUrl) {
            audioUrl = response.audioUrl;
          } else {
            // Fallback to video mode if audio not available
            console.log("Audio not available, falling back to video mode");
            showErrorToast("Audio not available. Playing video instead.");
            setIsVideoFallback(true);
            setSelectedNaat(naat);
            setModalVisible(true);
            return;
          }
        }

        // Load audio via AudioContext
        const audioMetadata: AudioMetadata = {
          audioUrl,
          title: naat.title,
          channelName: naat.channelName,
          thumbnailUrl: naat.thumbnailUrl,
          isLocalFile,
          audioId: naat.audioId,
          youtubeId: naat.youtubeId,
        };

        await loadAndPlay(audioMetadata);
      } catch (err) {
        // Fallback to video mode on error
        console.error("Failed to load audio, falling back to video mode:", err);
        showErrorToast("Failed to load audio. Playing video instead.");
        setIsVideoFallback(true);
        setSelectedNaat(naat);
        setModalVisible(true);
      }
    },
    [loadAndPlay]
  );

  // Handle modal close
  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setIsVideoFallback(false);
    setTimeout(() => setSelectedNaat(null), 300);
  }, []);

  // Handle clear history with confirmation
  const handleClearHistory = useCallback(() => {
    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      "Clear Watch History",
      "Are you sure you want to clear all watch history? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            // Heavy haptic for destructive action
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            );

            try {
              await clearHistory();
              // Success haptic and toast
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              showSuccessToast("Watch history cleared successfully");
              // Announce to screen reader
              AccessibilityInfo.announceForAccessibility(
                "Watch history cleared successfully"
              );
            } catch (err) {
              // Error haptic and toast
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Error
              );
              const errorMessage =
                err instanceof Error
                  ? err.message
                  : "Unable to clear watch history";
              showErrorToast(errorMessage);
            }
          },
        },
      ]
    );
  }, [clearHistory]);

  // Handle scroll to show/hide back to top button
  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowBackToTop(offsetY > 500);
  }, []);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // Optimize FlatList performance with getItemLayout
  const ITEM_HEIGHT = 320;
  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  // Render individual naat card
  const renderNaatCard = useCallback(
    ({ item }: { item: Naat }) => (
      <View className="px-4 mb-4">
        <NaatCard
          id={item.$id}
          title={item.title}
          thumbnail={item.thumbnailUrl}
          duration={item.duration}
          uploadDate={item.uploadDate}
          channelName={item.channelName}
          views={item.views}
          onPress={() => handleNaatPress(item.$id)}
        />
      </View>
    ),
    [handleNaatPress]
  );

  // Render empty state
  const renderEmptyState = () => {
    if (loading && history.length === 0) {
      return (
        <View className="items-center justify-center flex-1 py-20">
          <ActivityIndicator size="large" color={colors.accent.secondary} />
          <Text className="mt-4 text-base text-neutral-400">
            Loading history...
          </Text>
        </View>
      );
    }

    if (error && history.length === 0) {
      return (
        <EmptyState
          message="Unable to load history. Please try again."
          icon="⚠️"
          actionLabel="Retry"
          onAction={refresh}
        />
      );
    }

    if (debouncedQuery && displayData.length === 0) {
      return (
        <EmptyState message="No naats found matching your search." icon="🔍" />
      );
    }

    if (history.length === 0) {
      return (
        <EmptyState
          message="No watch history yet. Start watching some naats!"
          icon="🕐"
        />
      );
    }

    return null;
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-900" edges={["top"]}>
      <View className="flex-1">
        {/* Header */}
        <View className="px-4 py-4 bg-neutral-800 border-b border-neutral-700">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-white">
                Watch History
              </Text>
              {history.length > 0 && (
                <Text className="mt-1 text-sm text-neutral-400">
                  {history.length} {history.length === 1 ? "naat" : "naats"}{" "}
                  watched
                </Text>
              )}
            </View>
            {history.length > 0 && (
              <Pressable
                onPress={handleClearHistory}
                className="px-4 py-2 bg-red-500/20 rounded-full"
                style={{ minHeight: 44 }}
                accessibilityRole="button"
                accessibilityLabel="Clear all history"
                accessibilityHint="Double tap to clear all watch history"
              >
                <View className="flex-row items-center">
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  <Text className="ml-2 text-sm font-semibold text-red-500">
                    Clear
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>

        {/* Search Bar */}
        {history.length > 0 && (
          <View className="px-4 py-3 bg-neutral-800 border-b border-neutral-700">
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search history..."
            />
          </View>
        )}

        {/* History List */}
        <FlatList
          ref={flatListRef}
          data={displayData}
          renderItem={renderNaatCard}
          keyExtractor={(item) => item.$id}
          getItemLayout={getItemLayout}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: 16,
            paddingBottom: 50,
          }}
          ListEmptyComponent={renderEmptyState}
          onScroll={handleScroll}
          scrollEventThrottle={400}
          refreshControl={
            <RefreshControl
              refreshing={loading && history.length > 0}
              onRefresh={refresh}
              colors={[colors.accent.secondary]}
              tintColor={colors.accent.secondary}
            />
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
        />

        {/* Back to Top Button */}
        <BackToTopButton visible={showBackToTop} onPress={scrollToTop} />
      </View>

      {/* Video Modal */}
      {selectedNaat && (
        <VideoModal
          visible={modalVisible}
          onClose={handleCloseModal}
          videoUrl={selectedNaat.videoUrl}
          title={selectedNaat.title}
          channelName={selectedNaat.channelName}
          thumbnailUrl={selectedNaat.thumbnailUrl}
          youtubeId={selectedNaat.youtubeId}
          audioId={selectedNaat.audioId}
          isFallback={isVideoFallback}
        />
      )}
    </SafeAreaView>
  );
}
