require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testTransliteration() {
  const text = "market में मिलने वाले कई मोरिंगा पाउडर ओवर प्रसिस्ट होते है अडिटिव्स मिक्स होते है";
  console.log("Original Text:", text);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a transliterator. Your task is to transliterate the given text into Latin script (Romanized) while keeping the original language (e.g., Hinglish, Mix of languages). Keep English words as they are. Preserve the meaning and tone. Only return the transliterated text, nothing else."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0,
    });

    console.log("Transliterated Text:", response.choices[0].message.content.trim());
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testTransliteration();
