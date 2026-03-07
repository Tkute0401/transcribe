require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { toFile } = require('openai');

const agent = new https.Agent({
    family: 4,
    keepAlive: true,
    timeout: 60000
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 120000,
    httpAgent: agent
});

const filePath = path.join(__dirname, '../uploads/1767468433266-5 (1).mp3');

async function testTranscription() {
    const start = Date.now();
    try {
        console.log('Testing connectivity (List Models)...');
        await openai.models.list();
        console.log(`Models listed in ${(Date.now() - start) / 1000}s. Connectivity OK.`);
    } catch (err) {
        console.error('List Models failed:', err);
        return;
    }

    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }

    console.log('Reading file to buffer...');
    const buffer = fs.readFileSync(filePath);

    // Create a "File-like" object for OpenAI
    // This avoids stream piping issues
    const fileObj = await toFile(buffer, 'test.mp3');

    console.log('Starting transcription test (Buffer)...');
    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fileObj,
            model: "whisper-1",
        });
        console.log('Success!', transcription.text);
        console.log(`Duration: ${(Date.now() - start) / 1000}s`);
    } catch (error) {
        console.error(`Test failed after ${(Date.now() - start) / 1000}s:`, error);
    }
}

testTranscription();
