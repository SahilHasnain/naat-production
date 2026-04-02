#!/usr/bin/env node

/**
 * Interactive CLI Tool to Add Channels and Ingest Naats
 *
 * This tool:
 * 1. Prompts for YouTube channel ID or playlist ID
 * 2. Fetches channel/playlist info from YouTube
 * 3. Adds channel/playlist to Appwrite Channels collection
 * 4. Optionally runs ingestion for that source
 *
 * Usage: node scripts/add-channel.js
 */

const { Client, Databases, ID, Query } = require("node-appwrite");
const readline = require("readline");
const path = require("path");
const fs = require("fs");

// Load environment variables
const envPath = fs.existsSync(path.join(__dirname, "..", "apps", "mobile", ".env.local"))
  ? path.join(__dirname, "..", "apps", "mobile", ".env.local")
  : path.join(__dirname, "..", "apps", "mobile", ".env");

require("dotenv").config({ path: envPath });

// Configuration
const config = {
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  appwriteEndpoint: process.env.APPWRITE_ENDPOINT || process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  appwriteProjectId: process.env.APPWRITE_PROJECT_ID || process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  appwriteApiKey: process.env.APPWRITE_API_KEY,
  databaseId: process.env.APPWRITE_DATABASE_ID || process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
  naatsCollectionId: process.env.APPWRITE_NAATS_COLLECTION_ID || process.env.EXPO_PUBLIC_APPWRITE_NAATS_COLLECTION_ID,
  channelsCollectionId: process.env.APPWRITE_CHANNELS_COLLECTION_ID || process.env.EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID,
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify question
function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Validate environment
function validateEnv() {
  const missing = [];

  if (!config.youtubeApiKey) missing.push("YOUTUBE_API_KEY");
  if (!config.appwriteEndpoint) missing.push("APPWRITE_ENDPOINT");
  if (!config.appwriteProjectId) missing.push("APPWRITE_PROJECT_ID");
  if (!config.appwriteApiKey) missing.push("APPWRITE_API_KEY");
  if (!config.databaseId) missing.push("APPWRITE_DATABASE_ID");
  if (!config.channelsCollectionId) missing.push("APPWRITE_CHANNELS_COLLECTION_ID");

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }
}

// Initialize Appwrite
function initAppwrite() {
  const client = new Client()
    .setEndpoint(config.appwriteEndpoint)
    .setProject(config.appwriteProjectId)
    .setKey(config.appwriteApiKey);

  return new Databases(client);
}

// Fetch channel info from YouTube
async function fetchChannelInfo(channelId) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  try {
    const response = await fetch(
      `${baseUrl}/channels?part=snippet,statistics&id=${channelId}&key=${config.youtubeApiKey}`,
    );

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    const channel = data.items[0];

    return {
      type: "channel",
      channelId: channelId,
      channelName: channel.snippet.title,
      thumbnailUrl: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default?.url,
      description: channel.snippet.description || "",
      subscriberCount: parseInt(channel.statistics?.subscriberCount || "0", 10),
      videoCount: parseInt(channel.statistics?.videoCount || "0", 10),
    };
  } catch (error) {
    throw new Error(`Failed to fetch channel info: ${error.message}`);
  }
}

// Fetch playlist info from YouTube
async function fetchPlaylistInfo(playlistId) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  try {
    const response = await fetch(
      `${baseUrl}/playlists?part=snippet,contentDetails&id=${playlistId}&key=${config.youtubeApiKey}`,
    );

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      throw new Error(`Playlist not found: ${playlistId}`);
    }

    const playlist = data.items[0];

    return {
      type: "playlist",
      channelId: playlistId, // Store playlist ID in channelId field
      playlistId: playlistId,
      channelName: playlist.snippet.title,
      thumbnailUrl: playlist.snippet.thumbnails.high?.url || playlist.snippet.thumbnails.default?.url,
      description: playlist.snippet.description || "",
      videoCount: parseInt(playlist.contentDetails?.itemCount || "0", 10),
    };
  } catch (error) {
    throw new Error(`Failed to fetch playlist info: ${error.message}`);
  }
}

