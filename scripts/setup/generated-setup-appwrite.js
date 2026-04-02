/**
 * Generated Appwrite Setup Script
 * 
 * Auto-generated from postmortem analysis of naat-collection
 * Date: 2026-04-02T05:00:18.578Z
 * 
 * This script recreates the complete Appwrite structure:
 * - Database: naatDB
 * - Collections: 6
 * - Buckets: 3
 * - Functions: 10
 * 
 * Usage: node scripts/setup/generated-setup-appwrite.js
 */

const { Client, Databases, Storage, ID, Permission, Role, IndexType } = require("node-appwrite");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", "apps", "mobile", ".env.local") });

const config = {
  endpoint: process.env.APPWRITE_ENDPOINT || process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.APPWRITE_PROJECT_ID || process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  apiKey: process.env.APPWRITE_API_KEY || process.env.APPWRITE_SECRET_KEY,
};

// Validate configuration
function validateConfig() {
  const missing = [];
  if (!config.endpoint) missing.push("APPWRITE_ENDPOINT");
  if (!config.projectId) missing.push("APPWRITE_PROJECT_ID");
  if (!config.apiKey) missing.push("APPWRITE_API_KEY");

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((v) => console.error(`   - ${v}`));
    process.exit(1);
  }
}

// Initialize clients
function initializeClients() {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

  return {
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

// Helper to wait for attribute
async function waitForAttribute(databases, databaseId, collectionId, attributeKey) {
  console.log(`   ⏳ Waiting for attribute '${attributeKey}' to be ready...`);
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    try {
      const collection = await databases.getCollection(databaseId, collectionId);
      const attribute = collection.attributes.find((attr) => attr.key === attributeKey);

      if (attribute && attribute.status === "available") {
        console.log(`   ✅ Attribute '${attributeKey}' is ready`);
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    }
  }

  throw new Error(`Attribute '${attributeKey}' did not become available in time`);
}

// Create database
async function createDatabase(databases) {
  console.log("\n📊 Creating database...");
  
  try {
    const databaseId = ID.unique();
    await databases.create(databaseId, "naatDB");
    console.log(`✅ Database created: ${databaseId}`);
    return databaseId;
  } catch (error) {
    console.error(`❌ Failed to create database: ${error.message}`);
    throw error;
  }
}

// Create Naats collection
async function createNaatsCollection(databases, databaseId) {
  console.log("\n📦 Creating Naats collection...");
  
  try {
    const collectionId = "695bc8e70038db72df5b";
    
    // Create collection
    await databases.createCollection(
      databaseId,
      collectionId,
      "Naats",
      [
            "read(\"any\")"
      ],
      false
    );
    console.log(`✅ Collection created: ${collectionId}`);
    
    // Create attributes
    console.log("   Creating attributes...");
    await databases.createStringAttribute(databaseId, collectionId, "title", 500, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "title");
    await databases.createStringAttribute(databaseId, collectionId, "videoUrl", 1000, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "videoUrl");
    await databases.createStringAttribute(databaseId, collectionId, "thumbnailUrl", 1000, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "thumbnailUrl");
    await databases.createIntegerAttribute(databaseId, collectionId, "duration", true, 0, 9223372036854776000, false);
    await waitForAttribute(databases, databaseId, collectionId, "duration");
    await databases.createDatetimeAttribute(databaseId, collectionId, "uploadDate", true, false);
    await waitForAttribute(databases, databaseId, collectionId, "uploadDate");
    await databases.createStringAttribute(databaseId, collectionId, "channelName", 200, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "channelName");
    await databases.createStringAttribute(databaseId, collectionId, "channelId", 100, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "channelId");
    await databases.createStringAttribute(databaseId, collectionId, "youtubeId", 50, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "youtubeId");
    await databases.createIntegerAttribute(databaseId, collectionId, "views", true, -9223372036854776000, 9223372036854776000, false);
    await waitForAttribute(databases, databaseId, collectionId, "views");
    await databases.createStringAttribute(databaseId, collectionId, "audioId", 100, false, false);
    await waitForAttribute(databases, databaseId, collectionId, "audioId");
    await databases.createStringAttribute(databaseId, collectionId, "cutAudio", 255, false, false);
    await waitForAttribute(databases, databaseId, collectionId, "cutAudio");
    await databases.createBooleanAttribute(databaseId, collectionId, "exclude", false, false);
    await waitForAttribute(databases, databaseId, collectionId, "exclude");
    await databases.createBooleanAttribute(databaseId, collectionId, "radio", false, false);
    await waitForAttribute(databases, databaseId, collectionId, "radio");
    await databases.createIntegerAttribute(databaseId, collectionId, "cutDuration", false, -9223372036854776000, 9223372036854776000, false);
    await waitForAttribute(databases, databaseId, collectionId, "cutDuration");
    await databases.createStringAttribute(databaseId, collectionId, "cutSegments", 5000, false, false);
    await waitForAttribute(databases, databaseId, collectionId, "cutSegments");
    await databases.createStringAttribute(databaseId, collectionId, "cutStatus", 50, false, false);
    await waitForAttribute(databases, databaseId, collectionId, "cutStatus");
    await databases.createBooleanAttribute(databaseId, collectionId, "isAiCut", false, false);
    await waitForAttribute(databases, databaseId, collectionId, "isAiCut");
    await databases.createStringAttribute(databaseId, collectionId, "aiProcessing", 50, false, false);
    await waitForAttribute(databases, databaseId, collectionId, "aiProcessing");
    await databases.createBooleanAttribute(databaseId, collectionId, "aiTrain", false, false, false);
    await waitForAttribute(databases, databaseId, collectionId, "aiTrain");
    console.log("   ✅ All attributes created");
    
    // Create indexes
    console.log("   Creating indexes...");
    await databases.createIndex(databaseId, collectionId, "title_search", "fulltext", ["title"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await databases.createIndex(databaseId, collectionId, "youtubeId_unique", "unique", ["youtubeId"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await databases.createIndex(databaseId, collectionId, "uploadDate_desc", "key", ["uploadDate"], ["DESC"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await databases.createIndex(databaseId, collectionId, "reciterId_index", "key", ["channelId"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("   ✅ All indexes created");
    
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create Naats collection: ${error.message}`);
    throw error;
  }
}

// Create Channels collection
async function createChannelsCollection(databases, databaseId) {
  console.log("\n📦 Creating Channels collection...");
  
  try {
    const collectionId = "channels";
    
    // Create collection
    await databases.createCollection(
      databaseId,
      collectionId,
      "Channels",
      [
            "read(\"any\")"
      ],
      false
    );
    console.log(`✅ Collection created: ${collectionId}`);
    
    // Create attributes
    console.log("   Creating attributes...");
    await databases.createStringAttribute(databaseId, collectionId, "channelId", 255, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "channelId");
    await databases.createStringAttribute(databaseId, collectionId, "channelName", 255, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "channelName");
    await databases.createIntegerAttribute(databaseId, collectionId, "naatCount", false, 0, 9223372036854776000, 0, false);
    await waitForAttribute(databases, databaseId, collectionId, "naatCount");
    await databases.createDatetimeAttribute(databaseId, collectionId, "lastUpdated", false, false);
    await waitForAttribute(databases, databaseId, collectionId, "lastUpdated");
    await databases.createBooleanAttribute(databaseId, collectionId, "isOfficial", false, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "isOfficial");
    await databases.createBooleanAttribute(databaseId, collectionId, "isOther", false, false, false);
    await waitForAttribute(databases, databaseId, collectionId, "isOther");
    await databases.createStringAttribute(databaseId, collectionId, "type", 20, false, "channel", false);
    await waitForAttribute(databases, databaseId, collectionId, "type");
    await databases.createStringAttribute(databaseId, collectionId, "playlistId", 255, false, false);
    await waitForAttribute(databases, databaseId, collectionId, "playlistId");
    await databases.createBooleanAttribute(databaseId, collectionId, "isOWQ", true, false);
    await waitForAttribute(databases, databaseId, collectionId, "isOWQ");
    await databases.createBooleanAttribute(databaseId, collectionId, "isSpeech", true, false);
    await waitForAttribute(databases, databaseId, collectionId, "isSpeech");
    console.log("   ✅ All attributes created");
    
    // Create indexes
    console.log("   Creating indexes...");
    await databases.createIndex(databaseId, collectionId, "channelId_unique", "unique", ["channelId"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await databases.createIndex(databaseId, collectionId, "channelName_index", "key", ["channelName"], ["ASC"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("   ✅ All indexes created");
    
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create Channels collection: ${error.message}`);
    throw error;
  }
}

// Create Live Radio collection
async function createLiveRadioCollection(databases, databaseId) {
  console.log("\n📦 Creating Live Radio collection...");
  
  try {
    const collectionId = "live_radio";
    
    // Create collection
    await databases.createCollection(
      databaseId,
      collectionId,
      "Live Radio",
      [
            "read(\"any\")",
            "create(\"any\")",
            "update(\"any\")",
            "delete(\"any\")"
      ],
      false
    );
    console.log(`✅ Collection created: ${collectionId}`);
    
    // Create attributes
    console.log("   Creating attributes...");
    await databases.createStringAttribute(databaseId, collectionId, "playlist", 10000, true, true);
    await waitForAttribute(databases, databaseId, collectionId, "playlist");
    await databases.createStringAttribute(databaseId, collectionId, "updatedAt", 255, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "updatedAt");
    await databases.createIntegerAttribute(databaseId, collectionId, "currentTrackIndex", true, 0, 9223372036854776000, false);
    await waitForAttribute(databases, databaseId, collectionId, "currentTrackIndex");
    console.log("   ✅ All attributes created");
    
    // Create indexes
    console.log("   Creating indexes...");
    console.log("   ✅ All indexes created");
    
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create Live Radio collection: ${error.message}`);
    throw error;
  }
}

// Create User Radio States collection
async function createUserRadioStatesCollection(databases, databaseId) {
  console.log("\n📦 Creating User Radio States collection...");
  
  try {
    const collectionId = "user_radio_states";
    
    // Create collection
    await databases.createCollection(
      databaseId,
      collectionId,
      "User Radio States",
      [
            "read(\"any\")",
            "create(\"any\")",
            "update(\"any\")",
            "delete(\"any\")"
      ],
      false
    );
    console.log(`✅ Collection created: ${collectionId}`);
    
    // Create attributes
    console.log("   Creating attributes...");
    await databases.createStringAttribute(databaseId, collectionId, "userId", 255, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "userId");
    await databases.createIntegerAttribute(databaseId, collectionId, "currentTrackIndex", false, 0, 9223372036854776000, 0, false);
    await waitForAttribute(databases, databaseId, collectionId, "currentTrackIndex");
    await databases.createStringAttribute(databaseId, collectionId, "playlist", 10000, true, true);
    await waitForAttribute(databases, databaseId, collectionId, "playlist");
    await databases.createStringAttribute(databaseId, collectionId, "watchHistory", 10000, true, true);
    await waitForAttribute(databases, databaseId, collectionId, "watchHistory");
    await databases.createStringAttribute(databaseId, collectionId, "updatedAt", 255, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "updatedAt");
    console.log("   ✅ All attributes created");
    
    // Create indexes
    console.log("   Creating indexes...");
    console.log("   ✅ All indexes created");
    
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create User Radio States collection: ${error.message}`);
    throw error;
  }
}

// Create Live Radio Listeners collection
async function createLiveRadioListenersCollection(databases, databaseId) {
  console.log("\n📦 Creating Live Radio Listeners collection...");
  
  try {
    const collectionId = "live_radio_listeners";
    
    // Create collection
    await databases.createCollection(
      databaseId,
      collectionId,
      "Live Radio Listeners",
      [
            "read(\"any\")",
            "create(\"any\")",
            "update(\"any\")",
            "delete(\"any\")"
      ],
      false
    );
    console.log(`✅ Collection created: ${collectionId}`);
    
    // Create attributes
    console.log("   Creating attributes...");
    await databases.createStringAttribute(databaseId, collectionId, "lastHeartbeat", 255, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "lastHeartbeat");
    await databases.createStringAttribute(databaseId, collectionId, "deviceInfo", 500, false, false);
    await waitForAttribute(databases, databaseId, collectionId, "deviceInfo");
    console.log("   ✅ All attributes created");
    
    // Create indexes
    console.log("   Creating indexes...");
    await databases.createIndex(databaseId, collectionId, "lastHeartbeat_index", "key", ["lastHeartbeat"], ["ASC"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("   ✅ All indexes created");
    
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create Live Radio Listeners collection: ${error.message}`);
    throw error;
  }
}

// Create AI Jobs collection
async function createAIJobsCollection(databases, databaseId) {
  console.log("\n📦 Creating AI Jobs collection...");
  
  try {
    const collectionId = "ai_jobs";
    
    // Create collection
    await databases.createCollection(
      databaseId,
      collectionId,
      "AI Jobs",
      [],
      false
    );
    console.log(`✅ Collection created: ${collectionId}`);
    
    // Create attributes
    console.log("   Creating attributes...");
    await databases.createStringAttribute(databaseId, collectionId, "type", 64, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "type");
    await databases.createStringAttribute(databaseId, collectionId, "naatId", 64, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "naatId");
    await databases.createStringAttribute(databaseId, collectionId, "audioId", 64, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "audioId");
    await databases.createStringAttribute(databaseId, collectionId, "status", 32, true, false);
    await waitForAttribute(databases, databaseId, collectionId, "status");
    await databases.createIntegerAttribute(databaseId, collectionId, "progress", false, 0, 100, 0, false);
    await waitForAttribute(databases, databaseId, collectionId, "progress");
    await databases.createIntegerAttribute(databaseId, collectionId, "attempts", false, 0, 9223372036854776000, 0, false);
    await waitForAttribute(databases, databaseId, collectionId, "attempts");
    await databases.createStringAttribute(databaseId, collectionId, "workerId", 128, false, false);
    await waitForAttribute(databases, databaseId, collectionId, "workerId");
    await databases.createDatetimeAttribute(databaseId, collectionId, "leaseUntil", false, false);
    await waitForAttribute(databases, databaseId, collectionId, "leaseUntil");
    await databases.createStringAttribute(databaseId, collectionId, "error", 5000, false, false);
    await waitForAttribute(databases, databaseId, collectionId, "error");
    await databases.createStringAttribute(databaseId, collectionId, "resultJson", 50000000, false, false);
    await waitForAttribute(databases, databaseId, collectionId, "resultJson");
    await databases.createDatetimeAttribute(databaseId, collectionId, "startedAt", false, false);
    await waitForAttribute(databases, databaseId, collectionId, "startedAt");
    await databases.createDatetimeAttribute(databaseId, collectionId, "finishedAt", false, false);
    await waitForAttribute(databases, databaseId, collectionId, "finishedAt");
    console.log("   ✅ All attributes created");
    
    // Create indexes
    console.log("   Creating indexes...");
    await databases.createIndex(databaseId, collectionId, "type_status_created", "key", ["type","status","$createdAt"], ["ASC","ASC","ASC"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await databases.createIndex(databaseId, collectionId, "naatId_idx", "key", ["naatId"], ["ASC"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await databases.createIndex(databaseId, collectionId, "status_lease_idx", "key", ["status","leaseUntil"], ["ASC","ASC"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("   ✅ All indexes created");
    
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create AI Jobs collection: ${error.message}`);
    throw error;
  }
}

// Create Audio Files bucket
async function createAudioFilesBucket(storage) {
  console.log("\n🪣 Creating Audio Files bucket...");
  
  try {
    const bucketId = "audio-files";
    
    await storage.createBucket(
      bucketId,
      "Audio Files",
      [
            "read(\"any\")"
      ],
      false,
      true,
      200000000,
      undefined,
      "none",
      false,
      true
    );
    
    console.log(`✅ Bucket created: ${bucketId}`);
    return bucketId;
  } catch (error) {
    console.error(`❌ Failed to create Audio Files bucket: ${error.message}`);
    throw error;
  }
}

// Create temp-bucket bucket
async function createtempbucketBucket(storage) {
  console.log("\n🪣 Creating temp-bucket bucket...");
  
  try {
    const bucketId = "tempbucket";
    
    await storage.createBucket(
      bucketId,
      "temp-bucket",
      [
            "read(\"any\")"
      ],
      false,
      true,
      5000000000,
      ["m4a","mp3","mp4","aac","wav"],
      "none",
      true,
      true
    );
    
    console.log(`✅ Bucket created: ${bucketId}`);
    return bucketId;
  } catch (error) {
    console.error(`❌ Failed to create temp-bucket bucket: ${error.message}`);
    throw error;
  }
}

// Create Live Stream bucket
async function createLiveStreamBucket(storage) {
  console.log("\n🪣 Creating Live Stream bucket...");
  
  try {
    const bucketId = "live-stream";
    
    await storage.createBucket(
      bucketId,
      "Live Stream",
      [
            "read(\"any\")"
      ],
      false,
      true,
      5000000000,
      ["ts","m3u8","m4s"],
      "none",
      true,
      true
    );
    
    console.log(`✅ Bucket created: ${bucketId}`);
    return bucketId;
  } catch (error) {
    console.error(`❌ Failed to create Live Stream bucket: ${error.message}`);
    throw error;
  }
}

// Main setup function
async function setup() {
  console.log("🚀 Starting Appwrite Setup\n");
  console.log("═══════════════════════════════════════════════════════════");

  try {
    validateConfig();
    console.log("✅ Configuration validated");

    const { databases, storage } = initializeClients();
    console.log("✅ Clients initialized");

    // Create database
    const databaseId = await createDatabase(databases);

    // Create collections
    const naatsId = await createNaatsCollection(databases, databaseId);
    const channelsId = await createChannelsCollection(databases, databaseId);
    const liveradioId = await createLiveRadioCollection(databases, databaseId);
    const userradiostatesId = await createUserRadioStatesCollection(databases, databaseId);
    const liveradiolistenersId = await createLiveRadioListenersCollection(databases, databaseId);
    const aijobsId = await createAIJobsCollection(databases, databaseId);

    // Create buckets
    const audiofilesBucketId = await createAudioFilesBucket(storage);
    const tempbucketBucketId = await createtempbucketBucket(storage);
    const livestreamBucketId = await createLiveStreamBucket(storage);

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("🎉 Setup completed successfully!\n");
    console.log("📋 Summary:");
    console.log(`   Database ID: ${databaseId}`);
    console.log(`   Naats Collection ID: ${naatsId}`);
    console.log(`   Channels Collection ID: ${channelsId}`);
    console.log(`   Live Radio Collection ID: ${liveradioId}`);
    console.log(`   User Radio States Collection ID: ${userradiostatesId}`);
    console.log(`   Live Radio Listeners Collection ID: ${liveradiolistenersId}`);
    console.log(`   AI Jobs Collection ID: ${aijobsId}`);
    console.log(`   Audio Files Bucket ID: ${audiofilesBucketId}`);
    console.log(`   temp-bucket Bucket ID: ${tempbucketBucketId}`);
    console.log(`   Live Stream Bucket ID: ${livestreamBucketId}`);

    console.log("\n📝 Next steps:");
    console.log("   1. Update your .env.local file with the new IDs");
    console.log("   2. Verify the setup in Appwrite console");
    console.log("   3. Test your application");
    console.log("\n");
  } catch (error) {
    console.error("\n═══════════════════════════════════════════════════════════");
    console.error("❌ Setup failed:", error.message);
    process.exit(1);
  }
}

// Run setup
setup();
