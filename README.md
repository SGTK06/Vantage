# Vantage

Goal is to make expense tracking easier for SMEs and ensure that the spending data is expressed in an easily understandable format.
This app takes the users from staring at an overwhelming number of rows, to getting the information needed immediately by extracting information, visualizing, and processing to show key stats and summary.
This also lets users get key insights, recommendation, cost management tips, and spending summary in natural language by letting an AI agent access and understand the computed statistics.

### Process

PDF Invoices
| (LlamaParse OCR)
V
Parsed Data (Structured Data Models)
| (RapidFuzz similarity grouping / embedding based grouping)
V
Expense Categories
| (Statistics and Summary Dashboard)
V
AI Data Insights and Querying

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
