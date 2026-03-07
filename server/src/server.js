const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = 3001;

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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    message: 'File uploaded successfully',
    filename: req.file.filename,
    path: req.file.path
  });
});

const { exec } = require('child_process');

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
    const command = `python "${scriptPath}" "${audioPath}" "${modelArg}" "${langArg}" "${safePrompt}" "${taskArg}"`;

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
    const command = `python "${scriptPath}" "${tempJsonPath}" "${uploadsDir}"`;

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
