import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream, existsSync, createReadStream } from 'fs';

const DB_FILE = path.join(process.cwd(), 'local_database.json');
const UPLOAD_DIR = path.join(process.cwd(), 'product_images');
const DIST_DIR = path.join(process.cwd(), 'dist');
const PORT = 5005;

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Serve static files from dist folder
async function serveStatic(filePath, res) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        
        const content = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch (e) {
        res.writeHead(404);
        res.end('Not found');
    }
}

// Initialization
async function ensureInit() {
    try {
        await fs.access(DB_FILE);
    } catch {
        const initialDB = {
            products: [],
            orders: [],
            shifts: [],
            customers: [],
            settings: [{ id: 'shop_settings', shopName: 'Minimart POS', currency: '฿' }],
            meta: { lastUpdate: new Date().toISOString() }
        };
        await fs.writeFile(DB_FILE, JSON.stringify(initialDB, null, 2));
    }
    
    try {
        await fs.access(UPLOAD_DIR);
    } catch {
        await fs.mkdir(UPLOAD_DIR);
    }
}

let dbCache = null;

async function readDB() {
    if (dbCache) return dbCache;
    try {
        const data = await fs.readFile(DB_FILE, 'utf-8');
        dbCache = JSON.parse(data);
        console.log(`[Database] Loaded ${data.length} bytes into memory.`);
        return dbCache;
    } catch (err) {
        console.error("[Database] Read error:", err.message);
        return { products: [], orders: [], shifts: [], customers: [] };
    }
}

async function writeDB(data) {
    dbCache = data;
    data.meta = { lastUpdate: new Date().toISOString() };
    fs.writeFile(DB_FILE, JSON.stringify(data, null, 2)).catch(err => {
        console.error("[Database] Background write failed:", err.message);
    });
}

const server = http.createServer(async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const parts = url.pathname.split('/').filter(p => p);

    // Serve static files from dist folder
    if (parts.length === 0 || parts[0] === '') {
        // Root path - serve index.html
        return await serveStatic(path.join(DIST_DIR, 'index.html'), res);
    }
    
    // Check if it's a static file in dist
    const staticPath = path.join(DIST_DIR, url.pathname);
    try {
        const stat = await fs.stat(staticPath);
        if (stat.isFile()) {
            return await serveStatic(staticPath, res);
        }
    } catch {
        // Not a file, continue to API routes
    }

    // Serve Images
    if (parts[0] === 'images') {
        try {
            const fileName = parts[1];
            const filePath = path.join(UPLOAD_DIR, fileName);
            const content = await fs.readFile(filePath);
            const ext = path.extname(fileName).toLowerCase();
            const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
            res.writeHead(200, { 'Content-Type': mime });
            res.end(content);
        } catch (e) {
            res.writeHead(404);
            res.end('Not found');
        }
        return;
    }

    if (parts[0] === 'api') {
        // GET Collection
        if (req.method === 'GET') {
            const collection = parts[1];
            const db = await readDB();
            if (collection && db[collection]) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                // Stream large JSON to avoid RangeError
                const data = db[collection];
                res.write('[');
                for (let i = 0; i < data.length; i++) {
                    if (i > 0) res.write(',');
                    res.write(JSON.stringify(data[i]));
                }
                res.end(']');
            } else {
                res.writeHead(404);
                res.end('Collection not found');
            }
            return;
        }

        // POST (Upsert / Bulk)
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const db = await readDB();
                    const collection = parts[1];
                    const input = JSON.parse(body);

                    // Bulk update
                    if (collection === 'bulk' && parts[2]) {
                        const target = parts[2];
                        if (db[target]) {
                            db[target] = db[target].map(item => ({ ...item, ...input }));
                            await writeDB(db);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, count: db[target].length }));
                            return;
                        }
                    }

                    // Upload Image (Base64)
                    if (collection === 'upload-image') {
                        const { base64, fileName } = input;
                        const buffer = Buffer.from(base64.split(',')[1], 'base64');
                        const savePath = path.join(UPLOAD_DIR, fileName);
                        await fs.writeFile(savePath, buffer);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ url: `http://localhost:${PORT}/images/${fileName}` }));
                        return;
                    }

                    // Normal Upsert
                    if (collection && db[collection]) {
                        const index = db[collection].findIndex(i => i.id === input.id);
                        if (index !== -1) {
                            db[collection][index] = { ...db[collection][index], ...input };
                        } else {
                            db[collection].push(input);
                        }
                        await writeDB(db);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, item: input }));
                    } else {
                        res.writeHead(404);
                        res.end('Collection not found');
                    }
                } catch (e) {
                    console.error('[Server] POST Error:', e.message);
                    console.error('[Server] Request body:', body.substring(0, 200));
                    console.error('[Server] Stack:', e.stack);
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: e.message, stack: e.stack }));
                }
            });
            return;
        }

        // DELETE
        if (req.method === 'DELETE') {
            const collection = parts[1];
            const id = parts[2];
            const db = await readDB();
            if (collection && db[collection] && id) {
                db[collection] = db[collection].filter(i => String(i.id) !== String(id));
                await writeDB(db);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
            return;
        }
    }

    res.writeHead(404);
    res.end('Not found');
});

ensureInit().then(() => {
    server.listen(PORT, () => {
        console.log(`\x1b[32m%s\x1b[0m`, `💾 Minimart Disk Server Running on port ${PORT}`);
        console.log(`\x1b[36m%s\x1b[0m`, `📂 Database: ${DB_FILE}`);
        console.log(`\x1b[36m%s\x1b[0m`, `🖼️  Images: ${UPLOAD_DIR}`);
    });
});
