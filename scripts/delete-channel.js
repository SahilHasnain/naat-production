#!/usr/bin/env node

/**
 * Delete Channel and Associated Naats Script
 *
 * This tool:
 * 1. Prompts for channel document ID
 * 2. Fetches channel information
 * 3. Finds all naats belonging to that channel
 * 4. Deletes all naats
 * 5. Deletes the channel document
 *
 * Usage: node scripts/delete-channel.js
 */

const { Client, Databases, Query } = require("node-appwrite");
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

  if (!config.appwriteEndpoint) missing.push("APPWRITE_ENDPOINT");
  if (!config.appwriteProjectId) missing.push("APPWRITE_PROJECT_ID");
  if (!config.appwriteApiKey) missing.push("APPWRITE_API_KEY");
  if (!config.databaseId) missing.push("APPWRITE_DATABASE_ID");
  if (!config.naatsCollectionId) missing.push("APPWRITE_NAATS_COLLECTION_ID");
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

// Get channel by document ID
async function getChannelById(databases, channelDocId) {
  try {
    const channel = await databases.getDocument(
      config.databaseId,
      config.channelsCollectionId,
      channelDocId,
    );
    return channel;
  } catch (error) {
    if (error.code === 404) {
      throw new Error(`Channel not found with ID: ${channelDocId}`);
    }
    throw new Error(`Failed to fetch channel: ${error.message}`);
  }
}

// List all channels
async function listAllChannels(databases) {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.channelsCollectionId,
      [Query.limit(100)],
    );
    return response.documents;
  } catch (error) {
    throw new Error(`Failed to list channels: ${error.message}`);
  }
}

// Get all naats for a channel
async function getNaatsByChannel(databases, channelId) {
  try {
    const allNaats = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await databases.listDocuments(
        config.databaseId,
        config.naatsCollectionId,
        [
          Query.equal("channelId", channelId),
          Query.limit(limit),
          Query.offset(offset),
        ],
      );

      allNaats.push(...response.documents);

      if (response.documents.length < limit) {
        break;
      }

      offset += limit;
    }

    return allNaats;
  } catch (error) {
    throw new Error(`Failed to fetch naats: ${error.message}`);
  }
}

// Delete a naat document
async function deleteNaat(databases, naatId) {
  try {
    await databases.deleteDocument(
      config.databaseId,
      config.naatsCollectionId,
      naatId,
    );
  } catch (error) {
    throw new Error(`Failed to delete naat ${naatId}: ${error.message}`);
  }
}

// Delete channel document
async function deleteChannel(databases, channelDocId) {
  try {
    await databases.deleteDocument(
      config.databaseId,
      config.channelsCollectionId,
      channelDocId,
    );
  } catch (error) {
    throw new Error(`Failed to delete channel: ${error.message}`);
  }
}

// Main CLI function
async function main() {
  console.log("🗑️  Naat Production - Delete Channel Tool\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    validateEnv();

    const databases = initAppwrite();

    // List all channels first
    console.log("📋 Fetching all channels...\n");
    const channels = await listAllChannels(databases);

    if (channels.length === 0) {
      console.log("⚠️  No channels found in the database.");
      rl.close();
      process.exit(0);
    }

    console.log("Available channels:");
    console.log("═══════════════════════════════════════════════════════════");
    channels.forEach((channel, index) => {
      console.log(`${index + 1}. ${channel.channelName}`);
      console.log(`   Document ID: ${channel.$id}`);
      console.log(`   Channel ID: ${channel.channelId}`);
      console.log(`   Type: ${channel.type || "channel"}`);
      console.log("");
    });
    console.log("═══════════════════════════════════════════════════════════\n");

    // Prompt for channel document ID
    console.log("📝 Enter the Channel Document ID to delete:");
    console.log("   (Copy the Document ID from the list above)\n");

    const channelDocId = await question("Channel Document ID: ");

    if (!channelDocId || !channelDocId.trim()) {
      console.error("\n❌ Channel Document ID is required");
      rl.close();
      process.exit(1);
    }

    const trimmedChannelDocId = channelDocId.trim();

    console.log(`\n🔍 Fetching channel information...`);

    // Fetch channel info
    const channel = await getChannelById(databases, trimmedChannelDocId);

    console.log("\n✅ Channel found!");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`📺 Name: ${channel.channelName}`);
    console.log(`🆔 Document ID: ${channel.$id}`);
    console.log(`🆔 Channel ID: ${channel.channelId}`);
    console.log(`📹 Type: ${channel.type || "channel"}`);
    console.log("═══════════════════════════════════════════════════════════\n");

    // Fetch naats for this channel
    console.log("🔍 Searching for naats from this channel...");
    const naats = await getNaatsByChannel(databases, channel.channelId);

    console.log(`✅ Found ${naats.length} naat(s) from this channel\n`);

    if (naats.length > 0) {
      console.log("📋 Naats to be deleted:");
      console.log("───────────────────────────────────────────────────────────");
      naats.slice(0, 10).forEach((naat, index) => {
        console.log(`${index + 1}. ${naat.title}`);
      });
      if (naats.length > 10) {
        console.log(`   ... and ${naats.length - 10} more`);
      }
      console.log("───────────────────────────────────────────────────────────\n");
    }

    // Confirm deletion
    console.log("⚠️  WARNING: This action cannot be undone!");
    console.log(`   - ${naats.length} naat(s) will be deleted`);
    console.log(`   - Channel "${channel.channelName}" will be deleted\n`);

    const confirm = await question("Are you sure you want to delete? Type 'DELETE' to confirm: ");

    if (confirm !== "DELETE") {
      console.log("\n👋 Deletion cancelled. Goodbye!");
      rl.close();
      process.exit(0);
    }

    // Delete naats
    if (naats.length > 0) {
      console.log("\n🗑️  Deleting naats...");

      let deletedCount = 0;
      let errorCount = 0;

      for (const naat of naats) {
        try {
          await deleteNaat(databases, naat.$id);
          deletedCount++;
          console.log(`   ✅ Deleted: ${naat.title}`);
        } catch (error) {
          errorCount++;
          console.error(`   ❌ Error deleting ${naat.title}: ${error.message}`);
        }
      }

      console.log("\n═══════════════════════════════════════════════════════════");
      console.log("📊 Naat Deletion Summary:");
      console.log("═══════════════════════════════════════════════════════════");
      console.log(`   ✅ Successfully deleted: ${deletedCount}`);
      console.log(`   ❌ Errors: ${errorCount}`);
      console.log("═══════════════════════════════════════════════════════════\n");
    }

    // Delete channel
    console.log("🗑️  Deleting channel...");
    await deleteChannel(databases, trimmedChannelDocId);
    console.log(`✅ Channel "${channel.channelName}" deleted successfully!\n`);

    console.log("✨ Deletion complete!");
    console.log("👋 Goodbye!");
    rl.close();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    rl.close();
    process.exit(1);
  }
}

// Run CLI
main();
