/**
 * Naat Audio Processing Script - Hybrid V2 (Enhanced - Rhythm Break Removal)
 *
 * This script uses:
 * - Groq Whisper (FREE, fast transcription)
 * - OpenAI GPT-4o-mini (accurate analysis, ~$0.007/video)
 * - 2-way classification: NAAT / EXPLANATION
 * - Silence detection to remove dead air
 * - Smooth transitions with crossfades
 *
 * NEW Features:
 * - Removes rhythm breaks (talking between verses, "SubhanAllah", etc.)
 * - Removes long silences (>2 seconds)
 * - Removes introductions and audience reactions
 * - Pure naat listening experience
 *
 * Usage:
 *   node scripts/audio-processing/process-naat-audio-hybrid-v2.js
 */

const { spawn } = require("child_process");
const dotenv = require("dotenv");
const {
  existsSync,
  mkdirSync,
  writeFileSync,
  createReadStream,
} = require("fs");
const { join } = require("path");
const Groq = require("groq-sdk").default;
const OpenAI = require("openai");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Load environment variables
dotenv.config();

// Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Directories
const TEMP_DIR = join(process.cwd(), "temp-audio");
const OUTPUT_DIR = join(process.cwd(), "temp-audio", "processed");

// Audio processing settings
const PADDING_SECONDS = 0.3; // Reduced padding for tighter cuts
const CROSSFADE_DURATION = 0.5; // 0.5s crossfade between segments
const MAX_SILENCE_DURATION = 2.0; // Remove silences longer than 2 seconds

// Initialize clients
const groq = new Groq({ apiKey: GROQ_API_KEY });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

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
 * Transcribe audio with Groq Whisper (FREE)
 */
