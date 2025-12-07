import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/src/lib/prisma';
import { authOptions } from '@/src/lib/auth';
import { AIService } from '@/src/lib/ai-service';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
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
        let business = await prisma.business.findFirst({ where: { userId } });

        if (!business) {
            business = await prisma.business.create({
                data: {
                    userId,
                    businessName: 'My Business',
                    businessType: 'General',
                },
            });
        }

        const { messages, image_url } = req.body;

        if (!messages) {
            return res.status(400).json({ message: 'Messages are required' });
        }



        // 1. Fetch Context
        const [recentTransactions, products] = await Promise.all([
            prisma.transaction.findMany({
                where: { businessId: business.id },
                take: 5,
                orderBy: { date: 'desc' },
            }),
            prisma.product.findMany({
                where: { businessId: business.id },
                select: { name: true, stock: true, price: true, unit: true }
            })
        ]);

        const contextString = `
        CURRENT TIME: ${new Date().toLocaleString('id-ID')}
        
        PRODUCTS & STOCK:
        ${products.map(p => `- ${p.name}: ${p.stock} ${p.unit} (Rp${p.price})`).join('\n')}

        RECENT TRANSACTIONS:
        ${recentTransactions.map(t => `- ${t.date.toISOString().split('T')[0]}: ${t.type.toUpperCase()} Rp${t.amount} (${t.description || 'No Desc'})`).join('\n')}
        `;

        // 2. Prepare System Prompt with Command Instructions
        const systemPrompt = `
        You are SmartKas, a helpful AI assistant for a small business owner.
        
        CONTEXT DATA:
        ${contextString}

        CAPABILITIES:
        You can answer questions about the data above.
        You can also PERFORM ACTIONS by outputting a JSON block.
        
        ACTIONS AVAILABLE:
        1. Save Transaction:
           If user wants to record a transaction (expense/income/sale), return JSON:
           \`\`\`json
           {
             "action": "save_transaction",
             "type": "in" | "out",
             "amount": number,
             "description": "string",
             "category": "Penjualan" | "Operasional" | "Lainnya"
           }
           \`\`\`
           
        2. Update Stock:
            If user wants to add/reduce stock, return JSON:
            \`\`\`json
            {
              "action": "update_stock",
              "product_name": "exact name from list",
              "quantity_change": number (positive to add, negative to reduce)
            }
            \`\`\`

        RULES:
        - If performing an action, output ONLY the JSON block. Do not add chat text.
        - If just chatting, do NOT output JSON.
        - Speak Indonesian.
        - Be concise.
        `;

        // 3. Prepare Messages
        const apiMessages = [
            { role: "system", content: systemPrompt },
            ...messages
        ];

        // Handle Image context (append to last user message)
        if (image_url) {
            const lastMsg = apiMessages[apiMessages.length - 1];
            if (lastMsg.role === 'user') {
                // Using generic content structure usually supported by vision-capable endpoints
                // Adjust based on specific Kolosal/Llama vision requirements if known, otherwise using standard OpenAI-like "content array"
                lastMsg.content = [
                    { type: "text", text: lastMsg.content || "Analyze this image." },
                    { type: "image_url", image_url: { url: image_url } }
                ] as any;
            }
        }

        // 4. Call AI
        let reply = await AIService.chatCompletion(apiMessages, "meta-llama/llama-4-maverick-17b-128e-instruct", 500, 0.2);

        // 5. Parse for Actions
        // Simple regex to find JSON block ```json ... ``` or just { ... }
        const jsonMatch = reply.match(/```json\n([\s\S]*?)\n```/) || reply.match(/({[\s\S]*})/);

        if (jsonMatch) {
            try {
                const command = JSON.parse(jsonMatch[1] || jsonMatch[0]);

                if (command.action === 'save_transaction') {
                    // Execute Transaction Save
                    await prisma.transaction.create({
                        data: {
                            businessId: business.id,
                            amount: command.amount,
                            type: command.type,
                            category: command.category || 'Lainnya',
                            description: command.description,
                            date: new Date(),
                            status: 'completed'
                        }
                    });
                    reply = `✅ Transaksi berhasil disimpan: ${command.type === 'in' ? 'Pemasukan' : 'Pengeluaran'} Rp${command.amount.toLocaleString()} (${command.description}).`;

                } else if (command.action === 'update_stock') {
                    // Update Stock
                    const product = await prisma.product.findFirst({
                        where: {
                            businessId: business.id,
                            name: { contains: command.product_name } // Fuzzy match
                        }
                    });

                    if (product) {
                        await prisma.product.update({
                            where: { id: product.id },
                            data: { stock: { increment: command.quantity_change } }
                        });
                        reply = `📦 Stok updated: ${product.name} ${command.quantity_change > 0 ? '+' : ''}${command.quantity_change}. Total: ${product.stock + command.quantity_change} ${product.unit}.`;
                    } else {
                        reply = `⚠️ Produk "${command.product_name}" tidak ditemukan.`;
                    }
                }
            } catch (e) {
                console.error("Failed to execute AI command", e);
                reply = "Maaf, saya mencoba melakukan tindakan tetapi gagal memproses perintah.";
            }
        }

        return res.status(200).json({ reply });

    } catch (error: any) {
        console.error('Chat API Error:', error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