// Check if source already exists (channel or playlist)
async function sourceExists(databases, channelId) {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.channelsCollectionId,
      [Query.equal("channelId", channelId), Query.limit(1)],
    );

    return response.documents.length > 0;
  } catch (error) {
    throw new Error(`Failed to check source existence: ${error.message}`);
  }
}

// Add source (channel or playlist) to database
async function addSource(databases, sourceInfo) {
  try {
    const documentData = {
      channelId: sourceInfo.channelId,
      channelName: sourceInfo.channelName,
      type: sourceInfo.type || "channel",
      isOther: sourceInfo.isOther !== undefined ? sourceInfo.isOther : false,
      naatCount: 0,
    };

    // Add playlistId if it's a playlist
    if (sourceInfo.type === "playlist" && sourceInfo.playlistId) {
      documentData.playlistId = sourceInfo.playlistId;
    }

    const document = await databases.createDocument(
      config.databaseId,
      config.channelsCollectionId,
      ID.unique(),
      documentData,
    );

    return document;
  } catch (error) {
    throw new Error(`Failed to add source: ${error.message}`);
  }
}

// Parse ISO 8601 duration to seconds
function parseDuration(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

// Fetch shorts video IDs from UUSH playlist
async function getShortsVideoIds(channelId) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";
  const shortsPlaylistId = channelId.replace('UC', 'UUSH');
  const shortsIds = new Set();
  
  try {
    console.log(`   Fetching shorts playlist (${shortsPlaylistId})...`);
    let pageToken = null;
    let totalShorts = 0;
    
    do {
      let playlistUrl = `${baseUrl}/playlistItems?part=contentDetails&playlistId=${shortsPlaylistId}&maxResults=50&key=${config.youtubeApiKey}`;
      
      if (pageToken) {
        playlistUrl += `&pageToken=${pageToken}`;
      }
      
      const response = await fetch(playlistUrl);
      
      if (!response.ok) {
        console.log(`   ℹ️  No shorts playlist found (this is normal if channel has no shorts)`);
        break;
      }
      
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        data.items.forEach(item => {
          shortsIds.add(item.contentDetails.videoId);
        });
        totalShorts += data.items.length;
      }
      
      pageToken = data.nextPageToken;
    } while (pageToken);
    
    if (totalShorts > 0) {
      console.log(`   ✅ Found ${totalShorts} shorts to exclude`);
    }
  } catch (error) {
    console.log(`   ℹ️  Could not fetch shorts playlist: ${error.message}`);
  }
  
  return shortsIds;
}

// Fetch videos from playlist
async function fetchPlaylistVideos(playlistId, maxResults = 5000) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  try {
    const allVideoItems = [];
    let pageToken = null;
    const perPage = 50;

    console.log(`   Fetching videos (limit: ${maxResults === Infinity ? 'all' : maxResults})...`);

    while (maxResults === Infinity || allVideoItems.length < maxResults) {
      let playlistUrl = `${baseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${perPage}&key=${config.youtubeApiKey}`;

      if (pageToken) {
        playlistUrl += `&pageToken=${pageToken}`;
      }

      const playlistResponse = await fetch(playlistUrl);
      const playlistData = await playlistResponse.json();

      if (!playlistData.items || playlistData.items.length === 0) {
        break;
      }

      allVideoItems.push(...playlistData.items);
      
      if (maxResults !== Infinity) {
        console.log(`   Fetched ${Math.min(allVideoItems.length, maxResults)} / ${maxResults} videos...`);
      } else {
        console.log(`   Fetched ${allVideoItems.length} videos...`);
      }

      pageToken = playlistData.nextPageToken;

      if (!pageToken) break;
      if (maxResults !== Infinity && allVideoItems.length >= maxResults) break;
    }

    const limitedVideoItems = maxResults === Infinity ? allVideoItems : allVideoItems.slice(0, maxResults);

    const allVideosData = [];
    const batchSize = 50;

    for (let i = 0; i < limitedVideoItems.length; i += batchSize) {
      const batch = limitedVideoItems.slice(i, i + batchSize);
      const videoIds = batch.map((item) => item.contentDetails.videoId).filter(id => id).join(",");

      if (!videoIds) continue;

      const videosResponse = await fetch(
        `${baseUrl}/videos?part=contentDetails,snippet,statistics&id=${videoIds}&key=${config.youtubeApiKey}`,
      );

      const videosData = await videosResponse.json();
      allVideosData.push(...videosData.items);
    }

    const videos = allVideosData.map((video) => ({
      youtubeId: video.id,
      title: video.snippet.title,
      videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
      thumbnailUrl:
        video.snippet.thumbnails.high?.url ||
        video.snippet.thumbnails.medium?.url ||
        video.snippet.thumbnails.default?.url,
      duration: parseDuration(video.contentDetails.duration),
      uploadDate: video.snippet.publishedAt,
      views: parseInt(video.statistics?.viewCount || "0", 10),
    }));

    // Get playlist name
    const playlistResponse = await fetch(
      `${baseUrl}/playlists?part=snippet&id=${playlistId}&key=${config.youtubeApiKey}`,
    );
    const playlistData = await playlistResponse.json();
    const playlistName = playlistData.items?.[0]?.snippet?.title || "Unknown Playlist";

    return { channelId: playlistId, channelName: playlistName, videos };
  } catch (error) {
    throw new Error(`Failed to fetch playlist videos: ${error.message}`);
  }
}

