import { NextApiRequest, NextApiResponse } from 'next';
import { AIService } from '@/src/lib/ai-service';
import fs from 'fs';
import path from 'path';
import formidable from 'formidable';

export const config = {
    api: {
        bodyParser: false, // Disable default body parser to handle file upload
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const form = formidable();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'File upload error' });
        }

        const file = files.audio?.[0];
        if (!file) {
            return res.status(400).json({ message: 'No audio file provided' });
        }

        try {
            // Read file buffer
            const buffer = fs.readFileSync(file.filepath);
            const base64Audio = buffer.toString('base64');

            const text = await AIService.transcribeAudio(base64Audio, file.mimetype || 'audio/webm');

            return res.status(200).json({ text });

        } catch (error: any) {
            console.error('STT Error:', error);
            return res.status(500).json({ message: 'STT Failed', error: error.message });
        }
    });
}
