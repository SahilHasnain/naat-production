"use client";

import { Client, Databases, Query } from "appwrite";
import { useCallback, useEffect, useState } from "react";

interface Naat {
  $id: string;
  $createdAt: string;
  title: string;
  youtubeId: string;
  thumbnailUrl: string;
  channelName: string;
  duration: number;
  views: number;
  uploadDate: string;
  exclude?: boolean;
  audioId?: string;
}

interface ChannelNameDocument {
  channelName?: string;
}

type ExcludeFilter = "all" | "included" | "excluded";
type SortOption = "latest" | "popular" | "oldest" | "random";

const LIMIT = 50;

export default function ExcludeNaatsClient() {
  const [naats, setNaats] = useState<Naat[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingExclude, setUpdatingExclude] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterExcluded, setFilterExcluded] = useState<ExcludeFilter>("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [randomSeed, setRandomSeed] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [playingNaatId, setPlayingNaatId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const loadNaats = useCallback(async (currentOffset: number, isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const databases = createDatabasesClient();
      const queries: string[] = [Query.limit(LIMIT), Query.offset(currentOffset)];

      if (sortBy === "latest") queries.push(Query.orderDesc("uploadDate"));
      if (sortBy === "oldest") queries.push(Query.orderAsc("uploadDate"));
      if (sortBy === "popular") queries.push(Query.orderDesc("views"));
      if (sortBy === "random") queries.push(Query.orderRandom());

      if (filterExcluded === "excluded") {
        queries.push(Query.equal("exclude", true));
      } else if (filterExcluded === "included") {
        queries.push(Query.or([Query.equal("exclude", false), Query.isNull("exclude")]));
      }

      if (filterChannel !== "all") {
        queries.push(Query.equal("channelName", filterChannel));
      }

      if (searchQuery.trim()) {
        queries.push(Query.search("title", searchQuery.trim()));
      }

      const response = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        process.env.NEXT_PUBLIC_APPWRITE_NAATS_COLLECTION_ID!,
        queries,
      );

      const nextBatch = response.documents as unknown as Naat[];
      setNaats((prev) => (isInitial || currentOffset === 0 ? nextBatch : [...prev, ...nextBatch]));
      setTotalCount(response.total);
      setHasMore(nextBatch.length === LIMIT);
      setOffset(currentOffset + nextBatch.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load naats");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterChannel, filterExcluded, searchQuery, sortBy]);

  const loadChannels = useCallback(async () => {
    try {
      const databases = createDatabasesClient();

      const channelResponse = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
        process.env.NEXT_PUBLIC_APPWRITE_NAATS_COLLECTION_ID!,
        [Query.select(["channelName"]), Query.limit(5000)],
      );

      const channelDocuments = channelResponse.documents as unknown as ChannelNameDocument[];
      const uniqueChannels = Array.from(
        new Set(
          channelDocuments
            .map((doc) => doc.channelName)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort();

      setChannels(uniqueChannels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChannels();

    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };

    window.addEventListener("scroll", handleScroll);

    const audio = new Audio();
    audio.addEventListener("ended", () => setPlayingNaatId(null));
    audio.addEventListener("error", () => {
      setError("Failed to load audio");
      setPlayingNaatId(null);
    });
    setAudioElement(audio);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      audio.pause();
      audio.src = "";
    };
  }, [loadChannels]);

  useEffect(() => {
    setNaats([]);
    setOffset(0);
    setHasMore(true);
    void loadNaats(0, true);
  }, [loadNaats, randomSeed]);

  function loadMore() {
    if (!loadingMore && hasMore) {
      void loadNaats(offset);
    }
  }

  function shuffleResults() {
    setRandomSeed((prev) => prev + 1);
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchQuery(searchTerm);
  }

  async function togglePlayAudio(naat: Naat) {
    if (!audioElement) return;

    if (playingNaatId === naat.$id) {
      if (audioElement.paused) {
        await audioElement.play();
      } else {
        audioElement.pause();
        setPlayingNaatId(null);
      }
      return;
    }

    if (!naat.audioId) {
      setError("Audio not available for this naat");
      return;
    }

    audioElement.pause();
    setPlayingNaatId(naat.$id);

    try {
      audioElement.src = `/api/stream-audio?audioId=${naat.audioId}`;
      await audioElement.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to play audio");
      setPlayingNaatId(null);
    }
  }

  async function toggleExclude(naatId: string, currentExcludeStatus: boolean) {
    setUpdatingExclude(naatId);
    setError(null);

    try {
      const response = await fetch("/api/admin/toggle-exclude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naatId, exclude: !currentExcludeStatus }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to update naat");
      }

      setNaats((prev) =>
        prev.map((naat) =>
          naat.$id === naatId ? { ...naat, exclude: !currentExcludeStatus } : naat,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update naat");
    } finally {
      setUpdatingExclude(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-8 text-white">
        <div className="mx-auto max-w-6xl">
          <p>Loading naats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-3xl font-bold">Exclude Naats</h1>
        <p className="mb-8 text-gray-400">Mark naats to exclude them from the app.</p>

        {error && (
          <div className="mb-6 rounded border border-red-500 bg-red-900/50 px-4 py-3 text-red-200">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-lg bg-gray-800 p-6">
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-gray-700 p-4">
              <p className="text-sm text-gray-400">Total Matching</p>
              <p className="text-2xl font-bold">{totalCount.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-blue-700 bg-blue-900/30 p-4">
              <p className="text-sm text-gray-400">Loaded</p>
              <p className="text-2xl font-bold text-blue-400">{naats.length.toLocaleString()}</p>
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="mb-4">
            <input
              type="text"
              placeholder="Search by title... (Press Enter)"
              className="w-full rounded border border-gray-600 bg-gray-700 px-4 py-2"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </form>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row">
              <select
                className="flex-1 rounded border border-gray-600 bg-gray-700 px-4 py-2"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
              >
                <option value="latest">Latest</option>
                <option value="popular">Most Popular</option>
                <option value="oldest">Oldest</option>
                <option value="random">Random</option>
              </select>

              {sortBy === "random" && (
                <button
                  type="button"
                  onClick={shuffleResults}
                  disabled={loading || loadingMore}
                  className="rounded bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Shuffle
                </button>
              )}

              <select
                className="flex-1 rounded border border-gray-600 bg-gray-700 px-4 py-2"
                value={filterChannel}
                onChange={(event) => setFilterChannel(event.target.value)}
              >
                <option value="all">All Channels</option>
                {channels.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </div>

            <select
              className="rounded border border-gray-600 bg-gray-700 px-4 py-2"
              value={filterExcluded}
              onChange={(event) => setFilterExcluded(event.target.value as ExcludeFilter)}
            >
              <option value="all">All Naats</option>
              <option value="included">Included Only</option>
              <option value="excluded">Excluded Only</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {naats.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-400">No naats found</div>
          ) : (
            naats.map((naat) => (
              <div
                key={naat.$id}
                className={`overflow-hidden rounded-lg bg-gray-800 transition-all hover:ring-2 hover:ring-gray-600 ${
                  naat.exclude ? "opacity-60 ring-2 ring-red-900/50" : ""
                } ${playingNaatId === naat.$id ? "ring-2 ring-blue-500" : ""}`}
              >
                <div
                  className="group relative aspect-video w-full cursor-pointer bg-gray-700"
                  onClick={() => void togglePlayAudio(naat)}
                >
                  <img
                    src={naat.thumbnailUrl}
                    alt={naat.title}
                    className="h-full w-full object-cover"
                  />

                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    {playingNaatId === naat.$id && !audioElement?.paused ? (
                      <svg className="h-16 w-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="h-16 w-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </div>

                  <div className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1">
                    <span className="text-xs font-bold text-white">{formatDuration(naat.duration)}</span>
                  </div>

                  {naat.exclude && (
                    <div className="absolute left-2 top-2 rounded bg-red-600 px-2 py-1">
                      <span className="text-xs font-bold text-white">EXCLUDED</span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="mb-2 min-h-[2.5rem] text-sm font-medium line-clamp-2">{naat.title}</h3>

                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-700">
                      <svg className="h-3 w-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-gray-400">{naat.channelName}</p>
                      <p className="text-xs text-gray-500">
                        {formatViews(naat.views)} views | {formatRelativeTime(naat.uploadDate)}
                      </p>
                    </div>
                  </div>

                  <a
                    href={`https://youtube.com/watch?v=${naat.youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-3 block truncate text-xs text-blue-400 hover:text-blue-300"
                  >
                    {naat.youtubeId}
                  </a>

                  <div onClick={(event) => event.stopPropagation()}>
                    <button
                      onClick={() => void toggleExclude(naat.$id, Boolean(naat.exclude))}
                      disabled={updatingExclude === naat.$id}
                      className={`w-full rounded px-3 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        naat.exclude
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      {updatingExclude === naat.$id
                        ? "Saving..."
                        : naat.exclude
                          ? "Include"
                          : "Exclude"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {hasMore && !loading && (
          <div className="mt-6 text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-gray-400">
          Showing {naats.length.toLocaleString()} of {totalCount.toLocaleString()} naats
        </div>

        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-50 rounded-full bg-blue-600 p-4 text-white shadow-lg transition-all hover:scale-110 hover:bg-blue-700"
            title="Back to top"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function createDatabasesClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

  return new Databases(client);
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatViews(views: number) {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
}
