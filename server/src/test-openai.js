require('dotenv').config();
const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;

console.log('API Key loaded:', apiKey ? 'Yes' : 'No');
if (apiKey) {
    console.log('API Key starts with:', apiKey.substring(0, 7) + '...');
}

const openai = new OpenAI({
    apiKey: apiKey,
});

async function testConnection() {
    try {
        console.log('Attempting to list models...');
        const list = await openai.models.list();
        console.log('Success! Found', list.data.length, 'models.');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testConnection();
