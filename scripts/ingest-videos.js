#!/usr/bin/env node

const { Client, Databases } = require("node-appwrite");
require("dotenv").config();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const APPWRITE_ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.EXPO_PUBLIC_DATABASE_ID;
const COLLECTION_ID = process.env.EXPO_PUBLIC_COLLECTION_ID;

function validateEnv() {
  const required = [
    "YOUTUBE_API_KEY",
    "YOUTUBE_CHANNEL_ID",
    "EXPO_PUBLIC_APPWRITE_ENDPOINT",
    "EXPO_PUBLIC_APPWRITE_PROJECT_ID",
    "APPWRITE_API_KEY",
    "EXPO_PUBLIC_DATABASE_ID",
    "EXPO_PUBLIC_COLLECTION_ID",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }
}

function initAppwrite() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  return new Databases(client);
}

async function fetchYouTubeVideos(maxResults = 50) {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.append("key", YOUTUBE_API_KEY);
  url.searchParams.append("channelId", YOUTUBE_CHANNEL_ID);
  url.searchParams.append("part", "snippet");
  url.searchParams.append("order", "date");
  url.searchParams.append("type", "video");
  url.searchParams.append("maxResults", maxResults.toString());

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `YouTube API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.items || [];
}

async function fetchVideoDetails(videoIds) {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.append("key", YOUTUBE_API_KEY);
  url.searchParams.append("part", "contentDetails");
  url.searchParams.append("id", videoIds.join(","));

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `YouTube API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  const durationMap = {};
  (data.items || []).forEach((item) => {
    durationMap[item.id] = parseDuration(item.contentDetails.duration);
  });

  return durationMap;
}

function parseDuration(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

async function videoExists(databases, videoId) {
  try {
    await databases.getDocument(DATABASE_ID, COLLECTION_ID, videoId);
    return true;
  } catch (error) {
    if (error.code === 404) {
      return false;
    }
    throw error;
  }
}

async function createVideoDocument(databases, video, duration) {
  const videoId = video.id.videoId;
  const snippet = video.snippet;

  const document = {
    title: snippet.title,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnailUrl:
      snippet.thumbnails.high?.url || snippet.thumbnails.default?.url,
    duration: duration,
    uploadDate: snippet.publishedAt,
    channelName: snippet.channelTitle,
    channelId: YOUTUBE_CHANNEL_ID,
    youtubeId: videoId,
  };

  await databases.createDocument(DATABASE_ID, COLLECTION_ID, videoId, document);
  return document;
}

async function ingestVideos() {
  console.log("🚀 Starting video ingestion...\n");

  try {
    validateEnv();
    console.log("✅ Environment variables validated");

    const databases = initAppwrite();
    console.log("✅ Appwrite client initialized");

    console.log("📺 Fetching videos from YouTube...");
    const videos = await fetchYouTubeVideos();
    console.log(`✅ Found ${videos.length} videos`);

    const videoIds = videos.map((v) => v.id.videoId);
    console.log("⏱️  Fetching video durations...");
    const durations = await fetchVideoDetails(videoIds);
    console.log("✅ Durations fetched\n");

    let newCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const video of videos) {
      const videoId = video.id.videoId;
      const title = video.snippet.title;
      const duration = durations[videoId] || 0;

      try {
        const exists = await videoExists(databases, videoId);

        if (exists) {
          console.log(`⏭️  Skipped: ${title} (already exists)`);
          skippedCount++;
        } else {
          await createVideoDocument(databases, video, duration);
          console.log(`✅ Added: ${title}`);
          newCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${title}:`, error.message);
        errorCount++;
      }
    }

    console.log("\n📊 Ingestion Summary:");
    console.log(`   ✅ New videos added: ${newCount}`);
    console.log(`   ⏭️  Videos skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log("\n✨ Ingestion complete!");
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

ingestVideos();
