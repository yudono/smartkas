import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { searchTransactions } from "./milvus";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

// Initialize LLM (Kolosal AI / OpenAI Compatible)
// Initialize LLM (Kolosal AI / OpenAI Compatible)
// Note: Chat logic is currently handled directly in API routes (e.g., src/pages/api/chat/send.ts)
// This file can be refactored to use LangChain with Kolosal if needed in the future.
const llm = new ChatOpenAI({
    openAIApiKey: "dummy",
    configuration: {
        baseURL: "https://api.kolosal.ai/v1",
    },
    modelName: "meta-llama/llama-4-maverick-17b-128e-instruct",
    temperature: 0,
});

// Define Tool
const searchTool = new DynamicStructuredTool({
    name: "search_transactions",
    description: "Search for user transactions based on a query. Use this to answer questions about expenses, income, or specific transactions.",
    schema: z.object({
        query: z.string().describe("The search query, e.g., 'highest expense', 'coffee', 'income last month'"),
        userId: z.string().describe("The user ID to search for"),
    }),
    func: async ({ query, userId }) => {
        try {
            const results = await searchTransactions(userId, query);
            return JSON.stringify(results);
        } catch (error) {
            return "Error searching transactions.";
        }
    },
});

// Create Agent
export const agentExecutor = createReactAgent({
    llm,
    tools: [searchTool],
});

export async function processChat(userId: string, message: string, history: any[]) {
    // Convert history to LangChain messages
    const chatHistory = history.map((msg) => {
        if (msg.sender === "user") return new HumanMessage(msg.text);
        return new AIMessage(msg.text);
    });

    const result = await agentExecutor.invoke({
        messages: [...chatHistory, new HumanMessage(message)],
    });

    // Extract the last message
    const lastMessage = result.messages[result.messages.length - 1];
    return lastMessage.content;
}
