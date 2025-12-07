import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/src/lib/prisma';
import { authOptions } from '@/src/lib/auth';

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

        const business = await prisma.business.findFirst({
            where: { userId },
        });

        if (!business) {
            // Return zeros if no business yet
            return res.status(200).json({
                totalIncome: 0,
                totalExpense: 0,
                netCash: 0
            });
        }

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); // Last day of the current month

        // Aggregate Income
        const incomeAgg = await prisma.transaction.aggregate({
            _sum: {
                amount: true,
            },
            where: {
                businessId: business.id,
                type: 'in',
                date: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
            },
        });

        const expenseAgg = await prisma.transaction.aggregate({
            _sum: {
                amount: true,
            },
            where: {
                businessId: business.id,
                type: 'out',
                date: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
            },
        });
        const totalIncome = Number(incomeAgg._sum.amount || 0);
        const totalExpense = Number(expenseAgg._sum.amount || 0);
        const netCash = totalIncome - totalExpense;

        return res.status(200).json({
            totalIncome,
            totalExpense,
            netCash
        });

    } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
