import { GoogleGenerativeAI } from '@google/generative-ai';

// Types
interface OCRProductResponse {
    products: {
        name: string;
        stock?: number;
        price?: number;
        unit?: string;
    }[];
}

interface OCRTransactionResponse {
    date: string;
    items: {
        name: string;
        price: number;
        quantity: number;
        total: number;
    }[];
    merchant: string;
    total_amount: number;
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string | any[];
}

export class AIService {
    private static getKolosalKey() {
        const key = process.env.KOLOSAL_API_KEY;
        if (!key) throw new Error("Missing KOLOSAL_API_KEY");
        return key;
    }

    private static getGeminiKey() {
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error("Missing GEMINI_API_KEY");
        return key;
    }

    // Kolosal OCR
    static async scanProduct(imageData: string): Promise<OCRProductResponse> {
        const payload = {
            auto_fix: true,
            custom_schema: {
                "name": "product_inventory_extraction",
                "schema": {
                    "type": "object",
                    "properties": {
                        "products": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": { "type": "string" },
                                    "stock": { "type": "number", "description": "Quantity or stock count" },
                                    "price": { "type": "number", "description": "Unit price" },
                                    "unit": { "type": "string", "description": "e.g., pcs, kg, box" }
                                },
                                "required": ["name"]
                            }
                        }
                    },
                    "required": ["products"]
                },
                "strict": true
            },
            image_data: imageData,
            invoice: false,
            language: "auto"
        };

        return this.callKolosalOCR(payload);
    }

    static async scanTransaction(imageData: string): Promise<OCRTransactionResponse> {
        const payload = {
            auto_fix: true,
            custom_schema: {
                "name": "transaction_extraction",
                "schema": {
                    "type": "object",
                    "properties": {
                        "date": { "type": "string", "description": "YYYY-MM-DD, use today if not found" },
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": { "type": "string" },
                                    "price": { "type": "number" },
                                    "quantity": { "type": "number" },
                                    "total": { "type": "number" }
                                },
                                "required": ["name", "price"]
                            }
                        },
                        "merchant": { "type": "string" },
                        "total_amount": { "type": "number" }
                    },
                    "required": ["date", "items", "merchant", "total_amount"]
                },
                "strict": true
            },
            image_data: imageData,
            invoice: false,
            language: "auto"
        };

        return this.callKolosalOCR(payload);
    }

    private static async callKolosalOCR(payload: any) {
        const response = await fetch('https://api.kolosal.ai/ocr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getKolosalKey()}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Kolosal OCR Error:', data);
            throw new Error(data.message || 'OCR failed');
        }

        return data;
    }

    // Kolosal Chat
    static async chatCompletion(messages: ChatMessage[], model = "meta-llama/llama-4-maverick-17b-128e-instruct", maxTokens = 500, temperature = 0.7) {
        const response = await fetch('https://api.kolosal.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getKolosalKey()}`
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens: maxTokens,
                temperature
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Kolosal Chat Error:", errorText);
            throw new Error(`Chat Request Failed: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    }

    // Gemini STT
    static async transcribeAudio(base64Audio: string, mimeType: string = 'audio/webm') {
        const genAI = new GoogleGenerativeAI(this.getGeminiKey());
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType,
                    data: base64Audio
                }
            },
            { text: "Transcribe this audio to text. Output ONLY the transcription, no other text." }
        ]);

        const response = await result.response;
        return response.text().trim();
    }
    // Anomaly Detection
    static async detectAnomalies(transactions: any[]): Promise<any[]> {
        const prompt = `
        Analyze the following transactions for anomalies (fraud, unusual spending, spikes, etc.):
        ${JSON.stringify(transactions)}

        Return a JSON array of anomalies found. Each object should have:
        - title: Short title of the anomaly
        - description: Detailed description
        - severity: 'high', 'medium', or 'low'
        - recommendation: Actionable advice
        - impact: Potential financial impact
        - suggestedActions: Array of strings (actions to take)
        - amount: The amount involved (if applicable)

        If no anomalies are found, return an empty array [].
        Output ONLY the JSON array.
        `;

        const response = await this.chatCompletion([
            { role: 'system', content: 'You are a financial fraud detection expert.' },
            { role: 'user', content: prompt }
        ], "meta-llama/llama-4-maverick-17b-128e-instruct", 1000, 0.1);

        try {
            // Extract JSON from response
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/(\[[\s\S]*\])/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1] || jsonMatch[0]);
            }
            return [];
        } catch (e) {
            console.error("Failed to parse anomaly detection response", e);
            return [];
        }
    }
}
