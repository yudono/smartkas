import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/src/lib/prisma';
import { authOptions } from '@/src/lib/auth';
import * as XLSX from 'xlsx';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
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

        const transactions = await prisma.transaction.findMany({
            where: { businessId: business.id },
            orderBy: { date: 'desc' },
        });

        const data = transactions.map(t => ({
            'Date': t.date.toISOString().split('T')[0],
            'Description': t.description,
            'Amount': Number(t.amount),
            'Type': t.type,
            'Category': t.category,
            'Status': t.status
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="transactions_export.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);

    } catch (error) {
        console.error('Error exporting transactions:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}
