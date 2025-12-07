import { NextApiRequest, NextApiResponse } from 'next';
import * as XLSX from 'xlsx';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // Define headers and example data
        const headers = ['Date (YYYY-MM-DD)', 'Description', 'Amount', 'Type (in/out)', 'Category'];
        const exampleData = [
            ['2023-10-25', 'Penjualan Hari Ini', 500000, 'in', 'Penjualan'],
            ['2023-10-25', 'Beli Bahan Baku', 150000, 'out', 'Bahan Baku'],
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="transaction_template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) {
        console.error('Error generating template:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}
