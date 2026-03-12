const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { exec, spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
require('dotenv').config();

// ── In-memory burn job store ──────────────────────────────────────────────────
const burnJobs = new Map();
// shape: { status: 'pending'|'burning'|'done'|'error', progress: 0-100, outputFile: null|string, error: null|string }

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3001;

console.log('Server starting/restarting...');

// Simple logger
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Serve uploaded files statically
// Serve uploaded files statically with CORS headers
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// Middleware - Explicit CORS handling
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://genuine-manifestation-production.up.railway.app',
    'http://localhost:3000'
  ];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else {
    // For debugging, log denied origin
    if (origin) log(`Warn: CORS denied for origin: ${origin}`);
    res.header('Access-Control-Allow-Origin', '*'); // Fallback to * for deployment flexibility
  }

  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: PORT
    }
  });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const originalPath = req.file.path;
  const ext = path.extname(req.file.filename).toLowerCase();
  const uploadDir = path.join(__dirname, '../uploads');

  // Compress video to 720p / CRF-28 / AAC-128k to reduce storage & streaming time.
  // Audio-only files get re-encoded to mono MP3 128k.
  // The compressed output replaces the original so all downstream code is unchanged.
  const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
  const isAudio = ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac'].includes(ext);

  if (isVideo || isAudio) {
    const compressedName = `compressed_${req.file.filename}${isAudio && ext !== '.mp3' ? '.mp3' : ''}`;
    const compressedPath = path.join(uploadDir, compressedName);

    try {
      log(`Compressing ${req.file.filename} ...`);
      await new Promise((resolve, reject) => {
        let cmd = ffmpeg(originalPath);
        if (isVideo) {
          cmd = cmd
            .videoCodec('libx264')
            .addOptions([
              '-crf 28',           // quality — lower = bigger; 28 is good balance
              '-preset fast',      // encoding speed
              '-vf scale=\'min(1280,iw)\':\'min(720,ih)\':force_original_aspect_ratio=decrease', // max 720p
              '-movflags +faststart', // web-optimised: moov atom at front for fast streaming
            ])
            .audioCodec('aac')
            .audioBitrate('128k')
            .audioChannels(2);
        } else {
          // Audio-only: normalise to mono MP3 128k — Whisper doesn't need stereo
          cmd = cmd.audioCodec('libmp3lame').audioBitrate('128k').audioChannels(1);
        }
        cmd
          .on('end', resolve)
          .on('error', reject)
          .save(compressedPath);
      });

      // Swap files: delete original, rename compressed to original name
      fs.unlinkSync(originalPath);
      fs.renameSync(compressedPath, originalPath);

      const stats = fs.statSync(originalPath);
      log(`Compression done — ${req.file.filename} is now ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
    } catch (compErr) {
      // If compression fails, proceed with the original (don't block the user)
      log(`Compression failed for ${req.file.filename}: ${compErr.message} — using original`);
      if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath);
    }
  }

  res.json({
    message: 'File uploaded and compressed successfully',
    filename: req.file.filename,
    path: req.file.path,
  });
});


app.post('/api/transcribe', async (req, res) => {
  const { filename, language, model } = req.body;

  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const filePath = path.join(__dirname, '../uploads', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    log(`Starting transcription for ${filename}...`);

    let audioPath = filePath;
    let needsCleanup = false;

    // Check if file is video or large audio and needs conversion
    const ext = path.extname(filename).toLowerCase();
    if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) {
      log('Video file detected. Extracting audio...');
      audioPath = path.join(__dirname, '../uploads', `${path.basename(filename, ext)}.mp3`);

      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .toFormat('mp3')
          .on('end', () => {
            log('Audio extraction complete.');
            resolve();
          })
          .on('error', (err) => {
            console.error('ffmpeg conversion error', err);
            reject(err);
          })
          .save(audioPath);
      });
      needsCleanup = true;
    }

    // Start local transcription with Whisper (Python)
    log('Starting local transcription with Whisper (Python)...');

    // Path to python script
    const scriptPath = path.join(__dirname, 'transcribe.py');
    // Pass language if provided, otherwise "auto"
    const langArg = language || 'auto';
    // Use provided model or default to 'base'
    const modelArg = model || 'base';
    // Prompt
    const promptArg = req.body.prompt || '';
    // Task (transcribe vs translate)
    const taskArg = req.body.task || 'transcribe';

    log(`Model: ${modelArg}, Language: ${langArg}, Prompt: ${promptArg}, Task: ${taskArg}`);

    // Escape prompt carefully for shell
    const safePrompt = promptArg.replace(/"/g, '\\"');
    const command = `python3 "${scriptPath}" "${audioPath}" "${modelArg}" "${langArg}" "${safePrompt}" "${taskArg}"`;

    // Ensure python (and whisper) can find ffmpeg
    const ffmpegDir = path.dirname(ffmpegPath);
    const env = { ...process.env, PATH: `${process.env.PATH};${ffmpegDir}` };

    const transcription = await new Promise((resolve, reject) => {
      exec(command, { maxBuffer: 1024 * 1024 * 10, env }, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          reject(error);
          return;
        }
        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        } catch (e) {
          console.error('Failed to parse Python output:', stdout);
          reject(e);
        }
      });
    });

    if (needsCleanup) {
      fs.unlinkSync(audioPath);
    }

    log('Transcription complete');

    res.json({
      text: transcription.text,
      words: transcription.words, // Array of { word, start, end }
      duration: transcription.duration
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Transcription failed', details: error.message });
  }
});

// ── Async burn job runner ─────────────────────────────────────────────────────
async function runBurnJob(jobId, { filename, transcript, styleConfig }) {
  const uploadsDir = path.join(__dirname, '../uploads');
  const tempJsonPath = path.join(uploadsDir, `burn_request_${jobId}.json`);
  const scriptPath = path.join(__dirname, 'burn.py');
  const ffmpegDir = path.dirname(ffmpegPath);
  const env = { ...process.env, PATH: `${process.env.PATH};${ffmpegDir}` };

  try {
    burnJobs.set(jobId, { status: 'burning', progress: 10, outputFile: null, error: null });

    const inputPath = path.join(uploadsDir, filename);

    // Get video duration for progress calculation
    let totalDuration = null;
    try {
      totalDuration = await new Promise((resolve) => {
        ffmpeg.ffprobe(inputPath, (err, meta) => {
          if (err || !meta) return resolve(null);
          resolve(meta.format?.duration || null);
        });
      });
    } catch (_) { /* ignore */ }

    fs.writeFileSync(tempJsonPath, JSON.stringify({ filename, transcript, styleConfig }));
    burnJobs.set(jobId, { status: 'burning', progress: 20, outputFile: null, error: null });

    log(`Burn job ${jobId}: running burn.py for ${filename}...`);

    await new Promise((resolve, reject) => {
      const proc = spawn('python3', [scriptPath, tempJsonPath, uploadsDir], { env });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => {
        const chunk = d.toString();
        stderr += chunk;

        // Parse FFmpeg progress from stderr: "time=HH:MM:SS.cc"
        if (totalDuration) {
          const match = chunk.match(/time=(\d+):(\d+):([\d.]+)/);
          if (match) {
            const elapsed = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
            const pct = Math.min(95, Math.round(20 + (elapsed / totalDuration) * 75));
            burnJobs.set(jobId, { status: 'burning', progress: pct, outputFile: null, error: null });
          }
        }
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`burn.py exited with code ${code}: ${stderr.slice(-1000)}`));
          return;
        }
        try {
          const result = JSON.parse(stdout.trim());
          if (result.error) reject(new Error(result.error));
          else resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse burn output: ${stdout}`));
        }
      });
    }).then((result) => {
      log(`Burn job ${jobId} complete: ${result.outputFile}`);
      burnJobs.set(jobId, { status: 'done', progress: 100, outputFile: result.outputFile, error: null });
    });

  } catch (err) {
    log(`Burn job ${jobId} failed: ${err.message}`);
    burnJobs.set(jobId, { status: 'error', progress: 0, outputFile: null, error: err.message });
  } finally {
    if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
    // Clean up job record after 30 min
    setTimeout(() => burnJobs.delete(jobId), 30 * 60 * 1000);
  }
}

