# Insighta Labs Demographic API (HNG Backend)

A RESTful Node.js microservice built for Insighta Labs. This API orchestrates parallel requests to demographic prediction models (Genderize, Agify, Nationalize), persists data using MongoDB, and features a custom Natural Language Processing (NLP) engine for complex data querying.

## 🚀 Features

- **Natural Language Querying:** Custom rule-based NLP engine translates plain English sentences into MongoDB filter objects.
- **Advanced Slicer Engine:** Supports strict filtering, sorting, and pagination (up to 50 records per page).
- **Parallel API Integration:** Utilizes `Promise.all()` to fetch data simultaneously from external sources for low-latency profile creation.
- **Data Persistence & Idempotency:** Connected to MongoDB Atlas with strict checks to prevent duplicate records.
- **Dynamic Dictionary Generation:** Automatically builds a case-insensitive country code dictionary on server startup.

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB Atlas & Mongoose
- **Deployment:** Vercel

## Authentication & Token Flow

This API uses GitHub OAuth for authentication. Upon successful login, the server issues a JWT Access Token (short-lived) and a Refresh Token (long-lived). 

## Role Enforcement

Role-based access control (RBAC) is implemented. Users are assigned roles such as `admin`, `analyst`, or `user`. Protected endpoints verify the JWT payload to ensure the user has the required permissions before granting access.

## CLI and Web Integration

This Backend API is designed to be consumed by multiple interfaces. It serves data to both the Insighta Command Line Interface (CLI) and the Next.js Web Portal using a unified RESTful architecture.

## 📦 API Endpoints

### 1. Create Profile
Analyzes a name, fetches external demographic data, and saves it.
`POST /api/profiles`

    {
      "name": "ella"
    }

### 2. Get Profiles (Advanced Slicer)
Retrieves profiles with support for complex filtering, sorting, and pagination.
`GET /api/profiles?gender=female&min_age=25&sort_by=age&order=desc&page=1&limit=10`

### 3. Natural Language Search (NLP)
Translates English sentences into data queries.
`GET /api/profiles/search?q=adult females from nigeria`

### 4. Get / Delete Single Profile
`GET /api/profiles/:id`
`DELETE /api/profiles/:id`

---

## 🧠 The NLP Engine (`/search`)

### ⚙️ How the Parsing Logic Works
The parser uses Regular Expressions (Regex) and word boundary constraints (`\b`) to scan the user's input string for specific keywords. It ignores capitalization and extracts matched parameters to dynamically build a MongoDB filter.

### ✅ Supported Keywords & Mapping
* **Gender:** Recognizes `male`, `males`, `female`, and `females`. 
* **Age Groups:** Maps `child`, `teenager`, `adult`, and `senior`.
* **The "Young" Keyword:** Explicitly mapped to a `$gte: 16` and `$lte: 24` age range filter.
* **Exact Age Ranges:** Scans for `above X` / `over X` (maps to `$gte: X`) and `below X` / `under X` (maps to `$lte: X`).
* **Countries:** Dynamically builds a dictionary from seed data to map names to official ISO `country_id` (e.g., "nigeria" -> "NG").

### 🚫 Limitations & Edge Cases Not Handled
Because this is a strict rule-based parser and not an LLM, it has several limitations:
1. **No Typo Tolerance:** The parser relies on exact spelling. "Nigiria" will be ignored.
2. **No Complex Conjunctions:** It applies an implied `AND` to all extracted filters. It cannot process "males OR females".
3. **Conflicting Logic:** If a user inputs "children above 50", the parser will build both filters, resulting in an empty dataset.
4. **Compound Countries:** While it handles multi-word countries via the dynamic dictionary, it assumes exact spacing.

---
### 👤 Author
- **Name:** Har-beebullah I.O
- **HNG Slack ID:** H.A.X
- **Track:** Backend