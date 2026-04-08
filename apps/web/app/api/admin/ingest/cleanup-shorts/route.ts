import { NextResponse } from "next/server";
import { Client, Databases, Query, Storage } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const NAATS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_NAATS_COLLECTION_ID!;
const CHANNELS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID!;
const AUDIO_BUCKET_ID = "audio-files";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;

async function fetchAllDocuments(collectionId: string, queries: string[] = []) {
  const documents: Record<string, unknown>[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await databases.listDocuments(DATABASE_ID, collectionId, [
      ...queries,
      Query.limit(limit),
      Query.offset(offset),
    ]);

    documents.push(...response.documents);
    if (response.documents.length < limit) break;
    offset += limit;
  }

  return documents;
}

async function getShortsVideoIds(channelId: string) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";
  const shortsPlaylistId = channelId.replace("UC", "UUSH");
  const shortsIds = new Set<string>();

  try {
    let pageToken: string | null = null;

    do {
      let playlistUrl = `${baseUrl}/playlistItems?part=contentDetails&playlistId=${shortsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}`;

      if (pageToken) {
        playlistUrl += `&pageToken=${pageToken}`;
      }

      const response = await fetch(playlistUrl);
      if (!response.ok) {
        break;
      }

      const data = await response.json();
      if (data.items && data.items.length > 0) {
        data.items.forEach((item: { contentDetails?: { videoId?: string } }) => {
          const videoId = item.contentDetails?.videoId;
          if (videoId) shortsIds.add(videoId);
        });
      }

      pageToken = data.nextPageToken ?? null;
    } while (pageToken);
  } catch {
    // Shorts playlist may not exist or may be inaccessible.
  }

  return shortsIds;
}

async function deleteFileIfPresent(fileId: string | null | undefined) {
  if (!fileId) return false;

  try {
    await storage.deleteFile(AUDIO_BUCKET_ID, fileId);
    return true;
  } catch {
    return false;
  }
}

export async function POST() {
  try {
    const [naats, channels] = await Promise.all([
      fetchAllDocuments(NAATS_COLLECTION_ID),
      fetchAllDocuments(CHANNELS_COLLECTION_ID),
    ]);

    const shortsByChannel = await Promise.all(
      channels
        .map((channel) => String(channel.channelId || "").trim())
        .filter(Boolean)
        .map(async (channelId) => ({
          channelId,
          shortsIds: await getShortsVideoIds(channelId),
        })),
    );

    const shortsIdSet = new Set<string>();
    shortsByChannel.forEach(({ shortsIds }) => {
      shortsIds.forEach((videoId) => shortsIdSet.add(videoId));
    });

    const shorts = naats.filter((naat) => {
      const youtubeId = String(naat.youtubeId || "").trim();
      const duration = Number(naat.duration || 0);
      return shortsIdSet.has(youtubeId) || duration < 60;
    });

    let deletedDocuments = 0;
    let deletedAudioFiles = 0;
    let deletedCutAudioFiles = 0;

    for (const naat of shorts) {
      if (await deleteFileIfPresent(String(naat.audioId || "").trim() || undefined)) {
        deletedAudioFiles++;
      }

      if (await deleteFileIfPresent(String(naat.cutAudio || "").trim() || undefined)) {
        deletedCutAudioFiles++;
      }

      await databases.deleteDocument(DATABASE_ID, NAATS_COLLECTION_ID, String(naat.$id));
      deletedDocuments++;
    }

    return NextResponse.json({
      deletedDocuments,
      deletedAudioFiles,
      deletedCutAudioFiles,
    });
  } catch (error) {
    console.error("Error cleaning up shorts:", error);
    return NextResponse.json({ error: "Failed to cleanup shorts" }, { status: 500 });
  }
}
