
# HNG Stage 1: Data Persistence & API Orchestration

A RESTful CRUD API built with Node.js, Express, and MongoDB. This microservice accepts a name, orchestrates parallel requests to three external APIs (Genderize, Agify, Nationalize) to calculate demographic data, and persists the data to a cloud database with idempotency handling.

## 🚀 Features

- **Parallel API Integration:** Utilizes `Promise.all()` to fetch data simultaneously from multiple external sources, ensuring low latency.
- **Data Persistence:** Fully connected to MongoDB Atlas using Mongoose for schema validation.
- **Idempotency:** Checks the database before external fetching to prevent duplicate records.
- **Advanced Filtering:** Supports case-insensitive query parameters for tailored data retrieval.
- **UUID v7 Implementation:** Replaces standard MongoDB ObjectIds with time-sortable UUID v7s.

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB Atlas & Mongoose
- **Deployment:** Vercel

## 📦 API Endpoints

### 1. Create Profile

Analyzes a name, fetches external data, and saves it.
`POST /api/profiles`
`Content-Type: application/json`

```json
// Request Body
{ 
  "name": "ella" 
}
```

### 2. Get All Profiles

Retrieves all stored profiles. Supports optional filtering.
`GET /api/profiles?gender=female&age_group=adult`

### 3. Get Single Profile

Retrieves a specific profile by its ID.
`GET /api/profiles/:id`

### 4. Delete Profile

Removes a profile from the database.
`DELETE /api/profiles/:id`

### 👤 Author

- **Name:** Har-beebullah I.O
- **HNG Slack ID:** H.A.X
- **Track:** Backend
