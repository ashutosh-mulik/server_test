import express from 'express';
import { Request, Response } from 'express';
import crypto from 'crypto';
import cluster from 'cluster';
import { cpus } from 'os';
import { Worker } from 'worker_threads';
import path from 'path';

if (cluster.isPrimary) {
    // Fork workers
    for (let i = 0; i < cpus().length; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });
} else {
    const app = express();
    const PORT = process.env.PORT || 3000;

    // Optimized memory storage with Map instead of Array
    const dataStore = new Map<string, DataItem>();

    interface DataItem {
        id: string;
        timestamp: number;
        data: any;
    }

    // Enhanced middleware with compression
    app.use(express.json({ limit: '1mb' }));

    // Quick response endpoint (unchanged)
    app.get('/api/ping', (_req: Request, res: Response) => {
        res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Optimized CPU-intensive endpoint using Worker Threads
    app.get('/api/compute/:complexity', (req: Request, res: Response) => {
        const complexity = Math.min(parseInt(req.params.complexity) || 10, 40);

        const worker = new Worker(`
            const fibonacci = (n) => {
                let a = 0, b = 1;
                for(let i = 0; i < n; i++) {
                    [a, b] = [b, a + b];
                }
                return a;
            };
            
            parentPort.on('message', (n) => {
                const result = fibonacci(n);
                parentPort.postMessage(result);
            });
        `, { eval: true });

        worker.on('message', (result) => {
            res.json({ result, complexity });
            worker.terminate();
        });

        worker.postMessage(complexity);
    });

    // Optimized memory-intensive endpoint
    app.post('/api/data', (req: Request, res: Response) => {
        const id = crypto.randomUUID();
        const newItem: DataItem = {
            id,
            timestamp: Date.now(),
            data: req.body
        };

        // Use Map instead of Array for O(1) operations
        dataStore.set(id, newItem);

        // Efficient memory management
        if (dataStore.size > 1000) {
            const entriesToDelete = Array.from(dataStore.keys())
                .slice(0, dataStore.size - 1000);
            entriesToDelete.forEach(key => dataStore.delete(key));
        }

        res.status(201).json(newItem);
    });

    // Optimized delayed response endpoint
    app.get('/api/delay/:ms', (req: Request, res: Response) => {
        const delay = Math.min(parseInt(req.params.ms) || 1000, 5000);

        // Use setImmediate for better event loop handling
        const timer = setTimeout(() => {
            res.json({ delayed: true, ms: delay });
        }, delay);

        // Clean up on client disconnect
        req.on('close', () => {
            clearTimeout(timer);
        });
    });

    // Optimized bulk operation endpoint
    app.post('/api/bulk', (req: Request, res: Response) => {
        const items = Array.isArray(req.body) ? req.body.slice(0, 1000) : []; // Limit batch size

        // Process in chunks to avoid blocking
        const chunkSize = 100;
        const results = [];

        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            const processed = chunk.map(item => ({
                id: crypto.randomUUID(),
                processed: true,
                originalData: item,
                timestamp: Date.now()
            }));
            results.push(...processed);

            // Allow event loop to handle other requests
            if (i + chunkSize < items.length) {
                setImmediate(() => { });
            }
        }

        res.json({ processed: results, count: results.length });
    });

    // Enhanced error handling
    app.use((err: Error, req: Request, res: Response, _next: any) => {
        console.error(`Error [${req.method} ${req.path}]:`, err);
        res.status(500).json({
            error: 'Internal Server Error',
            path: req.path,
            method: req.method
        });
    });

    // Start server
    app.listen(PORT, () => {
        console.log(`Worker ${process.pid} started on port ${PORT}`);
    });
}