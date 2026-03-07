require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../uploads/1767468433266-5 (1).mp3');

async function testAxios() {
    if (!fs.existsSync(filePath)) {
        console.error('File not found');
        return;
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('model', 'whisper-1');

    try {
        console.log('Starting Axios upload...');
        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                ...formData.getHeaders()
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });
        console.log('Success!', response.data);
    } catch (error) {
        if (error.response) {
            console.error('Error Response:', error.response.status, error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testAxios();
