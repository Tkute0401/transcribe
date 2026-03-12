const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
require('dotenv').config();

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

// Middleware
app.use(cors()); // Use default CORS first
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
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

// Burn subtitles into video
app.post('/api/burn', async (req, res) => {
  const { filename, transcript, styleConfig } = req.body;

  if (!filename || !transcript) {
    return res.status(400).json({ error: 'Filename and transcript are required' });
  }

  const requestId = Date.now();
  const tempJsonPath = path.join(__dirname, '../uploads', `burn_request_${requestId}.json`);
  const uploadsDir = path.join(__dirname, '../uploads');

  try {
    // Write request data to temp file for Python script
    fs.writeFileSync(tempJsonPath, JSON.stringify({ filename, transcript, styleConfig }));

    log(`Starting video burn for ${filename}...`);
    const scriptPath = path.join(__dirname, 'burn.py');
    const command = `python3 "${scriptPath}" "${tempJsonPath}" "${uploadsDir}"`;

    // Ensure python (and ffmpeg) can find ffmpeg
    const ffmpegDir = path.dirname(ffmpegPath);
    const env = { ...process.env, PATH: `${process.env.PATH};${ffmpegDir}` };

    const result = await new Promise((resolve, reject) => {
      exec(command, { maxBuffer: 1024 * 1024 * 10, env }, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          console.error(`stderr: ${stderr}`);
          reject(error);
          return;
        }
        try {
          const jsonResult = JSON.parse(stdout);
          if (jsonResult.error) {
            reject(new Error(jsonResult.error));
          } else {
            resolve(jsonResult);
          }
        } catch (e) {
          console.error('Failed to parse Python output:', stdout);
          reject(e);
        }
      });
    });

    log(`Burn complete: ${result.outputFile}`);
    res.json(result);

  } catch (error) {
    console.error('Burn error:', error);
    res.status(500).json({ error: 'Burn failed', details: error.message });
  } finally {
    // Cleanup temp json
    if (fs.existsSync(tempJsonPath)) {
      fs.unlinkSync(tempJsonPath);
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
