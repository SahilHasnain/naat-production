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
  channelsCollectionId: process.env.APPWRITE_CHANNELS_COLLECTION_ID || "channels",
};

if (!config.endpoint || !config.projectId || !config.apiKey || !config.databaseId) {
  console.error("❌ Missing required environment variables.");
  process.exit(1);
}

async function main() {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

  const databases = new Databases(client);

  console.log("Project:", config.projectId);
  console.log("Database:", config.databaseId);
  const response = await databases.listDocuments(
    config.databaseId,
    config.channelsCollectionId,
    [Query.limit(100)],
  );

  console.log(`\nTotal channels: ${response.total}\n`);

  for (const channel of response.documents) {
    console.log(`- ${channel.channelName} (${channel.channelId})`);
    console.log(`  Document ID: ${channel.$id}`);
    console.log(`  Type: ${channel.type || "channel"}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});