/**
 * Ingest Channels from Environment Variables
 *
 * This script reads YOUTUBE_CHANNEL_IDS from .env and adds them to the channels collection.
 * It fetches channel information from YouTube API and creates/updates channel documents.
 *
 * Usage: node scripts/data-management/ingest-channels-from-env.js
 */

const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", "..", "apps", "mobile", ".env"),
});
const { Client, Databases, Query, ID } = require("node-appwrite");

// Configuration from environment variables
const config = {
  endpoint: process.env.APPWRITE_ENDPOINT || "",
  projectId: process.env.APPWRITE_PROJECT_ID || "",
  apiKey: process.env.APPWRITE_API_KEY || "",
  databaseId: process.env.APPWRITE_DATABASE_ID || "",
  channelsCollectionId:
    process.env.APPWRITE_CHANNELS_COLLECTION_ID || "channels",
  naatsCollectionId: process.env.APPWRITE_NAATS_COLLECTION_ID || "naats",
  youtubeApiKey: process.env.YOUTUBE_API_KEY || "",
  youtubeChannelIds: process.env.YOUTUBE_CHANNEL_IDS || "",
};

/**
 * Fetch channel information from YouTube API
 */
async function fetchChannelInfo(channelId) {
  if (!config.youtubeApiKey) {
    console.log("  ⚠️  No YouTube API key, skipping YouTube fetch");
    return null;
  }

  try {
    const https = require("https");
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${config.youtubeApiKey}`;

    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);

              if (parsed.items && parsed.items.length > 0) {
                const channel = parsed.items[0];
                resolve({
                  channelName: channel.snippet.title,
                  description: channel.snippet.description,
                  subscriberCount:
                    parseInt(channel.statistics.subscriberCount) || 0,
                  videoCount: parseInt(channel.statistics.videoCount) || 0,
                });
              } else {
                console.log(`  ⚠️  No channel found with ID: ${channelId}`);
                resolve(null);
              }
            } catch (error) {
              console.error(
                `  ❌ Error parsing YouTube response:`,
                error.message,
              );
              resolve(null);
            }
          });
        })
        .on("error", (error) => {
          console.error(`  ❌ Error fetching channel info:`, error.message);
          resolve(null);
        });
    });
  } catch (error) {
    console.error(`  ❌ Error fetching channel info:`, error.message);
    return null;
  }
}

/**
 * Count naats for a channel
 */
async function countNaatsForChannel(databases, channelId) {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.naatsCollectionId,
      [Query.equal("channelId", channelId), Query.limit(1)],
    );
    return response.total || 0;
  } catch (error) {
    console.error(`  ❌ Error counting naats:`, error.message);
    return 0;
  }
}

/**
 * Add or update a channel document
 */
async function addChannel(databases, channelData) {
  try {
    // Check if channel already exists
    const existing = await databases.listDocuments(
      config.databaseId,
      config.channelsCollectionId,
      [Query.equal("channelId", channelData.channelId), Query.limit(1)],
    );

    if (existing.documents.length > 0) {
      // Update existing channel
      const doc = existing.documents[0];
      await databases.updateDocument(
        config.databaseId,
        config.channelsCollectionId,
        doc.$id,
        {
          channelName: channelData.channelName,
          naatCount: channelData.naatCount,
          lastUpdated: new Date().toISOString(),
        },
      );
      console.log(`  ✅ Updated channel: ${channelData.channelName}`);
      return { action: "updated", ...channelData };
    } else {
      // Create new channel (use channelId as document ID)
      await databases.createDocument(
        config.databaseId,
        config.channelsCollectionId,
        channelData.channelId,
        {
          channelId: channelData.channelId,
          channelName: channelData.channelName,
          naatCount: channelData.naatCount,
          lastUpdated: new Date().toISOString(),
        },
      );
      console.log(`  ✅ Created channel: ${channelData.channelName}`);
      return { action: "created", ...channelData };
    }
  } catch (error) {
    console.error(`  ❌ Error adding channel:`, error.message);
    throw error;
  }
}

async function main() {
  console.log("🚀 Starting channel ingestion from environment variables\n");
  console.log("═══════════════════════════════════════════════════════════");

  // Validate configuration
  const missing = [];
  if (!config.endpoint) missing.push("APPWRITE_ENDPOINT");
  if (!config.projectId) missing.push("APPWRITE_PROJECT_ID");
  if (!config.apiKey) missing.push("APPWRITE_API_KEY");
  if (!config.databaseId) missing.push("APPWRITE_DATABASE_ID");
  if (!config.youtubeChannelIds) missing.push("YOUTUBE_CHANNEL_IDS");

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error("\nOptional:");
    console.error(
      "   - YOUTUBE_API_KEY (for fetching channel names from YouTube)",
    );
    process.exit(1);
  }

  // Parse channel IDs from environment variable
  const channelIds = config.youtubeChannelIds
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (channelIds.length === 0) {
    console.error("❌ No channel IDs found in YOUTUBE_CHANNEL_IDS");
    console.error(
      "   Format: YOUTUBE_CHANNEL_IDS=channel_id_1,channel_id_2,channel_id_3",
    );
    process.exit(1);
  }

  console.log(`✅ Configuration validated`);
  console.log(`✅ Found ${channelIds.length} channel(s) to process\n`);

  // Initialize Appwrite client
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

  const databases = new Databases(client);
  console.log("✅ Appwrite client initialized\n");

  const results = [];

  for (let i = 0; i < channelIds.length; i++) {
    const channelId = channelIds[i];
    console.log(
      `\n📺 Processing channel ${i + 1}/${channelIds.length}: ${channelId}`,
    );

    // Fetch channel info from YouTube
    console.log("  Fetching channel info from YouTube...");
    const youtubeInfo = await fetchChannelInfo(channelId);

    let channelName = `Channel ${channelId}`;
    if (youtubeInfo) {
      channelName = youtubeInfo.channelName;
      console.log(`  ✅ Found: ${youtubeInfo.channelName}`);
      console.log(
        `     Subscribers: ${youtubeInfo.subscriberCount.toLocaleString()}`,
      );
      console.log(`     Videos: ${youtubeInfo.videoCount.toLocaleString()}`);
    }

    // Count naats for this channel
    console.log("  Counting naats in database...");
    const naatCount = await countNaatsForChannel(databases, channelId);
    console.log(`  ✅ Found ${naatCount} naat(s)`);

    // Prepare channel data
    const channelData = {
      channelId: channelId,
      channelName: channelName,
      naatCount: naatCount,
    };

    // Add channel to database
    console.log("  Adding to channels collection...");
    const result = await addChannel(databases, channelData);
    results.push(result);
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("✨ Channel ingestion complete!\n");
  console.log("📊 Summary:");
  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Total: ${results.length}\n`);

  console.log("📋 Channels:");
  results.forEach((r) => {
    console.log(`   ${r.action === "created" ? "➕" : "🔄"} ${r.channelName}`);
    console.log(`      ID: ${r.channelId}`);
    console.log(`      Naats: ${r.naatCount}`);
  });

  console.log("\n📝 Next steps:");
  console.log("   1. Verify channels in your Appwrite console");
  console.log("   2. Run the video ingestion script to add naats");
  console.log(
    "   3. Channels will be automatically updated as naats are added\n",
  );
}

// Run the script
main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
