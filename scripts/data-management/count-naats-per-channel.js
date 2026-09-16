#!/usr/bin/env node

const { Client, Databases, Query } = require("node-appwrite");
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
};

async function main() {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

  const databases = new Databases(client);

  const channelIds = [
    { id: "UCJ8LJcILEwghwCaLDjdXD9w", name: "Ghulam Mustafa Qadri" },
    { id: "UC1ITk7d8gkT25c5-RT4eXPw", name: "Voice of IDS" },
    { id: "UCl5Y4gH0-A7FYisJw8CZb8A", name: "Hafiz Anas Raza Attari" },
    { id: "UCeE_ZElaePcd51yfkwZfDLw", name: "E M C S" },
    { id: "UCyt4ri0owVWowAFdAPXiSTA", name: "Naat Production" },
    { id: "UCK0AECh5tNEZoDrM8i0g0bQ", name: "Sons of Hafiz Tahir Qadri" },
    { id: "PLkW9N8lesk1PLtj5yYI7_CfJYUcVLHJ3T", name: "(playlist)" },
    { id: "UCbbgJ-EH05HwinbdVawQj6g", name: "Hafiz Tahir Qadri" },
  ];

  let total = 0;

  for (const ch of channelIds) {
    let count = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const res = await databases.listDocuments(
        config.databaseId,
        config.naatsCollectionId,
        [Query.equal("channelId", ch.id), Query.limit(100), Query.offset(offset)],
      );
      count += res.documents.length;
      if (res.documents.length < 100) {
        hasMore = false;
      } else {
        offset += 100;
      }
    }

    const keep = ch.id === "UC1ITk7d8gkT25c5-RT4eXPw" ? "✅ KEEP" : "🗑️  DELETE";
    console.log(`${keep} ${ch.name} (${ch.id}): ${count} naats`);
    total += count;
  }

  console.log(`\nTotal naats across all channels: ${total}`);
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});