// Fetch videos from channel
async function fetchChannelVideos(channelId, maxResults = 5000) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  try {
    const channelResponse = await fetch(
      `${baseUrl}/channels?part=contentDetails,snippet&id=${channelId}&key=${config.youtubeApiKey}`,
    );

    if (!channelResponse.ok) {
      throw new Error(`YouTube API error: ${channelResponse.status}`);
    }

    const channelData = await channelResponse.json();
    const channelName = channelData.items[0].snippet.title;
    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // Fetch shorts video IDs to exclude them
    const shortsIds = await getShortsVideoIds(channelId);

    const allVideoItems = [];
    let pageToken = null;
    const perPage = 50;

    console.log(`   Fetching videos (limit: ${maxResults === Infinity ? 'all' : maxResults})...`);

    while (maxResults === Infinity || allVideoItems.length < maxResults) {
      let playlistUrl = `${baseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${perPage}&key=${config.youtubeApiKey}`;

      if (pageToken) {
        playlistUrl += `&pageToken=${pageToken}`;
      }

      const playlistResponse = await fetch(playlistUrl);
      const playlistData = await playlistResponse.json();

      if (!playlistData.items || playlistData.items.length === 0) {
        break;
      }

      allVideoItems.push(...playlistData.items);
      
      if (maxResults !== Infinity) {
        console.log(`   Fetched ${Math.min(allVideoItems.length, maxResults)} / ${maxResults} videos...`);
      } else {
        console.log(`   Fetched ${allVideoItems.length} videos...`);
      }

      pageToken = playlistData.nextPageToken;

      if (!pageToken) break;
      if (maxResults !== Infinity && allVideoItems.length >= maxResults) break;
    }

    const limitedVideoItems = maxResults === Infinity ? allVideoItems : allVideoItems.slice(0, maxResults);

    const allVideosData = [];
    const batchSize = 50;

    for (let i = 0; i < limitedVideoItems.length; i += batchSize) {
      const batch = limitedVideoItems.slice(i, i + batchSize);
      const videoIds = batch.map((item) => item.contentDetails.videoId).join(",");

      const videosResponse = await fetch(
        `${baseUrl}/videos?part=contentDetails,snippet,statistics&id=${videoIds}&key=${config.youtubeApiKey}`,
      );

      const videosData = await videosResponse.json();
      allVideosData.push(...videosData.items);
    }

    const videos = allVideosData
      .filter((video) => {
        // Filter out shorts using UUSH playlist
        if (shortsIds.has(video.id)) {
          return false;
        }
        return true;
      })
      .map((video) => ({
        youtubeId: video.id,
        title: video.snippet.title,
        videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
        thumbnailUrl:
          video.snippet.thumbnails.high?.url ||
          video.snippet.thumbnails.medium?.url ||
          video.snippet.thumbnails.default?.url,
        duration: parseDuration(video.contentDetails.duration),
        uploadDate: video.snippet.publishedAt,
        views: parseInt(video.statistics?.viewCount || "0", 10),
      }));

    const shortsFilteredCount = allVideosData.length - videos.length;
    if (shortsFilteredCount > 0) {
      console.log(`   🚫 Filtered ${shortsFilteredCount} shorts from video list`);
    }

    return { channelId, channelName, videos };
  } catch (error) {
    throw new Error(`Failed to fetch videos: ${error.message}`);
  }
}

