import { useCallback, useEffect, useRef, useState } from "react";
import { appwriteService } from "../services/appwrite";
import type { Naat, UseNaatsReturn } from "../types";

/**
 * Number of naats to fetch per page
 */
const PAGE_SIZE = 20;

export type FilterOption = "latest" | "popular" | "oldest";

/**
 * Custom hook for managing naats data with pagination and caching
 *
 * Features:
 * - Fetches naats from Appwrite with pagination
 * - In-memory caching to avoid redundant API calls
 * - Infinite scroll support with loadMore
 * - Pull-to-refresh support
 * - Error handling
 * - Filter support (latest, popular, oldest)
 * - Channel filtering support (null = all channels)
 *
 * @param channelId - YouTube channel ID to filter by (null = all channels)
 * @param filter - Sort order for naats (default: "latest")
 * @returns UseNaatsReturn object with naats data and control functions
 */
export function useNaats(
  channelId: string | null = null,
  filter: FilterOption = "latest"
): UseNaatsReturn {
  const [naats, setNaats] = useState<Naat[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Track current offset for pagination
  const offsetRef = useRef<number>(0);

  // In-memory cache to avoid redundant API calls (separate cache per channel + filter combination)
  const cacheRef = useRef<Map<string, Map<number, Naat[]>>>(new Map());

  // Flag to prevent multiple simultaneous loads
  const isLoadingRef = useRef<boolean>(false);

  // Track current filter and channel to detect changes
  const currentFilterRef = useRef<FilterOption>(filter);
  const currentChannelRef = useRef<string | null>(channelId);

  // Generate cache key from channelId and filter
  const getCacheKey = useCallback(
    (channel: string | null, sortFilter: FilterOption): string => {
      return `${channel || "all"}_${sortFilter}`;
    },
    []
  );

  const cacheKey = getCacheKey(channelId, filter);

  // Reset state when filter or channelId changes
  useEffect(() => {
    if (
      currentFilterRef.current !== filter ||
      currentChannelRef.current !== channelId
    ) {
      currentFilterRef.current = filter;
      currentChannelRef.current = channelId;
      offsetRef.current = 0;
      setNaats([]);
      setHasMore(true);
      setError(null);
      isLoadingRef.current = false;
    }
  }, [filter, channelId]);

  /**
   * Load more naats for infinite scroll
   * Uses cached data when available
   */
  const loadMore = useCallback(() => {
    // Prevent multiple simultaneous loads
    if (isLoadingRef.current || !hasMore) {
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    // Get or create cache for current channel + filter combination
    if (!cacheRef.current.has(cacheKey)) {
      cacheRef.current.set(cacheKey, new Map());
    }
    const filterCache = cacheRef.current.get(cacheKey)!;

    // Check cache first
    const cachedData = filterCache.get(offsetRef.current);

    if (cachedData) {
      // Use cached data
      setNaats((prev) => [...prev, ...cachedData]);
      offsetRef.current += PAGE_SIZE;
      setHasMore(cachedData.length === PAGE_SIZE);
      setLoading(false);
      isLoadingRef.current = false;
      return;
    }

    // Fetch from API with filter and channelId
    appwriteService
      .getNaats(PAGE_SIZE, offsetRef.current, filter, channelId)
      .then((newNaats) => {
        // Cache the results for this channel + filter combination
        filterCache.set(offsetRef.current, newNaats);

        // Update state
        setNaats((prev) => [...prev, ...newNaats]);
        offsetRef.current += PAGE_SIZE;
        setHasMore(newNaats.length === PAGE_SIZE);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err : new Error("Failed to load naats")
        );

        // Try to use cached data as fallback
        const allCachedData: Naat[] = [];
        filterCache.forEach((cachedNaats) => {
          allCachedData.push(...cachedNaats);
        });

        if (allCachedData.length > 0 && naats.length === 0) {
          setNaats(allCachedData);
        }
      })
      .finally(() => {
        setLoading(false);
        isLoadingRef.current = false;
      });
  }, [hasMore, naats.length, filter, channelId, cacheKey]);

  /**
   * Refresh the naats list (pull-to-refresh)
   * Clears cache and reloads from the beginning
   */
  const refresh = useCallback(async (): Promise<void> => {
    // Reset state
    offsetRef.current = 0;

    // Clear cache for current channel + filter combination only
    if (cacheRef.current.has(cacheKey)) {
      cacheRef.current.get(cacheKey)!.clear();
    }

    setNaats([]);
    setHasMore(true);
    setError(null);
    setLoading(true);
    isLoadingRef.current = true;

    try {
      const freshNaats = await appwriteService.getNaats(
        PAGE_SIZE,
        0,
        filter,
        channelId
      );

      // Get or create cache for current channel + filter combination
      if (!cacheRef.current.has(cacheKey)) {
        cacheRef.current.set(cacheKey, new Map());
      }
      const filterCache = cacheRef.current.get(cacheKey)!;

      // Cache the results
      filterCache.set(0, freshNaats);

      // Update state
      setNaats(freshNaats);
      offsetRef.current = PAGE_SIZE;
      setHasMore(freshNaats.length === PAGE_SIZE);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to refresh naats")
      );
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [filter, channelId, cacheKey]);

  return {
    naats,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
