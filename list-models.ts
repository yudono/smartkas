import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        // Did not see listModels on the main class in some versions, but try getting it from client or just try a standard generation with a fallback
        // Actually, listModels might not be exposed easily in the helper SDK, usually it's a REST call.
        // Let's try the direct REST call to be sure.
        const key = process.env.GEMINI_API_KEY;
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await resp.json();
        console.log("AVAILABLE MODELS:");
        if (data.models) {
            data.models.forEach(m => {
                if (m.supportedGenerationMethods.includes('generateContent')) {
                    console.log(`- ${m.name} (${m.displayName})`);
                }
            });
        } else {
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