// Get existing naats
async function getExistingNaats(databases) {
  const allDocuments = [];
  let offset = 0;
  const limit = 5000;

  while (true) {
    const response = await databases.listDocuments(
      config.databaseId,
      config.naatsCollectionId,
      [Query.limit(limit), Query.offset(offset)],
    );

    allDocuments.push(...response.documents);

    if (response.documents.length < limit) break;
    offset += limit;
  }

  const existingMap = new Map();
  allDocuments.forEach((doc) => {
    existingMap.set(doc.youtubeId, {
      documentId: doc.$id,
      views: doc.views || 0,
    });
  });

  return existingMap;
}

// Fetch videos from channel or playlist
async function fetchVideos(sourceId, sourceType, maxResults = 5000) {
  if (sourceType === "playlist") {
    return await fetchPlaylistVideos(sourceId, maxResults);
  } else {
    return await fetchChannelVideos(sourceId, maxResults);
  }
}

// Ingest naats for source
async function ingestSourceNaats(databases, sourceId, sourceName, sourceType, maxResults = 5000) {
  console.log(`\n📺 Fetching videos from ${sourceType}...`);

  const { videos } = await fetchVideos(sourceId, sourceType, maxResults);
  console.log(`✅ Found ${videos.length} videos`);

  console.log(`📦 Checking existing naats...`);
  const existingMap = await getExistingNaats(databases);

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let filtered = 0;

  console.log(`\n🔄 Processing videos...\n`);

  for (const video of videos) {
    try {
      // Filter: Skip shorts (< 60 seconds)
      if (video.duration < 60) {
        console.log(`   🚫 Filtered: ${video.title} (${video.duration}s < 60s, likely short)`);
        filtered++;
        continue;
      }

      const existing = existingMap.get(video.youtubeId);

      if (existing) {
        if (existing.views !== video.views) {
          await databases.updateDocument(
            config.databaseId,
            config.naatsCollectionId,
            existing.documentId,
            { views: video.views },
          );
          console.log(`   🔄 Updated: ${video.title} (${existing.views} → ${video.views} views)`);
          updated++;
        } else {
          unchanged++;
        }
      } else {
        await databases.createDocument(
          config.databaseId,
          config.naatsCollectionId,
          ID.unique(),
          {
            title: video.title,
            youtubeId: video.youtubeId,
            videoUrl: video.videoUrl,
            thumbnailUrl: video.thumbnailUrl,
            duration: video.duration,
            uploadDate: video.uploadDate,
            channelName: sourceName,
            channelId: sourceId,
            views: video.views,
          },
        );
        console.log(`   ✅ Added: ${video.title} (${video.views} views, ${video.duration}s)`);
        added++;
      }
    } catch (error) {
      console.error(`   ❌ Error: ${video.title} - ${error.message}`);
    }
  }

  return { added, updated, unchanged, filtered, total: videos.length };
}

