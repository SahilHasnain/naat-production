/**
 * Naat Audio Processing Script
 *
 * This script:
 * 1. Fetches 1 test naat from database
 * 2. Downloads audio using yt-dlp
 * 3. Transcribes with Groq Whisper (Urdu support)
 * 4. Analyzes with Llama 3.1 to identify naat vs explanation segments
 * 5. Cuts audio to remove explanations
 * 6. Generates detailed report for accuracy testing
 *
 * Usage:
 *   node scripts/process-naat-audio.js [--video-id=YOUTUBE_ID]
 */

const { spawn } = require("child_process");
const dotenv = require("dotenv");
const {
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
} = require("fs");
const { Client, Databases, Query } = require("node-appwrite");
const { join } = require("path");
const Groq = require("groq-sdk").default;
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Load environment variables
dotenv.config();

// Configuration
const APPWRITE_ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID;
const NAATS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_NAATS_COLLECTION_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Parse command line arguments
const args = process.argv.slice(2);
const videoIdArg = args
  .find((arg) => arg.startsWith("--video-id="))
  ?.split("=")[1];

// Directories
const TEMP_DIR = join(process.cwd(), "temp-audio");
const OUTPUT_DIR = join(process.cwd(), "temp-audio", "processed");

// Initialize clients
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);
const groq = new Groq({ apiKey: GROQ_API_KEY });

/**
 * Ensure directories exist
 */
function ensureDirectories() {
  [TEMP_DIR, OUTPUT_DIR].forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`✓ Created directory: ${dir}`);
    }
  });
}

/**
 * Download audio using yt-dlp
 */
