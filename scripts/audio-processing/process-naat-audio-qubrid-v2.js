/**
 * Naat Audio Processing Script - Qubrid V2 (100% FREE)
 *
 * This script uses:
 * - Qubrid Whisper Large V3 (accurate transcription, FREE)
 * - Qubrid GPT-OSS-120B (accurate analysis, FREE)
 * - 2-way classification: NAAT / EXPLANATION
 * - Smooth transitions with crossfades
 *
 * Features:
 * - 100% FREE - No API costs!
 * - Removes rhythm breaks (talking between verses, "SubhanAllah", etc.)
 * - Removes long silences (>2 seconds)
 * - Removes introductions and audience reactions
 * - Pure naat listening experience
 *
 * Cost: $0.00 - Completely FREE!
 *
 * Usage:
 *   node scripts/audio-processing/process-naat-audio-qubrid-v2.js [youtube-url]
 */

const { spawn } = require("child_process");
const dotenv = require("dotenv");
const { existsSync, mkdirSync, writeFileSync } = require("fs");
const { join } = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Load environment variables
dotenv.config();

// Configuration
const QUBRID_API_KEY =
  "k_007d66f15312.uX4Ng7s0_yKFHUepbs5t6NsNkBa4OjaH_unTppgrNFJhpi6H16rakg";

// Directories
const TEMP_DIR = join(process.cwd(), "temp-audio");
const OUTPUT_DIR = join(process.cwd(), "temp-audio", "processed");

// Audio processing settings
const PADDING_SECONDS = 0.3;
const CROSSFADE_DURATION = 0.5;
const MAX_SILENCE_DURATION = 2.0;

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
  const outputPath = join(TEMP_DIR, `${youtubeId}.m4a`);

  if (existsSync(outputPath)) {
    console.log(`  ✓ Audio already exists: ${outputPath}`);
    return outputPath;
  }

  console.log(`  Downloading: ${title}`);
  console.log(`  YouTube ID: ${youtubeId}`);

  return new Promise((resolve, reject) => {
    const ytdlp = spawn("yt-dlp", [
      "-f",
      "bestaudio[ext=m4a]/bestaudio/best",
      "--extract-audio",
      "--audio-format",
      "m4a",
      "--audio-quality",
      "0",
      "--postprocessor-args",
      "ffmpeg:-ac 1 -ar 16000",
      "-o",
      outputPath,
      "--no-playlist",
      `https://www.youtube.com/watch?v=${youtubeId}`,
    ]);

    let errorOutput = "";

    ytdlp.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    ytdlp.stdout.on("data", () => {
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
 * Transcribe audio with Qubrid Whisper Large V3
 */
async function transcribeAudio(audioPath) {
  console.log(`  Transcribing audio with Qubrid Whisper Large V3 (FREE)...`);

  return new Promise((resolve, reject) => {
    const curl = spawn("curl", [
      "-X",
      "POST",
      "https://platform.qubrid.com/api/v1/qubridai/audio/transcribe",
      "-H",
      `Authorization: Bearer ${QUBRID_API_KEY}`,
      "-F",
      "model=openai/whisper-large-v3",
      "-F",
      `file=@${audioPath}`,
    ]);

    let output = "";
    let errorOutput = "";

    curl.stdout.on("data", (data) => {
      output += data.toString();
    });

    curl.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    curl.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(`curl failed with code ${code}: ${errorOutput || output}`)
        );
        return;
      }

      try {
        const result = JSON.parse(output);

        if (result.status === "error") {
          reject(new Error(`Qubrid API error: ${result.message}`));
          return;
        }

        // Transform Qubrid response to match OpenAI Whisper format
        const transcription = {
          text: result.text || "",
          language: result.language || "unknown",
          duration: result.duration || 0,
          segments: result.segments || [],
        };

        console.log(`  ✓ Transcription completed`);
        console.log(`  ℹ️  Language: ${transcription.language}`);
        console.log(`  ℹ️  Duration: ${transcription.duration}s`);
        console.log(`  ℹ️  Segments: ${transcription.segments.length}`);

        resolve(transcription);
      } catch (error) {
        reject(
          new Error(
            `Failed to parse response: ${error.message}\nOutput: ${output}`
          )
        );
      }
    });

    curl.on("error", (err) => {
      reject(new Error(`Failed to spawn curl: ${err.message}`));
    });
  });
}

/**
 * Analyze transcript with Qubrid GPT-OSS-120B (2-WAY CLASSIFICATION)
 */