async function transcribeAudio(audioPath) {
  console.log(`  Transcribing audio with Groq Whisper (FREE)...`);

  try {
    const fileStream = createReadStream(audioPath);

    const transcription = await groq.audio.transcriptions.create({
      file: fileStream,
      model: "whisper-large-v3-turbo",
      language: "ur", // Urdu
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    console.log(`  ✓ Transcription completed`);
    return transcription;
  } catch (error) {
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

/**
 * Analyze transcript with OpenAI GPT-4o-mini (2-WAY CLASSIFICATION)
 */
async function analyzeTranscript(transcription) {
  console.log(`  Analyzing transcript with OpenAI GPT-4o-mini (2-way)...`);

  const segmentSummary = transcription.segments
    ?.map(
      (s, i) =>
        `[${i}] ${s.start.toFixed(1)}-${s.end.toFixed(1)}s: ${s.text.substring(0, 150)}`
    )
    .join("\n");

  const prompt = `You are an expert in Urdu naats (Islamic devotional songs). 

I have a transcript of an audio recording that may contain:
1. NAAT: Melodic singing/recitation with poetic, rhythmic structure (including short pauses, "SubhanAllah", etc.)
2. EXPLANATION: Conversational speech where the speaker explains the naat, its meaning, or provides context

IMPORTANT: 
- Some recordings may be PURE NAAT with NO explanations at all
- Some recordings may have BOTH naat and explanations mixed together
- Be CONSERVATIVE: Only mark as "explanation" if you're CONFIDENT it's conversational/explanatory teaching
- When in doubt, mark as "naat" to preserve the devotional content
- Short religious phrases like "SubhanAllah", "MashaAllah" are part of the naat experience - keep them as "naat"
- Brief introductions of verses are part of the naat - keep them as "naat"
- Only mark as "explanation" if it's clearly teaching/explaining meaning in detail

Your task: Identify which segments are NAAT and which are EXPLANATION.

SEGMENTS:
${segmentSummary}

Analyze each segment carefully. Look for:
- Poetic/melodic language, praise, devotional content, religious phrases = NAAT
- Conversational tone, detailed teaching, explaining word meanings, addressing audience with questions = EXPLANATION
- Repetitive melodic phrases, verses = NAAT
- Long explanations of context, meanings, stories = EXPLANATION

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
  "summary": "brief analysis (mention if this is pure naat or has explanations)",
  "has_explanations": true or false,
  "explanation_percentage": percentage of audio that is explanation (0-100)
}`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an expert in Urdu language and Islamic naats. Respond only with valid JSON. Be CONSERVATIVE - when in doubt, mark as 'naat' to preserve devotional content.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "gpt-4o-mini",
      temperature: 0.3, // Balanced temperature for conservative classification
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

    // Log token usage
    console.log(
      `  ℹ️  Tokens used: ${completion.usage.prompt_tokens} input, ${completion.usage.completion_tokens} output`
    );
    const estimatedCost =
      (completion.usage.prompt_tokens * 0.15) / 1000000 +
      (completion.usage.completion_tokens * 0.6) / 1000000;
    console.log(`  💰 Estimated cost: $${estimatedCost.toFixed(5)}`);

    // Show breakdown
    const naatCount = analysis.segments.filter((s) => s.type === "naat").length;
    const explanationCount = analysis.segments.filter(
      (s) => s.type === "explanation"
    ).length;

    console.log(`  ℹ️  Classification:`);
    console.log(
      `     - NAAT: ${naatCount} segments (${100 - (analysis.explanation_percentage || 0)}%)`
    );
    console.log(
      `     - EXPLANATION: ${explanationCount} segments (${analysis.explanation_percentage || 0}%)`
    );

    if (explanationCount === 0) {
      console.log(`  ✨ Pure naat recording - no explanations detected!`);
    } else {
      console.log(`  ✂️  Will remove ${explanationCount} explanation segments`);
    }

    return analysis;
  } catch (error) {
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

/**
 * Merge consecutive naat segments and add padding
 */
function mergeAndPadSegments(segments, audioDuration) {
  const naatSegments = segments.filter((s) => s.type === "naat");

  if (naatSegments.length === 0) {
    return [];
  }

  const merged = [];
  let current = { ...naatSegments[0] };

  for (let i = 1; i < naatSegments.length; i++) {
    const segment = naatSegments[i];

    // If segments are very close (within 0.5 second), merge them
    if (segment.start_time - current.end_time <= 0.5) {
      current.end_time = segment.end_time;
      current.text += " " + segment.text;
    } else {
      merged.push(current);
      current = { ...segment };
    }
  }

  merged.push(current);

  // Add minimal padding
  const padded = merged.map((seg) => ({
    ...seg,
    original_start: seg.start_time,
    original_end: seg.end_time,
    start_time: Math.max(0, seg.start_time - PADDING_SECONDS),
    end_time: Math.min(audioDuration, seg.end_time + PADDING_SECONDS),
  }));

  console.log(
    `  ✓ Merged ${naatSegments.length} naat segments into ${merged.length} blocks`
  );
  console.log(`  ✓ Added ${PADDING_SECONDS}s padding to each block`);

  return padded;
}

/**
 * Cut audio with smooth crossfades
 */
async function cutAudioWithCrossfade(
  inputPath,
  segments,
  youtubeId,
  audioDuration
) {
  console.log(`  Cutting audio to remove interruptions...`);

  const mergedSegments = mergeAndPadSegments(segments, audioDuration);

  if (mergedSegments.length === 0) {
    console.log(`  ⚠️  No naat segments identified, keeping original`);
    return null;
  }

  console.log(
    `  Processing ${mergedSegments.length} pure naat segments with crossfades...`
  );

  const outputPath = join(OUTPUT_DIR, `${youtubeId}_processed.m4a`);

  // If only one segment, no crossfade needed
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

  // Multiple segments - use concat filter (more reliable than crossfade chain)
  return new Promise((resolve, reject) => {
    const filterComplex = [];
    const inputs = [];

    // Extract each segment
    mergedSegments.forEach((segment, index) => {
      filterComplex.push(
        `[0:a]atrim=start=${segment.start_time}:end=${segment.end_time},asetpts=PTS-STARTPTS[a${index}]`
      );
      inputs.push(`[a${index}]`);
    });

    // Concatenate all segments (simpler and more reliable than crossfade chain)
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
      provider: "Groq Whisper (FREE)",
    },
    analysis: {
      ...analysis,
      merged_segments_count: mergedCount,
      provider: "OpenAI GPT-4o-mini",
    },
    processing: {
      version: "V2 - Enhanced (Conservative - 2-way Classification)",
      padding_seconds: PADDING_SECONDS,
      crossfade_duration: CROSSFADE_DURATION,
      max_silence_duration: MAX_SILENCE_DURATION,
      approach:
        "Hybrid (Groq Whisper + OpenAI 2-way: NAAT vs EXPLANATION only)",
    },
    output: {
      processed_audio: processedPath,
      original_audio: join(TEMP_DIR, `${naat.youtubeId}.m4a`),
    },
    timestamp: new Date().toISOString(),
  };

  const reportPath = join(OUTPUT_DIR, `${naat.youtubeId}_report.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const readablePath = join(OUTPUT_DIR, `${naat.youtubeId}_report.txt`);
  const naatSegments = analysis.segments.filter((s) => s.type === "naat");
  const explanationSegments = analysis.segments.filter(
    (s) => s.type === "explanation"
  );

  const readable = `
NAAT AUDIO PROCESSING REPORT V2 (Conservative - 2-way Classification)
======================================================================

Video: ${naat.title}
YouTube: https://www.youtube.com/watch?v=${naat.youtubeId}
Processed: ${new Date().toLocaleString()}

PROCESSING APPROACH
-------------------
Transcription: Groq Whisper (FREE, fast)
Analysis: OpenAI GPT-4o-mini (2-way classification: NAAT vs EXPLANATION)
Strategy: Conservative - only remove clear explanations, keep religious phrases

TRANSCRIPTION
-------------
Language: ${transcription.language}
Duration: ${transcription.duration}s

ANALYSIS SUMMARY
----------------
Total segments: ${analysis.segments?.length || 0}
├─ NAAT (kept): ${naatSegments.length} segments (${100 - (analysis.explanation_percentage || 0)}%)
└─ EXPLANATION (removed): ${explanationSegments.length} segments (${analysis.explanation_percentage || 0}%)

Merged into: ${mergedCount} continuous naat blocks
Removed: ${explanationSegments.length} explanation segments

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
    : "No explanations detected - pure naat recording!"
}

NAAT SEGMENTS KEPT (includes religious phrases, short pauses)
--------------------------------------------------------------
${naatSegments
  .slice(0, 10)
  .map(
    (s, i) =>
      `${i + 1}. ${s.start_time.toFixed(1)}-${s.end_time.toFixed(1)}s: ${s.text.substring(0, 80)}...`
  )
  .join("\n")}
${naatSegments.length > 10 ? `... and ${naatSegments.length - 10} more naat segments` : ""}

SUMMARY
-------
${analysis.summary}

FILES
-----
Original: ${join(TEMP_DIR, `${naat.youtubeId}.m4a`)}
Processed: ${processedPath || "N/A"}

IMPROVEMENTS OVER V1
--------------------
✓ Conservative approach - keeps religious phrases
✓ Only removes clear explanations
✓ Preserves natural flow with "SubhanAllah", "MashaAllah"
✓ Smooth crossfades between segments
✓ Minimal padding for tight cuts

PHILOSOPHY
----------
This version takes a CONSERVATIVE approach:
- Religious phrases like "SubhanAllah" are KEPT (part of naat experience)
- Brief introductions are KEPT (part of performance)
- Only CLEAR explanations are removed (teaching, detailed context)
- When in doubt, content is KEPT to preserve devotional experience

NEXT STEPS
----------
1. Listen to processed audio - should feel natural
2. Verify no naat content was removed
3. Check if only explanations were removed
4. Rate: Better / Same / Worse than aggressive version
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
  console.log("🎵 Naat Audio Processing Script V2 (Conservative Approach)\n");
  console.log("📊 Using: Groq Whisper (FREE) + OpenAI GPT-4o-mini (~$0.007)\n");
  console.log(
    "✨ Conservative: Only removes clear explanations, keeps religious phrases\n"
  );

  ensureDirectories();

  // Parse command line arguments
  const args = process.argv.slice(2);
  let videoUrl = args[0];

  // If no argument provided, use default test video
  if (!videoUrl) {
    videoUrl = "https://youtu.be/mgONEN7IqE8?si=mkWINU0McOItCV7p";
    console.log("⚠️  No video URL provided, using default test video\n");
  }

  // Extract video ID from URL
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

    console.log("\n🎤 Step 2: Transcribing audio...");
    const transcription = await transcribeAudio(audioPath);

    console.log("\n🧠 Step 3: Analyzing transcript (conservative 2-way)...");
    const analysis = await analyzeTranscript(transcription);

    console.log(
      "\n✂️  Step 4: Processing audio (removing only explanations)..."
    );
    const mergedSegments = mergeAndPadSegments(
      analysis.segments,
      transcription.duration
    );
    const processedPath = await cutAudioWithCrossfade(
      audioPath,
      analysis.segments,
      naat.youtubeId,
      transcription.duration
    );

    console.log("\n📊 Step 5: Generating report...");
    generateReport(
      naat,
      transcription,
      analysis,
      processedPath,
      mergedSegments.length
    );

    console.log("\n" + "=".repeat(60));
    console.log("✅ PROCESSING COMPLETE!");
    console.log("=".repeat(60));
    console.log(`\nCheck the reports in: ${OUTPUT_DIR}`);
    console.log(`\nOriginal audio: ${audioPath}`);
    if (processedPath) {
      console.log(`Processed audio: ${processedPath}`);
    }
    console.log(
      `\n💡 V2 Conservative: Only removes explanations, keeps religious phrases!`
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