async function downloadAudio(youtubeId, title) {
  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
  const outputPath = join(TEMP_DIR, `${youtubeId}.m4a`);

  // Skip if already downloaded
  if (existsSync(outputPath)) {
    console.log(`  ✓ Audio already exists: ${outputPath}`);
    return outputPath;
  }

  console.log(`  Downloading: ${title}`);
  console.log(`  YouTube ID: ${youtubeId}`);

  return new Promise((resolve, reject) => {
    const ytdlp = spawn("yt-dlp", [
      "-f",
      "bestaudio[ext=m4a]/bestaudio",
      "--extract-audio",
      "--audio-format",
      "m4a",
      "--audio-quality",
      "128K",
      "-o",
      outputPath,
      "--no-playlist",
      `https://www.youtube.com/watch?v=${youtubeId}`,
    ]);

    let errorOutput = "";

    ytdlp.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    ytdlp.stdout.on("data", (data) => {
      process.stdout.write(".");
    });

    ytdlp.on("close", (code) => {
      console.log("");

      if (code === 0 && existsSync(outputPath)) {
        console.log(`  ✓ Downloaded successfully`);
        resolve(outputPath);
      } else {
        reject(new Error(`yt-dlp failed with code ${code}: ${errorOutput}`));
      }
    });

    ytdlp.on("error", (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

/**
 * Transcribe audio with Groq Whisper
 */
async function transcribeAudio(audioPath) {
  console.log(`  Transcribing audio with Groq Whisper...`);

  try {
    const fs = require("fs");
    const fileStream = fs.createReadStream(audioPath);

    const transcription = await groq.audio.transcriptions.create({
      file: fileStream,
      model: "whisper-large-v3-turbo",
      language: "ur", // Urdu
      response_format: "verbose_json",
      timestamp_granularities: ["segment"], // Changed from "word" to "segment" for better memory usage
    });

    console.log(`  ✓ Transcription completed`);
    return transcription;
  } catch (error) {
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

/**
 * Analyze transcript with Llama 3.1 to identify segments
 */
async function analyzeTranscript(transcription) {
  console.log(`  Analyzing transcript with Llama 3.3...`);

  // Limit segments to reduce token usage - only send first 150 chars of each segment
  const segmentSummary = transcription.segments
    ?.map(
      (s, i) =>
        `[${i}] ${s.start.toFixed(1)}-${s.end.toFixed(1)}s: ${s.text.substring(0, 150)}`
    )
    .join("\n");

  const prompt = `You are an expert in Urdu naats (Islamic devotional songs). 

I have a transcript of an audio recording that contains both:
1. NAAT: Melodic singing/recitation with poetic, rhythmic structure
2. EXPLANATION: Conversational speech where the speaker explains the naat, its meaning, or provides context

Your task: Identify which segments are NAAT and which are EXPLANATION.

SEGMENTS:
${segmentSummary}

Analyze each segment. Look for:
- Poetic/melodic language = NAAT
- Conversational/explanatory language = EXPLANATION

Respond in JSON format:
{
  "segments": [
    {
      "segment_index": 0,
      "type": "naat" or "explanation",
      "start_time": seconds,
      "end_time": seconds,
      "confidence": "high/medium/low",
      "reasoning": "brief reason"
    }
  ],
  "summary": "brief analysis"
}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an expert in Urdu language and Islamic naats. Respond only with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const analysis = JSON.parse(completion.choices[0].message.content);

    // Enrich segments with full text from transcription
    if (analysis.segments && transcription.segments) {
      analysis.segments = analysis.segments.map((seg) => ({
        ...seg,
        text: transcription.segments[seg.segment_index]?.text || "",
      }));
    }

    console.log(
      `  ✓ Analysis completed: ${analysis.segments?.length || 0} segments identified`
    );
    return analysis;
  } catch (error) {
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

/**
 * Cut audio based on segments
 */
async function cutAudio(inputPath, segments, youtubeId) {
  console.log(`  Cutting audio to remove explanations...`);

  const naatSegments = segments.filter((s) => s.type === "naat");

  if (naatSegments.length === 0) {
    console.log(`  ⚠️  No naat segments identified, keeping original`);
    return null;
  }

  const outputPath = join(OUTPUT_DIR, `${youtubeId}_processed.m4a`);
  const filterComplex = [];
  const inputs = [];

  // Build ffmpeg filter for each naat segment
  naatSegments.forEach((segment, index) => {
    filterComplex.push(
      `[0:a]atrim=start=${segment.start_time}:end=${segment.end_time},asetpts=PTS-STARTPTS[a${index}]`
    );
    inputs.push(`[a${index}]`);
  });

  // Concatenate all segments
  filterComplex.push(
    `${inputs.join("")}concat=n=${naatSegments.length}:v=0:a=1[out]`
  );

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .complexFilter(filterComplex)
      .outputOptions(["-map", "[out]"])
      .output(outputPath)
      .on("end", () => {
        console.log(`  ✓ Audio cut successfully`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .run();
  });
}

/**
 * Generate report
 */
function generateReport(naat, transcription, analysis, processedPath) {
  const report = {
    video: {
      title: naat.title,
      youtubeId: naat.youtubeId,
      url: `https://www.youtube.com/watch?v=${naat.youtubeId}`,
    },
    transcription: {
      language: transcription.language,
      duration: transcription.duration,
      text: transcription.text,
      word_count: transcription.words?.length || 0,
    },
    analysis: analysis,
    output: {
      processed_audio: processedPath,
      original_audio: join(TEMP_DIR, `${naat.youtubeId}.m4a`),
    },
    timestamp: new Date().toISOString(),
  };

  const reportPath = join(OUTPUT_DIR, `${naat.youtubeId}_report.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Also create a human-readable version
  const readablePath = join(OUTPUT_DIR, `${naat.youtubeId}_report.txt`);
  const readable = `
NAAT AUDIO PROCESSING REPORT
============================

Video: ${naat.title}
YouTube: https://www.youtube.com/watch?v=${naat.youtubeId}
Processed: ${new Date().toLocaleString()}

TRANSCRIPTION
-------------
Language: ${transcription.language}
Duration: ${transcription.duration}s
Text: ${transcription.text}

SEGMENTS IDENTIFIED
-------------------
${analysis.segments
  ?.map(
    (s, i) => `
${i + 1}. ${s.type.toUpperCase()} (${s.start_time}s - ${s.end_time}s)
   Confidence: ${s.confidence}
   Text: ${s.text}
   Reasoning: ${s.reasoning}
`
  )
  .join("\n")}

SUMMARY
-------
${analysis.summary}

FILES
-----
Original: ${join(TEMP_DIR, `${naat.youtubeId}.m4a`)}
Processed: ${processedPath || "N/A"}

NEXT STEPS
----------
1. Listen to both original and processed audio
2. Verify if explanations were correctly identified
3. Check if naat segments are complete
4. Rate accuracy: High / Medium / Low
`;

  writeFileSync(readablePath, readable);

  console.log(`\n✓ Reports generated:`);
  console.log(`  JSON: ${reportPath}`);
  console.log(`  Text: ${readablePath}`);
}

/**
 * Main function
 */
async function main() {
  console.log("🎵 Naat Audio Processing Script\n");

  // Ensure directories
  ensureDirectories();

  // HARDCODED TEST VIDEO
  const TEST_VIDEO_URL = "https://youtu.be/mgONEN7IqE8?si=jXaaAsJBQyyimHo9";
  const TEST_VIDEO_ID = "mgONEN7IqE8";

  console.log("📥 Using hardcoded test video...");

  const naat = {
    youtubeId: TEST_VIDEO_ID,
    title: "Test Naat 2 - Hardcoded",
    $id: "test-" + TEST_VIDEO_ID,
  };

  console.log(`✓ Video URL: ${TEST_VIDEO_URL}`);
  console.log(`✓ Video ID: ${TEST_VIDEO_ID}\n`);

  try {
    // Step 1: Download
    console.log("📥 Step 1: Downloading audio...");
    const audioPath = await downloadAudio(naat.youtubeId, naat.title);

    // Step 2: Transcribe
    console.log("\n🎤 Step 2: Transcribing audio...");
    const transcription = await transcribeAudio(audioPath);

    // Step 3: Analyze
    console.log("\n🧠 Step 3: Analyzing transcript...");
    const analysis = await analyzeTranscript(transcription);

    // Step 4: Cut audio
    console.log("\n✂️  Step 4: Processing audio...");
    const processedPath = await cutAudio(
      audioPath,
      analysis.segments,
      naat.youtubeId
    );

    // Step 5: Generate report
    console.log("\n📊 Step 5: Generating report...");
    generateReport(naat, transcription, analysis, processedPath);

    console.log("\n" + "=".repeat(60));
    console.log("✅ PROCESSING COMPLETE!");
    console.log("=".repeat(60));
    console.log(`\nCheck the reports in: ${OUTPUT_DIR}`);
    console.log(`\nOriginal audio: ${audioPath}`);
    if (processedPath) {
      console.log(`Processed audio: ${processedPath}`);
    }
    console.log(
      `\n💡 Listen to both files and review the report to assess accuracy.`
    );
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
