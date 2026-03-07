const { exec } = require('child_process');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

// Add ffmpeg directory to PATH
const ffmpegDir = path.dirname(ffmpegPath);
const env = { ...process.env, PATH: `${process.env.PATH};${ffmpegDir}` };

const scriptPath = path.join(__dirname, 'src/transcribe.py');
// Use the file found in previous dir listing or any existing mp3
const audioPath = path.join(__dirname, 'uploads/1767468433266-5 (1).mp3');

console.log('Testing word timestamps extraction with language=mr...');

const command = `python "${scriptPath}" "${audioPath}" "base" "mr"`;

exec(command, { env }, (error, stdout, stderr) => {
    console.log('[STDOUT]:', stdout);
    console.log('[STDERR]:', stderr);
    if (error) {
        console.error(`exec error: ${error}`);
        console.error('Stderr:', stderr);
        return;
    }
    try {
        const result = JSON.parse(stdout);
        console.log('Text length:', result.text.length);
        console.log('Word count:', result.words.length);
        console.log('First 3 words:', result.words.slice(0, 3));
    } catch (e) {
        console.log('Stdout:', stdout);
    }
});
