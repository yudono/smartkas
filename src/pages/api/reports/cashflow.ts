import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/src/lib/prisma';
import { authOptions } from '@/src/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await getServerSession(req, res, authOptions) as any;

    if (!session || !session.user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const userId = session.user.id;
    const business = await prisma.business.findFirst({
        where: { userId },
    });

    if (!business) {
        return res.status(400).json({ message: 'No business found' });
    }

    if (req.method === 'GET') {
        try {
            // Get aggregated monthly data (mocked logic for now, but based on real data structure)
            // In a real app, you'd aggregate transactions by month.
            // Here we'll take the last 3 months of data and project the next month.

            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(endDate.getMonth() - 3);

            const transactions = await prisma.transaction.findMany({
                where: {
                    businessId: business.id,
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            });

            // Simple aggregation by month
            const monthlyData: Record<string, number> = {};
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

            transactions.forEach(t => {
                const monthIndex = t.date.getMonth();
                const monthName = months[monthIndex];
                const amount = Number(t.amount);

                if (!monthlyData[monthName]) monthlyData[monthName] = 0;

                if (t.type === 'in') monthlyData[monthName] += amount;
                else monthlyData[monthName] -= amount;
            });

            // Format for chart
            const chartData: { name: string; val: number; color: string; isPrediction?: boolean }[] = Object.keys(monthlyData).map(name => ({
                name,
                val: monthlyData[name],
                color: monthlyData[name] >= 0 ? "#10b981" : "#ef4444"
            }));

            // Add prediction for next month (average of last 3 months)
            const total = Object.values(monthlyData).reduce((a, b) => a + b, 0);
            const count = Object.values(monthlyData).length || 1;
            const average = total / count;

            const nextMonthIndex = (endDate.getMonth() + 1) % 12;
            const nextMonthName = months[nextMonthIndex];

            chartData.push({
                name: `${nextMonthName} (Est)`,
                val: average,
                color: "#3b82f6",
                isPrediction: true
            });

            // Ensure we have at least some data points for the chart to look good
            // If no data, return empty or default
            if (chartData.length === 1 && chartData[0].isPrediction) {
                return res.status(200).json([
                    { name: months[(endDate.getMonth() - 2 + 12) % 12], val: 0, color: "#94a3b8" },
                    { name: months[(endDate.getMonth() - 1 + 12) % 12], val: 0, color: "#94a3b8" },
                    { name: months[endDate.getMonth()], val: 0, color: "#94a3b8" },
                    chartData[0]
                ]);
            }

            return res.status(200).json(chartData);

        } catch (error) {
            console.error('Error generating cashflow prediction:', error);
            return res.status(500).json({ message: 'Internal Server Error' });
        }
    } else {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
}
