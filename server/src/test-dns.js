require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Force IPv4 at DNS level (Node 17+)
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
    console.log('DNS set to ipv4first');
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 120000,
});

const filePath = path.join(__dirname, '../uploads/1767468433266-5 (1).mp3');

async function testTranscription() {
    const start = Date.now();

    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }

    console.log('Starting transcription test (DNS fix)...');
    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-1",
        });
        console.log('Success!', transcription.text);
        console.log(`Duration: ${(Date.now() - start) / 1000}s`);
    } catch (error) {
        console.error(`Test failed after ${(Date.now() - start) / 1000}s:`, error);
    }
}

testTranscription();