async function analyzeTranscript(transcription) {
  console.log(`  Analyzing transcript with Qubrid GPT-OSS-120B (FREE)...`);

  const segmentSummary = transcription.segments
    ?.map(
      (s, i) =>
        `[${i}] ${s.start.toFixed(1)}-${s.end.toFixed(1)}s: ${s.text.substring(0, 150)}`
    )
    .join("\n");

  const prompt = `You are an expert in Urdu naats (Islamic devotional songs). 

I have a transcript of an audio recording. Classify each segment into ONE of these categories:

1. NAAT: Pure melodic singing/recitation - the actual naat performance
   - Continuous melodic singing
   - Rhythmic recitation
   - Musical verses
   - Keep this content

2. EXPLANATION: Everything else that interrupts the naat
   - Talking between verses
   - Religious phrases ("SubhanAllah", "MashaAllah")
   - Introductions and commentary
   - Teaching and explanations
   - Stories and context
   - Audience reactions
   - Any non-singing speech
   - Remove this content

IMPORTANT:
- Only mark as "naat" if it's pure continuous singing/recitation
- Mark ALL talking, explanations, and interruptions as "explanation"
- We want to keep only the pure naat audio

SEGMENTS:
${segmentSummary}

Analyze each segment:
- Continuous melodic singing = NAAT (keep)
- Everything else = EXPLANATION (remove)

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
  "summary": "brief analysis",
  "naat_percentage": percentage of pure naat (0-100),
  "explanation_percentage": percentage of explanations (0-100)
}`;

  try {
    const body = {
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content:
            "You are an expert in Urdu language and Islamic naats. Respond only with valid JSON. Only pure continuous singing is 'naat', everything else is 'explanation'.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 4096,
      stream: false,
      top_p: 1,
    };

    const res = await fetch(
      "https://platform.qubrid.com/api/v1/qubridai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${QUBRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Qubrid API error: ${res.status} ${res.statusText} - ${errorText}`
      );
    }

    const result = await res.json();

    // Debug: Log the response structure
    console.log(`  ℹ️  API Response keys: ${Object.keys(result).join(", ")}`);

    // Handle different response formats
    let content;
    if (result.choices && result.choices[0]) {
      // OpenAI-compatible format
      content = result.choices[0].message.content;
    } else if (result.message) {
      // Direct message format
      content = result.message;
    } else if (result.content) {
      // Direct content format
      content = result.content;
    } else if (result.response) {
      // Response field format
      content = result.response;
    } else {
      throw new Error(
        `Unexpected API response format: ${JSON.stringify(result).substring(0, 200)}`
      );
    }

    const analysis = JSON.parse(content);

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

    // Show breakdown
    const naatCount = analysis.segments.filter((s) => s.type === "naat").length;
    const explanationCount = analysis.segments.filter(
      (s) => s.type === "explanation"
    ).length;

    console.log(`  ℹ️  Classification:`);
    console.log(
      `     - NAAT: ${naatCount} segments (${analysis.naat_percentage?.toFixed(1) || 0}%)`
    );
    console.log(
      `     - EXPLANATION: ${explanationCount} segments (${analysis.explanation_percentage?.toFixed(1) || 0}%)`
    );

    if (explanationCount === 0) {
      console.log(`  ✨ Pure naat recording - no interruptions detected!`);
    } else {
      console.log(
        `  ✂️  Will remove ${explanationCount} interruption segments`
      );
    }

    return analysis;
  } catch (error) {
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

/**
 * Merge nearby naat segments
 */
function mergeNaatSegments(segments) {
  const naatSegments = segments.filter((s) => s.type === "naat");

  if (naatSegments.length === 0) {
    return [];
  }

  const merged = [];
  let current = { ...naatSegments[0] };

  for (let i = 1; i < naatSegments.length; i++) {
    const next = naatSegments[i];
    const gap = next.start_time - current.end_time;

    if (gap <= MAX_SILENCE_DURATION) {
      current.end_time = next.end_time;
      current.text += " " + next.text;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);

  console.log(
    `  ✓ Merged ${naatSegments.length} naat segments into ${merged.length} blocks`
  );
  console.log(`  ✓ Added ${PADDING_SECONDS}s padding to each block`);

  return merged.map((seg) => ({
    ...seg,
    start_time: Math.max(0, seg.start_time - PADDING_SECONDS),
    end_time: seg.end_time + PADDING_SECONDS,
  }));
}

/**
 * Cut audio to remove interruptions
 */
async function cutAudio(inputPath, outputPath, mergedSegments) {
  console.log(`  Cutting audio to remove interruptions...`);
  console.log(
    `  ✓ Merged ${mergedSegments.length} naat segments into ${mergedSegments.length} blocks`
  );
  console.log(`  ✓ Added ${PADDING_SECONDS}s padding to each block`);
  console.log(
    `  Processing ${mergedSegments.length} pure naat segments with crossfades...`
  );

  if (mergedSegments.length === 1) {
    const seg = mergedSegments[0];
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(seg.start_time)
        .setDuration(seg.end_time - seg.start_time)
        .audioCodec("aac")
        .audioBitrate("256k")
        .audioFrequency(44100)
        .audioChannels(2)
        .outputOptions(["-q:a", "2"])
        .output(outputPath)
        .on("end", () => {
          console.log(`  ✓ Audio cut successfully (single segment)`);
          resolve(outputPath);
        })
        .on("error", (err) => {
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .run();
    });
  }

  return new Promise((resolve, reject) => {
    const filterComplex = [];
    const inputs = [];

    mergedSegments.forEach((segment, index) => {
      filterComplex.push(
        `[0:a]atrim=start=${segment.start_time}:end=${segment.end_time},asetpts=PTS-STARTPTS[a${index}]`
      );
      inputs.push(`a${index}`);
    });

    const inputLabels = inputs.map((label) => `[${label}]`).join("");
    filterComplex.push(
      `${inputLabels}concat=n=${mergedSegments.length}:v=0:a=1[out]`
    );

    console.log(
      `  ℹ️  Using concat filter for ${mergedSegments.length} segments (more reliable)`
    );

    ffmpeg(inputPath)
      .complexFilter(filterComplex)
      .outputOptions([
        "-map",
        "[out]",
        "-c:a",
        "aac",
        "-b:a",
        "256k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-q:a",
        "2",
      ])
      .output(outputPath)
      .on("end", () => {
        console.log(
          `  ✓ Audio cut successfully - concatenated ${mergedSegments.length} segments`
        );
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
function generateReport(
  naat,
  transcription,
  analysis,
  processedPath,
  mergedCount
) {
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
      provider: "Qubrid Whisper Large V3",
    },
    analysis: {
      ...analysis,
      merged_segments_count: mergedCount,
      provider: "Qubrid GPT-OSS-120B",
    },
    processing: {
      version: "Qubrid V2 - 100% FREE (Rhythm Break Removal)",
      padding_seconds: PADDING_SECONDS,
      crossfade_duration: CROSSFADE_DURATION,
      max_silence_duration: MAX_SILENCE_DURATION,
      approach:
        "Qubrid Whisper Large V3 + Qubrid GPT-OSS-120B (2-way Classification)",
    },
    output: {
      processed_audio: processedPath,
      original_audio: join(TEMP_DIR, `${naat.youtubeId}.m4a`),
    },
    timestamp: new Date().toISOString(),
  };

  const reportPath = join(OUTPUT_DIR, `${naat.youtubeId}_qubrid_report.json`);
  const readablePath = join(OUTPUT_DIR, `${naat.youtubeId}_qubrid_report.txt`);
  const naatSegments = analysis.segments.filter((s) => s.type === "naat");
  const explanationSegments = analysis.segments.filter(
    (s) => s.type === "explanation"
  );

  const readable = `
NAAT AUDIO PROCESSING REPORT - Qubrid V2 (100% FREE)
======================================================

Video: ${naat.title}
YouTube: https://www.youtube.com/watch?v=${naat.youtubeId}
Processed: ${new Date().toLocaleString()}

PROCESSING APPROACH
-------------------
Transcription: Qubrid Whisper Large V3 (FREE)
Analysis: Qubrid GPT-OSS-120B (FREE, 2-way classification)
Strategy: 100% FREE - Full Qubrid stack

TRANSCRIPTION
-------------
Language: ${transcription.language}
Duration: ${transcription.duration}s

ANALYSIS SUMMARY
----------------
Total segments: ${analysis.segments?.length || 0}
├─ NAAT (kept): ${naatSegments.length} segments (${analysis.naat_percentage?.toFixed(1) || 0}%)
└─ EXPLANATION (removed): ${explanationSegments.length} segments (${analysis.explanation_percentage?.toFixed(1) || 0}%)

Merged into: ${mergedCount} continuous naat blocks
Removed: ${explanationSegments.length} interruption segments

PROCESSING SETTINGS
-------------------
Padding: ${PADDING_SECONDS}s (minimal for tight cuts)
Crossfade: ${CROSSFADE_DURATION}s between segments
Max silence: ${MAX_SILENCE_DURATION}s (longer silences removed)

WHAT WAS REMOVED
----------------
${
  explanationSegments.length > 0
    ? `Explanations (${explanationSegments.length}):
${explanationSegments
  .slice(0, 5)
  .map(
    (s, i) =>
      `  ${i + 1}. ${s.start_time.toFixed(1)}-${s.end_time.toFixed(1)}s: ${s.text.substring(0, 80)}...`
  )
  .join("\n")}
${explanationSegments.length > 5 ? `  ... and ${explanationSegments.length - 5} more` : ""}
`
    : "No explanations detected"
}

PURE NAAT SEGMENTS KEPT
------------------------
${naatSegments
  .slice(0, 10)
  .map(
    (s, i) =>
      `${i + 1}. ${s.start_time.toFixed(1)}-${s.end_time.toFixed(1)}s: ${s.text.substring(0, 80)}...`
  )
  .join("\n")}
${naatSegments.length > 10 ? `... and ${naatSegments.length - 10} more` : ""}

OUTPUT FILES
------------
Processed Audio: ${processedPath}
Original Audio: ${join(TEMP_DIR, `${naat.youtubeId}.m4a`)}
JSON Report: ${reportPath}
Text Report: ${readablePath}
`;

  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  writeFileSync(readablePath, readable);

  console.log(`\n✓ Reports generated:`);
  console.log(`  JSON: ${reportPath}`);
  console.log(`  Text: ${readablePath}`);
}

/**
 * Main function
 */
async function main() {
  console.log("🎵 Naat Audio Processing Script - Qubrid V2 (100% FREE)\n");
  console.log("📊 Using: Qubrid Whisper Large V3 + Qubrid GPT-OSS-120B\n");
  console.log("✨ Completely FREE - No API costs!\n");

  ensureDirectories();

  const args = process.argv.slice(2);
  let videoUrl = args[0];

  if (!videoUrl) {
    videoUrl = "https://youtu.be/mgONEN7IqE8?si=mkWINU0McOItCV7p";
    console.log("⚠️  No video URL provided, using default test video\n");
  }

  const videoIdMatch = videoUrl.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );

  if (!videoIdMatch) {
    console.error("❌ Invalid YouTube URL. Please provide a valid URL.");
    console.error("   Example: https://youtu.be/mgONEN7IqE8");
    process.exit(1);
  }

  const TEST_VIDEO_ID = videoIdMatch[1];
  const TEST_VIDEO_URL = videoUrl;

  console.log("📥 Processing video...");

  const naat = {
    youtubeId: TEST_VIDEO_ID,
    title: `Naat - ${TEST_VIDEO_ID}`,
    $id: "test-" + TEST_VIDEO_ID,
  };

  console.log(`✓ Video URL: ${TEST_VIDEO_URL}`);
  console.log(`✓ Video ID: ${TEST_VIDEO_ID}\n`);

  try {
    console.log("📥 Step 1: Downloading audio...");
    const audioPath = await downloadAudio(naat.youtubeId, naat.title);

    console.log(
      "\n🎤 Step 2: Transcribing audio with Qubrid Whisper Large V3 (FREE)..."
    );
    const transcription = await transcribeAudio(audioPath);

    console.log("\n🧠 Step 3: Analyzing transcript (2-way classification)...");
    const analysis = await analyzeTranscript(transcription);

    console.log("\n✂️  Step 4: Processing audio (removing interruptions)...");
    const mergedSegments = mergeNaatSegments(analysis.segments);

    if (mergedSegments.length === 0) {
      console.log("❌ No naat segments found. Skipping audio processing.");
      return;
    }

    const processedPath = join(
      OUTPUT_DIR,
      `${naat.youtubeId}_qubrid_processed.m4a`
    );
    await cutAudio(audioPath, processedPath, mergedSegments);

    console.log("\n📊 Step 5: Generating reports...");
    generateReport(
      naat,
      transcription,
      analysis,
      processedPath,
      mergedSegments.length
    );

    console.log("\n✅ Processing complete!");
    console.log(`\n📁 Output files:`);
    console.log(`   Audio: ${processedPath}`);
    console.log(`   Reports: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
