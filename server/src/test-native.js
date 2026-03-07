require('dotenv').config();
const https = require('https');

console.log("Starting native HTTPS test...");

const options = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/models',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'User-Agent': 'Nodejs-Test'
    },
    family: 4, // Force IPv4
    timeout: 30000
};

const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', (d) => {
        // Consume data
    });
    res.on('end', () => {
        console.log('No more data.');
    });
});

req.on('error', (e) => {
    console.error('Request Error:', e);
});

req.on('timeout', () => {
    console.error('Request Timeout');
    req.destroy();
});

req.end();
