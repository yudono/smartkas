import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/src/lib/prisma';
import { authOptions } from '@/src/lib/auth';
import * as XLSX from 'xlsx';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
    api: {
        bodyParser: false,
    },
};

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
            return res.status(400).json({ message: 'Business not found' });
        }

        const form = formidable();

        const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve([fields, files]);
            });
        });

        const file = files.file?.[0];
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const buffer = fs.readFileSync(file.filepath);
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Skip header row
        const rows = data.slice(1);
        const validProducts = [];
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            // Expected: Name, Price, Stock, Unit
            // Index: 0, 1, 2, 3

            if (!row || row.length === 0) continue;

            const name = row[0];
            const price = row[1];
            const stock = row[2];
            const unit = row[3];

            // Validation
            if (!name || !price) {
                errors.push(`Row ${i + 2}: Name and Price are required`);
                continue;
            }

            if (isNaN(Number(price))) {
                errors.push(`Row ${i + 2}: Invalid price`);
                continue;
            }

            validProducts.push({
                businessId: business.id,
                name: name,
                price: Number(price),
                stock: Number(stock) || 0,
                unit: unit || 'pcs',
            });
        }

        if (validProducts.length > 0) {
            // Bulk Insert
            await prisma.product.createMany({
                data: validProducts,
            });
        }

        return res.status(200).json({
            message: 'Import processed',
            successCount: validProducts.length,
            errors: errors
        });

    } catch (error) {
        console.error('Error importing products:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}
