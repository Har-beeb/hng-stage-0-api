# SOLUTION.md

## 🚀 Stage 4B: High-Performance Data Ingestion & Caching

### 1. Optimization Approach
To handle massive datasets (500,000+ rows) and achieve strict latency targets (P50 < 500ms, P95 < 2s), the architecture was optimized across two primary layers:
*   **Ingestion Layer (Write Optimization):** Standard JSON body parsing was abandoned in favor of Node.js `fs.createReadStream` piped into `csv-parser`. This prevents the entire 25MB+ file from loading into RAM, avoiding Vercel out-of-memory crashes. Data is flushed to MongoDB using `insertMany` in batches of 1,000 to minimize database round-trips.
*   **Query Layer (Read Optimization):** A Redis Cloud caching layer was introduced for heavy read endpoints (e.g., `/api/profiles`). Complex queries (like searching by gender across half a million documents) execute on MongoDB only once. The result is cached in Redis, allowing subsequent identical queries to be served directly from memory.

### 2. Design Decisions and Trade-offs
*   **Trade-off: Batch Size (Memory vs. Speed):** I set the MongoDB `insertMany` batch size to 1,000. 
    * *Why:* A larger batch (e.g., 10,000) would write faster but risk blowing up the serverless memory limit. A smaller batch (100) is memory-safe but takes too long to execute. 1,000 provided the perfect balance, ingesting 500k rows in ~4.5 seconds locally.
*   **Trade-off: Cache TTL (Consistency vs. Speed):** Redis cache TTL is set to 1 hour (3600s). 
    * *Why:* This means if a new profile is created, the filtered queries might return stale data for up to an hour. However, for a read-heavy analytical API, raw speed and reducing DB strain take priority over immediate strict consistency.
*   **Decision: Bypassing Vercel's 4.5MB Payload Limit:** Instead of forcing massive files through the Vercel API, the system uses a `multipart/form-data` stream. For extreme data bloat testing, I wrote a direct Node.js CLI script to bypass the network entirely, while keeping the API route optimized for chunked production limits (tested successfully with 50,000 rows / ~3MB).

### 3. Query Performance (Before & After)
To validate the architecture, the database was populated with over 550,000 rows. Benchmarks were run using a custom CLI command (`insighta test-cache`) measuring latency for a filtered query (`?gender=female`).

| Metric | Before (Cold MongoDB Hit) | After (Warm Redis Hit) | Result / Target Status |
| :--- | :--- | :--- | :--- |
| **P50 Latency (Average)** | 1007ms | **390ms** | ✅ **PASS** (Target: < 500ms) |
| **P95 Latency (Stress)** | 1641ms | **544ms** | ✅ **PASS** (Target: < 2.0s) |

*Note: The "After" times include network and Axios overhead from the CLI; actual Redis execution time is < 20ms.*

### 4. Handling Ingestion Failures and Edge Cases
The ingestion stream is highly resilient and designed not to fail the entire request if individual rows are corrupt.
*   **Missing Fields:** If a row is missing critical data (`name`, `gender`, `country_id`), the stream validator catches the `undefined` values, increments a `reasons.missing_fields` counter, and `return`s early. The stream continues parsing the next row without throwing an error.
*   **Duplicate Data:** If MongoDB throws a `11000` Duplicate Key Error (e.g., identical names), the `catch` block intercepts it. Because `insertMany` is called with `{ ordered: false }`, MongoDB successfully inserts the valid documents in the batch, while the backend tallies the rejected duplicates into a `reasons.duplicate_name` counter.
*   **Response Summary:** Instead of a simple 200 OK, the API returns a detailed statistical breakdown showing exactly how many rows were `total`, `inserted`, and `skipped` (with specific fail reasons) so the client knows exactly what happened to their data.

---

### 🛠️ Tech Stack Used
*   **Backend:** Node.js, Express.js
*   **Database:** MongoDB (Mongoose)
*   **Cache:** Redis Cloud
*   **Deployment:** Vercel
*   **CLI Tooling:** Commander, Chalk, Axios, Form-Data