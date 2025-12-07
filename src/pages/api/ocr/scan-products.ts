import type { NextApiRequest, NextApiResponse } from 'next';
import { AIService } from '@/src/lib/ai-service';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { image_data } = req.body;

        if (!image_data) {
            return res.status(400).json({ message: 'image_data is required' });
        }

        const data = await AIService.scanProduct(image_data);
        return res.status(200).json(data);

    } catch (error: any) {
        console.error('OCR Product Scan Error:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}