// POST /api/burn — returns jobId immediately, runs async
app.post('/api/burn', (req, res) => {
  const { filename, transcript, styleConfig } = req.body;
  if (!filename || !transcript) {
    return res.status(400).json({ error: 'Filename and transcript are required' });
  }
  const jobId = Date.now().toString();
  burnJobs.set(jobId, { status: 'pending', progress: 0, outputFile: null, error: null });
  res.json({ jobId });
  runBurnJob(jobId, { filename, transcript, styleConfig }).catch((e) => {
    log(`Unhandled burn error for job ${jobId}: ${e.message}`);
  });
});

// GET /api/burn-status/:jobId — poll for progress
app.get('/api/burn-status/:jobId', (req, res) => {
  const job = burnJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// ── Preview frame ─────────────────────────────────────────────────────────────

function generateTestAss(styleConfig) {
  const fontMap = { sans: 'Arial', serif: 'Times New Roman', mono: 'Courier New', oswald: 'Oswald', roboto: 'Roboto' };
  const sizeMap = { small: 32, medium: 52, large: 80, huge: 120 };
  const fontName = fontMap[styleConfig.fontFamily || 'sans'] || 'Arial';
  const fontSize = sizeMap[styleConfig.fontSize || 'medium'] || 52;
  const hexToAss = (hex) => {
    const h = (hex || '#FFFFFF').replace('#', '');
    if (h.length !== 6) return '&H00FFFFFF';
    return `&H00${h.slice(4,6)}${h.slice(2,4)}${h.slice(0,2)}`.toUpperCase();
  };
  const primaryColor = hexToAss(styleConfig.color || '#FFFFFF');
  let backColor = hexToAss(styleConfig.backgroundColor || '#000000').replace('&H00', '&H80');
  const bold = styleConfig.bold ? -1 : 0;
  const italic = styleConfig.italic ? -1 : 0;
  const outline = styleConfig.outline ?? 2;
  const shadow = styleConfig.shadow ?? 2;
  const pos = styleConfig.position || 'bottom';
  const alignment = pos === 'top' ? 8 : pos === 'middle' ? 5 : 2;
  const text = styleConfig.uppercase ? 'PREVIEW CAPTION' : 'Preview Caption';

  return [
    '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1920', 'PlayResY: 1080', 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,&H00000000,${backColor},${bold},${italic},0,0,100,100,0,0,1,${outline},${shadow},${alignment},50,50,50,1`,
    '', '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    `Dialogue: 0,0:00:00.00,0:00:10.00,Default,,0,0,0,,${text}`,
  ].join('\n');
}

app.post('/api/preview-frame', async (req, res) => {
  const { filename, styleConfig = {}, timestamp = 5 } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename required' });

  const uploadsDir = path.join(__dirname, '../uploads');
  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  const id = Date.now();
  const assPath = path.join(uploadsDir, `preview_${id}.ass`);
  const outputPath = path.join(uploadsDir, `preview_${id}.jpg`);

  try {
    fs.writeFileSync(assPath, generateTestAss(styleConfig));

    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .seekInput(Math.max(0, timestamp))
        .frames(1)
        .outputOptions([`-vf ass=${assPath}`])
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });

    const imageData = fs.readFileSync(outputPath).toString('base64');
    res.json({ image: `data:image/jpeg;base64,${imageData}` });
  } catch (err) {
    log(`Preview frame error: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
