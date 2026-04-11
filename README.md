# HNG Stage 0: Name Classification API

A lightweight, fast RESTful API built with Node.js and Express that integrates with the external Genderize API. It accepts a name as a query parameter, processes the prediction data, calculates confidence metrics, and returns a strictly formatted JSON response.

## 🚀 Features

- **External API Integration:** Seamlessly fetches data from `api.genderize.io`.
- **Data Transformation:** Calculates a strict `is_confident` boolean based on probability and sample size thresholds.
- **Dynamic Timestamps:** Generates accurate ISO 8601 UTC timestamps for every request.
- **Robust Error Handling:** Gracefully handles missing parameters, upstream API failures, and unidentifiable names.
- **CORS Enabled:** Fully accessible from any origin (`*`) for automated testing.

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Network Requests:** Native `fetch()` API
- **Deployment:** Vercel

## 📦 Local Setup & Installation

Run the following commands in your terminal to set up and start the project locally:

```bash
# 1. Clone the repository
git clone https://github.com/Har-beeb/hng-stage-0-api.git
cd hng-stage-0-api

# 2. Install dependencies
npm install

# 3. Start the development server
npm start
```

## 📖 API Documentation

### 1. Classify Name
Analyzes a given name and returns gender probability and confidence metrics.

**Endpoint:** `GET /api/classify?name={name}`

**Success Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "name": "john",
    "gender": "male",
    "probability": 0.99,
    "sample_size": 1234,
    "is_confident": true,
    "processed_at": "2026-04-11T12:00:00.000Z"
  }
}
```

### ⚠️ Error Responses

**Missing or Empty Name (400 Bad Request):**
```json
{ 
  "status": "error", 
  "message": "Missing or empty name parameter" 
}
```

**Unidentifiable Name (400 Bad Request):**
*Returned if the external API yields null gender or 0 count.*
```json
{ 
  "status": "error", 
  "message": "No prediction available for the provided name" 
}
```

**Server/Upstream Error (500 Internal Server Error):**
```json
{ 
  "status": "error", 
  "message": "Upstream or server failure" 
}
```

## 👤 Author

- **Name:** Har-beebullah I.O
- **HNG Slack ID:** H.A.X
- **Track:** Backend