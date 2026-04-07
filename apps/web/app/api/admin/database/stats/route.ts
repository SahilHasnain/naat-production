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

async function fetchAllDocuments(collectionId: string, queries: string[] = []) {
  const allDocuments = [] as any[];
  let offset = 0;
  const limit = 5000;

  while (true) {
    const response = await databases.listDocuments(DATABASE_ID, collectionId, [
      ...queries,
      Query.limit(limit),
      Query.offset(offset),
    ]);

    allDocuments.push(...response.documents);
    if (response.documents.length < limit) break;
    offset += limit;
  }

  return allDocuments;
}

async function getStorageFileCount() {
  let total = 0;
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await storage.listFiles(AUDIO_BUCKET_ID, [Query.limit(limit), Query.offset(offset)]);
    total += response.files.length;
    if (response.files.length < limit) break;
    offset += limit;
  }

  return total;
}

function hasAudio(naat: any) {
  return Boolean(String(naat.cutAudio || naat.audioId || "").trim());
}

export async function GET() {
  try {
    const [channels, naats, audioFilesCount] = await Promise.all([
      fetchAllDocuments(CHANNELS_COLLECTION_ID),
      fetchAllDocuments(NAATS_COLLECTION_ID),
      getStorageFileCount(),
    ]);

    const channelsWithCounts = channels.map((channel: any) => {
      const channelId = String(channel.channelId || channel.$id);
      const channelNaats = naats.filter((naat) => String(naat.channelId || "") === channelId);
      const withAudioCount = channelNaats.filter(hasAudio).length;

      return {
        $id: channel.$id,
        name: String(channel.channelName || channel.name || "Unknown Channel"),
        channelId,
        type: String(channel.type || "channel"),
        isOfficial: Boolean(channel.isOfficial),
        isOther: Boolean(channel.isOther),
        totalCount: channelNaats.length,
        withAudioCount,
        withoutAudioCount: channelNaats.length - withAudioCount,
      };
    }).sort((a, b) => b.totalCount - a.totalCount);

    const totalWithAudio = naats.filter(hasAudio).length;

    return NextResponse.json({
      stats: {
        totalNaats: naats.length,
        totalWithAudio,
        totalWithoutAudio: naats.length - totalWithAudio,
        channelsCount: channels.length,
        audioFilesCount,
      },
      channels: channelsWithCounts,
    });
  } catch (error) {
    console.error("Error fetching database stats:", error);
    return NextResponse.json({ error: "Failed to fetch database stats" }, { status: 500 });
  }
}
