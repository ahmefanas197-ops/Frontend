import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const key = process.env.GEMINI_API_KEY;

if (!key) {
  console.log('\n❌ ERROR: GEMINI_API_KEY is empty or missing from your .env file!');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: key });

async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: 'Respond with: Gemini API is connected successfully!',
    });
    console.log('\n--- SUCCESS ---');
    console.log(response.text);
  } catch (error) {
    console.error('API Error:', error);
  }
}

run();
