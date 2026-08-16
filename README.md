# Vantage

Goal is to make expense tracking easier for SMEs and ensure that the spending data is expressed in an easily understandable format.
This app takes the users from staring at an overwhelming number of rows, to getting the information needed immediately by extracting information, visualizing, and processing to show key stats and summary.
This also lets users get key insights, recommendation, cost management tips, and spending summary in natural language by letting an AI agent access and understand the computed statistics.

### Process

```bash
PDF Invoices
    | (LlamaParse OCR)
    V
Parsed Data (Structured Data Models)
    | (Vector Embedding Based Grouping)
    V
Expense Categories
    | (Statistics and Summary Dashboard)
    V
AI Data Insights and Querying
```

### Repo Structure

```bash
my-app/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── package.json
│   └── .env.example
├── render.yaml
├── .gitignore
└── README.md
```

## Running the application locally

### Prerequisites

Install the following before starting:

- Python 3.11
- Node.js 20 or later and npm
- A Supabase project
- A LlamaCloud API key for invoice OCR
- A Google AI Studio API key for Gemini embeddings

### 1. Clone the repository

```bash
git clone https://github.com/SGTK06/Vantage.git
cd Vantage
```

### 2. Configure Supabase

1. Create a Supabase project and copy its project URL and API key.
2. Open the Supabase SQL Editor and run [`schema/invoices_init.sql`](schema/invoices_init.sql).
3. In Supabase Storage, create a bucket named `invoices`.

The application uses Supabase Auth, database tables, row-level security, vector embeddings, and the `invoices` storage bucket. Disable email verification in Authentication for faster testing.

### 3. Configure the backend

Create `backend/.env` from the provided example and replace the placeholder values:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-api-key
FRONTEND_URL=http://localhost:5173
LLAMA_CLOUD_API_KEY=your-llamacloud-api-key
GEMINI_API_KEY=your-google-ai-studio-api-key
```

Install the Python dependencies and start the API:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# macOS/Linux
source .venv/bin/activate

# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The backend will be available at `http://localhost:8000`. Its health endpoint is `http://localhost:8000/api/health`.

### 4. Configure and start the frontend

In a second terminal, create `frontend/.env` from `frontend/.env.example`:

```bash
VITE_API_URL=http://localhost:8000
```

Install dependencies and start Vite:

```bash
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`, in a browser. Create an account or sign in with a Supabase Auth user before uploading invoices.

### Production deployment on Render

The repository includes [`render.yaml`](render.yaml), which defines the FastAPI backend and React static site. In Render, create a new Blueprint from the repository and provide the secret backend environment variables when prompted:

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `LLAMA_CLOUD_API_KEY`
- `GEMINI_API_KEY`

The Blueprint wires `FRONTEND_URL` and `VITE_API_URL` to the deployed public service URLs. Both services are configured on Render's free plan, so the backend may sleep after inactivity and the first request can take longer while it starts.
