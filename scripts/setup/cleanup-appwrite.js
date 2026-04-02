/**
 * Cleanup Appwrite Script
 * 
 * Deletes all databases and buckets from the project
 * Use this to start fresh
 * 
 * Usage: node scripts/setup/cleanup-appwrite.js
 */

const { Client, Databases, Storage } = require("node-appwrite");
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

// Delete all databases
async function deleteAllDatabases(databases) {
  console.log("\n🗑️  Deleting all databases...");
  
  try {
    const databasesList = await databases.list();
    console.log(`Found ${databasesList.total} database(s)`);
    
    for (const db of databasesList.databases) {
      try {
        await databases.delete(db.$id);
        console.log(`   ✅ Deleted database: ${db.name} (${db.$id})`);
      } catch (error) {
        console.error(`   ❌ Failed to delete database ${db.$id}: ${error.message}`);
      }
    }
    
    console.log("✅ All databases deleted");
  } catch (error) {
    console.error(`❌ Failed to list databases: ${error.message}`);
    throw error;
  }
}

// Delete all buckets
async function deleteAllBuckets(storage) {
  console.log("\n🗑️  Deleting all buckets...");
  
  try {
    const bucketsList = await storage.listBuckets();
    console.log(`Found ${bucketsList.total} bucket(s)`);
    
    for (const bucket of bucketsList.buckets) {
      try {
        await storage.deleteBucket(bucket.$id);
        console.log(`   ✅ Deleted bucket: ${bucket.name} (${bucket.$id})`);
      } catch (error) {
        console.error(`   ❌ Failed to delete bucket ${bucket.$id}: ${error.message}`);
      }
    }
    
    console.log("✅ All buckets deleted");
  } catch (error) {
    console.error(`❌ Failed to list buckets: ${error.message}`);
    throw error;
  }
}

// Main cleanup function
async function cleanup() {
  console.log("🧹 Starting Appwrite Cleanup\n");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`\nProject: ${config.projectId}`);
  console.log(`Endpoint: ${config.endpoint}`);
  console.log("\n⚠️  WARNING: This will delete ALL databases and buckets!");
  console.log("═══════════════════════════════════════════════════════════");

  try {
    validateConfig();
    console.log("\n✅ Configuration validated");

    const { databases, storage } = initializeClients();
    console.log("✅ Clients initialized");

    // Delete everything
    await deleteAllDatabases(databases);
    await deleteAllBuckets(storage);

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("✅ CLEANUP COMPLETE");
    console.log("═══════════════════════════════════════════════════════════\n");
    console.log("You can now run the setup script:");
    console.log("   node scripts/setup/setup-appwrite-fixed.js");
    console.log("\n");
  } catch (error) {
    console.error("\n═══════════════════════════════════════════════════════════");
    console.error("❌ Cleanup failed:", error.message);
    process.exit(1);
  }
}

// Run cleanup
cleanup();