// Main CLI function
async function main() {
  console.log("🎵 Naat Production - Add Channel/Playlist Tool\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    validateEnv();

    const databases = initAppwrite();

    // Prompt for source type
    console.log("📝 What type of source do you want to add?");
    console.log("   1. YouTube Channel");
    console.log("   2. YouTube Playlist\n");

    const typeChoice = await question("Choice (1/2): ");

    let sourceType = "channel";
    let sourceId = "";
    let sourceInfo = null;

    if (typeChoice.trim() === "2") {
      sourceType = "playlist";
      console.log("\n📝 Enter YouTube Playlist ID:");
      console.log("   (e.g., PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf)\n");

      sourceId = await question("Playlist ID: ");

      if (!sourceId || !sourceId.trim()) {
        console.error("\n❌ Playlist ID is required");
        rl.close();
        process.exit(1);
      }

      const trimmedSourceId = sourceId.trim();

      console.log(`\n🔍 Fetching playlist information from YouTube...`);
      sourceInfo = await fetchPlaylistInfo(trimmedSourceId);
    } else {
      sourceType = "channel";
      console.log("\n📝 Enter YouTube Channel ID:");
      console.log("   (e.g., UCDwHEBKDyZvCbHLjNh8olfQ)\n");

      sourceId = await question("Channel ID: ");

      if (!sourceId || !sourceId.trim()) {
        console.error("\n❌ Channel ID is required");
        rl.close();
        process.exit(1);
      }

      const trimmedSourceId = sourceId.trim();

      console.log(`\n🔍 Fetching channel information from YouTube...`);
      sourceInfo = await fetchChannelInfo(trimmedSourceId);
    }

    const trimmedSourceId = sourceId.trim();

    console.log(`\n✅ ${sourceType === "playlist" ? "Playlist" : "Channel"} found!`);
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`📺 Name: ${sourceInfo.channelName}`);
    console.log(`🆔 ID: ${sourceInfo.channelId}`);
    console.log(`📹 Videos: ${sourceInfo.videoCount.toLocaleString()}`);
    if (sourceInfo.subscriberCount) {
      console.log(`👥 Subscribers: ${sourceInfo.subscriberCount.toLocaleString()}`);
    }
    console.log(`📝 Description: ${sourceInfo.description.substring(0, 100)}...`);
    console.log("═══════════════════════════════════════════════════════════\n");

    // Check if source already exists
    const exists = await sourceExists(databases, trimmedSourceId);

    if (exists) {
      console.log(`ℹ️  This ${sourceType} already exists in the database.`);
      console.log("   Proceeding with ingestion...\n");
    } else {
      // Confirm adding source
      const confirm = await question(`Add this ${sourceType} to the database? (y/n): `);

      if (confirm.toLowerCase() !== "y") {
        console.log("\n👋 Cancelled. Goodbye!");
        rl.close();
        process.exit(0);
      }

      // Ask about channel flags
      console.log("\n⚙️  Channel Settings:");
      
      const isOtherInput = await question("Mark as 'Other' channel? (y/n, default: n): ");
      sourceInfo.isOther = isOtherInput.toLowerCase() === "y";

      console.log(`\n💾 Adding ${sourceType} to database...`);
      await addSource(databases, sourceInfo);
      console.log(`✅ ${sourceType === "playlist" ? "Playlist" : "Channel"} added successfully!`);
    }

    // Ask about ingestion
    const ingest = await question(`\nDo you want to ingest naats from this ${sourceType} now? (y/n): `);

    if (ingest.toLowerCase() === "y") {
      // Ask for number of videos to process
      console.log("\n📊 How many videos do you want to process?");
      console.log("   Enter a number (e.g., 100) or press Enter for all videos");
      const limitInput = await question("Limit (default: all): ");
      
      let maxResults = Infinity;
      if (limitInput.trim()) {
        const parsed = parseInt(limitInput.trim(), 10);
        if (!isNaN(parsed) && parsed > 0) {
          maxResults = parsed;
        } else {
          console.log("⚠️  Invalid number, processing all videos");
        }
      }

      console.log("\n🚀 Starting ingestion...");

      const results = await ingestSourceNaats(
        databases,
        trimmedSourceId,
        sourceInfo.channelName,
        sourceInfo.type,
        maxResults,
      );

      console.log("\n═══════════════════════════════════════════════════════════");
      console.log("📊 Ingestion Summary:");
      console.log("═══════════════════════════════════════════════════════════");
      console.log(`   📹 Total videos: ${results.total}`);
      console.log(`   ✅ New naats added: ${results.added}`);
      console.log(`   🔄 Naats updated: ${results.updated}`);
      console.log(`   ⏭️  Naats unchanged: ${results.unchanged}`);
      console.log(`   🚫 Videos filtered: ${results.filtered}`);
      console.log("═══════════════════════════════════════════════════════════\n");
      console.log("✨ Ingestion complete!");
    } else {
      console.log(`\n✅ ${sourceType === "playlist" ? "Playlist" : "Channel"} added. Run the ingestion function later to ingest naats.`);
    }

    console.log("\n👋 Done! Goodbye!");
    rl.close();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    rl.close();
    process.exit(1);
  }
}

// Run CLI
main();
