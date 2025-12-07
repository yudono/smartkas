<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SmartKas - AI-Powered Financial Management

SmartKas is an intelligent financial management platform designed for small businesses. It combines traditional bookkeeping with advanced AI capabilities to provide actionable insights, anomaly detection, and interactive financial analysis.

## 🚀 Key Features

### 📊 Dashboard & Analytics
- **Real-time Overview**: Monitor income, expenses, and net cash flow instantly.
- **Visual Reports**: Interactive charts for financial trends and category breakdowns.
- **Dynamic Currency**: Support for multiple currencies (IDR, USD) with user-specific formatting.

### 💰 Transaction Management
- **Easy Recording**: Log income and expenses with intuitive forms.
- **Receipt Scanning**: (Coming Soon) Scan receipts to automatically extract transaction details.
- **Excel Import/Export**: Bulk import transactions or export reports for offline analysis.

### 📦 Product & Inventory
- **Product Catalog**: Manage products with prices, stock levels, and units.
- **Stock Tracking**: Automatically update stock counts based on transactions.

### 🤖 AI Assistant (SmartKas AI)
- **Interactive Chat**: Ask questions about your finances in natural language (e.g., "How much did I spend on coffee last month?").
- **Deep Analysis**: The `analyzeTransactionTool` uses LLMs to process and summarize transaction data.
- **Vector Search**: Semantic search capabilities allow finding transactions by context, description, or date (e.g., "expenses in December").
- **Context Awareness**: The AI understands your business context and currency settings automatically.

### 🛡️ Anomaly Detection & Alerts
- **Automated Monitoring**: A cron job (`detect-anomalies`) scans your transactions periodically for unusual patterns.
- **Smart Alerts**: Receive notifications for potential financial leaks or irregularities.
- **Duplicate Prevention**: Intelligent logic prevents duplicate alerts for the same issue.
- **Actionable Insights**: Get AI-generated recommendations on how to resolve detected anomalies.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (via Neon/Supabase)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Vector Database**: [Milvus](https://milvus.io/) (for semantic search and chat memory)
- **AI/LLM**: [LangChain](https://js.langchain.com/), OpenAI/Kolosal AI, Google Gemini (Embeddings)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database
- Milvus Instance (Zilliz Cloud or Local)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yudono/uangcerdas.git
    cd uangcerdas
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables:**
    Create a `.env` file based on `.env.example` and fill in your credentials:
    ```env
    DATABASE_URL="postgresql://..."
    NEXTAUTH_SECRET="your-secret"
    NEXTAUTH_URL="http://localhost:3000"
    
    # AI & Vector DB
    MILVUS_URL="your-milvus-url"
    MILVUS_TOKEN="your-milvus-token"
    KOLOSAL_API_KEY="your-kolosal-key"
    GOOGLE_API_KEY="your-gemini-key"
    ```

4.  **Database Setup:**
    ```bash
    npx prisma generate
    npx prisma db push
    npx prisma db seed # Seeds initial data and embeddings
    ```

5.  **Run the app:**
    ```bash
    npm run dev
    ```

## 🧠 AI Architecture

SmartKas uses a sophisticated AI architecture:
- **LangGraph**: Orchestrates the AI agent's workflow.
- **Milvus**: Stores transaction embeddings (768 dimensions) and chat history for long-term memory.
- **Tools**: Custom tools allow the AI to query the database, analyze trends, and save transactions.
- **Cron Jobs**: Serverless functions run in the background to proactively detect issues.

---
Built with ❤️ by the SmartKas Team.
