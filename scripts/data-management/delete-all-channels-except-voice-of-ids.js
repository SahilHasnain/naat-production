#!/usr/bin/env node

const { Client, Databases, Storage, Query } = require("node-appwrite");
const path = require("path");
const fs = require("fs");

const envPath = fs.existsSync(
  path.join(__dirname, "..", "..", "apps", "mobile", ".env.local"),
)
  ? path.join(__dirname, "..", "..", "apps", "mobile", ".env.local")
  : path.join(__dirname, "..", "..", "apps", "mobile", ".env");

require("dotenv").config({ path: envPath });

const config = {
  endpoint:
    process.env.APPWRITE_ENDPOINT || process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId:
    process.env.APPWRITE_PROJECT_ID ||
    process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  apiKey: process.env.APPWRITE_API_KEY,
  databaseId:
    process.env.APPWRITE_DATABASE_ID ||
    process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
  naatsCollectionId:
    process.env.APPWRITE_NAATS_COLLECTION_ID ||
    process.env.EXPO_PUBLIC_APPWRITE_NAATS_COLLECTION_ID,
  channelsCollectionId:
    process.env.APPWRITE_CHANNELS_COLLECTION_ID || "channels",
};

const AUDIO_BUCKET_ID = "audio-files";
const KEEP_CHANNEL_ID = "UC1ITk7d8gkT25c5-RT4eXPw"; // Voice of IDS

// Channels to delete: everything except Voice of IDS
const CHANNELS_TO_DELETE = [
  { id: "UCJ8LJcILEwghwCaLDjdXD9w", name: "Ghulam Mustafa Qadri" },
  { id: "UCl5Y4gH0-A7FYisJw8CZb8A", name: "Hafiz Anas Raza Attari" },
  { id: "UCeE_ZElaePcd51yfkwZfDLw", name: "E M C S" },
  { id: "UCyt4ri0owVWowAFdAPXiSTA", name: "Naat Production" },
  { id: "UCK0AECh5tNEZoDrM8i0g0bQ", name: "Sons of Hafiz Tahir Qadri" },
  { id: "PLkW9N8lesk1PLtj5yYI7_CfJYUcVLHJ3T", name: "playlist" },
  { id: "UCbbgJ-EH05HwinbdVawQj6g", name: "Hafiz Tahir Qadri" },
];

function validateEnv() {
  const required = [
    "endpoint",
    "projectId",
    "apiKey",
    "databaseId",
    "naatsCollectionId",
    "channelsCollectionId",
  ];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }
}

function initAppwrite() {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);
  return {
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

function getAudioFileIds(doc) {
  const ids = new Set();
  if (doc.audioId) ids.add(doc.audioId);
  if (doc.cutAudio) ids.add(doc.cutAudio);
  return [...ids];
}

async function deleteAudioFile(storage, audioFileId) {
  try {
    await storage.deleteFile(AUDIO_BUCKET_ID, audioFileId);
    return true;
  } catch (error) {
    if (error.code === 404) {
      return true; // Already gone
    }
    console.error(
      `   ❌ Error deleting audio file ${audioFileId}:`,
      error.message,
    );
    return false;
  }
}

async function deleteChannelNaats(databases, storage, channel) {
  console.log(`\n🔍 Processing channel: ${channel.name} (${channel.id})`);

  let totalDeleted = 0;
  let totalAudioDeleted = 0;
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await databases.listDocuments(
      config.databaseId,
      config.naatsCollectionId,
      [
        Query.equal("channelId", channel.id),
        Query.limit(limit),
        Query.offset(offset),
      ],
    );

    if (response.documents.length === 0) {
      break;
    }

    for (const doc of response.documents) {
      const audioIds = getAudioFileIds(doc);

      for (const audioId of audioIds) {
        const deleted = await deleteAudioFile(storage, audioId);
        if (deleted) {
          totalAudioDeleted++;
          console.log(`   🎵 Deleted audio: ${audioId}`);
        }
      }

      try {
        await databases.deleteDocument(
          config.databaseId,
          config.naatsCollectionId,
          doc.$id,
        );
        totalDeleted++;
      } catch (error) {
        console.error(
          `   ❌ Error deleting document ${doc.$id}:`,
          error.message,
        );
      }
    }

    if (response.documents.length < limit) {
      break;
    }
    offset += limit;
  }

  return { documents: totalDeleted, audioFiles: totalAudioDeleted };
}

async function deleteChannelFromCollection(databases, channel) {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.channelsCollectionId,
      [Query.equal("channelId", channel.id)],
    );

    if (response.documents.length === 0) {
      console.log(
        `   ⚠️  Channel not found in channels collection: ${channel.name}`,
      );
      return false;
    }

    for (const doc of response.documents) {
      await databases.deleteDocument(
        config.databaseId,
        config.channelsCollectionId,
        doc.$id,
      );
      console.log(
        `   ✅ Deleted channel document: ${doc.channelName || channel.id}`,
      );
    }
    return true;
  } catch (error) {
    console.error(
      `   ❌ Error deleting channel from collection:`,
      error.message,
    );
    return false;
  }
}

async function main() {
  console.log("🗑️  Naat Production - Delete All Channels Except Voice of IDS\n");
  console.log(`Project: ${config.projectId}`);
  console.log(`Keeping: Voice of IDS (${KEEP_CHANNEL_ID})`);
  console.log(`Deleting ${CHANNELS_TO_DELETE.length} channels...`);

  validateEnv();

  const { databases, storage } = initAppwrite();

  let totalDocuments = 0;
  let totalAudioFiles = 0;
  let totalChannels = 0;

  for (const channel of CHANNELS_TO_DELETE) {
    const stats = await deleteChannelNaats(databases, storage, channel);
    totalDocuments += stats.documents;
    totalAudioFiles += stats.audioFiles;

    const deleted = await deleteChannelFromCollection(databases, channel);
    if (deleted) totalChannels++;
  }

  console.log("\n📊 Deletion Summary:");
  console.log(`   📄 Total documents deleted: ${totalDocuments}`);
  console.log(`   🎵 Total audio files deleted: ${totalAudioFiles}`);
  console.log(`   📺 Total channels deleted: ${totalChannels}`);
  console.log("\n✨ Deletion complete!");
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error.message);
  process.exit(1);
});