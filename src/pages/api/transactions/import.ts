import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/src/lib/prisma';
import { authOptions } from '@/src/lib/auth';
import * as XLSX from 'xlsx';
import formidable from 'formidable';
import fs from 'fs';
import { upsertTransaction } from '@/src/lib/milvus';

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
        const validTransactions = [];
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            // Expected: Date, Description, Amount, Type, Category
            // Index: 0, 1, 2, 3, 4

            if (!row || row.length === 0) continue;

            const dateStr = row[0];
            const desc = row[1];
            const amount = row[2];
            const type = row[3]?.toLowerCase();
            const category = row[4];

            // Validation
            if (!dateStr || !desc || !amount || !type || !category) {
                errors.push(`Row ${i + 2}: Missing required fields`);
                continue;
            }

            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                errors.push(`Row ${i + 2}: Invalid date format`);
                continue;
            }

            if (isNaN(Number(amount))) {
                errors.push(`Row ${i + 2}: Invalid amount`);
                continue;
            }

            if (type !== 'in' && type !== 'out') {
                errors.push(`Row ${i + 2}: Invalid type (must be 'in' or 'out')`);
                continue;
            }

            validTransactions.push({
                businessId: business.id,
                date: date,
                description: desc,
                amount: Number(amount),
                type: type,
                category: category,
                status: 'completed',
            });
        }

        if (validTransactions.length > 0) {
            // Bulk Insert
            await prisma.transaction.createMany({
                data: validTransactions,
            });

            // Sync to Milvus (Optional: can be slow for large imports, maybe background job)
            // For now, let's try to sync a few or skip to avoid timeout
            // Or just fire and forget
            Promise.all(validTransactions.map(t => upsertTransaction({ ...t, id: 'temp-id-for-vector' })))
                .catch(e => console.error("Milvus sync error during import", e));
        }

        return res.status(200).json({
            message: 'Import processed',
            successCount: validTransactions.length,
            errors: errors
        });

    } catch (error) {
        console.error('Error importing transactions:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}
