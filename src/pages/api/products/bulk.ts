import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/src/lib/prisma';
import { authOptions } from '@/src/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const session = await getServerSession(req, res, authOptions) as any;

        if (!session || !session.user?.id) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = session.user.id;
        const business = await prisma.business.findFirst({ where: { userId } });

        if (!business) {
            return res.status(400).json({ message: 'No business found' });
        }

        const products = req.body;

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: 'Invalid payload: Expected array of products' });
        }

        // Validate and format data
        const formattedProducts = products.map((p: any) => ({
            businessId: business.id,
            name: p.name || 'Unnamed Product',
            price: Number(p.price) || 0,
            stock: Number(p.stock) || 0,
            unit: p.unit || 'pcs',
        }));

        // Bulk insert
        const result = await prisma.product.createMany({
            data: formattedProducts,
            // skipDuplicates: true // Optional: skip if name collision logic exists (currently no unique constraint on name per business in schema, so duplicates allowed)
        });

        return res.status(200).json({ message: 'Success', count: result.count });

    } catch (error: any) {
        console.error('Bulk Import Error:', error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
