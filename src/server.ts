import express from 'express';
import { Request, Response } from 'express';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Simple interface for the data structure
interface DataItem {
    id: string;
    timestamp: number;
    data: any;
}

// In-memory storage
let dataStore: DataItem[] = [];

// 1. Quick response endpoint
app.get('/api/ping', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// 2. CPU-intensive endpoint
app.get('/api/compute/:complexity', (req: Request, res: Response) => {
    const complexity = parseInt(req.params.complexity) || 10;
    const result = fibonacci(complexity);
    res.json({ result, complexity });
});

// 3. Memory-intensive endpoint
app.post('/api/data', (req: Request, res: Response) => {
    const newItem: DataItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        data: req.body
    };

    dataStore.push(newItem);

    // Simulate memory pressure by keeping only last 1000 items
    if (dataStore.length > 1000) {
        dataStore = dataStore.slice(-1000);
    }

    res.status(201).json(newItem);
});

// 4. Delayed response endpoint
app.get('/api/delay/:ms', async (req: Request, res: Response) => {
    const delay = parseInt(req.params.ms) || 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    res.json({ delayed: true, ms: delay });
});

// 5. Bulk operation endpoint
app.post('/api/bulk', (req: Request, res: Response) => {
    const items = Array.isArray(req.body) ? req.body : [];
    const processed = items.map(item => ({
        id: crypto.randomUUID(),
        processed: true,
        originalData: item,
        timestamp: Date.now()
    }));

    res.json({ processed, count: processed.length });
});

// Helper function for CPU-intensive operations
function fibonacci(n: number): number {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: any) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});