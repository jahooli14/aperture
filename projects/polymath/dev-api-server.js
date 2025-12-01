import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Simple dev server to serve API routes during development
const server = http.createServer(async (req, res) => {
  // Only handle /api routes
  if (!req.url.startsWith('/api')) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  try {
    // Parse the path to find the handler
    const path = req.url.split('?')[0]; // Remove query string
    const pathParts = path.split('/').filter(Boolean); // ['api', 'projects']

    // Find the handler file
    let handlerPath;
    if (pathParts[1] === 'cron') {
      // /api/cron/jobs -> api/cron/jobs.js
      handlerPath = join(__dirname, 'api', 'cron', 'jobs.js');
    } else if (pathParts.length >= 2) {
      // /api/projects -> api/projects.js
      handlerPath = join(__dirname, 'api', `${pathParts[1]}.js`);
    }

    if (!handlerPath) {
      res.writeHead(404);
      res.end('Handler not found');
      return;
    }

    // Dynamically import the handler
    const handler = await import(`file://${handlerPath}`);
    const defaultHandler = handler.default;

    if (!defaultHandler) {
      res.writeHead(500);
      res.end('Handler does not export default function');
      return;
    }

    // Create a mock request/response for the handler
    const mockReq = {
      method: req.method,
      headers: req.headers,
      url: req.url,
      query: parseQuery(req.url),
    };

    const mockRes = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      },
      end(data) {
        res.writeHead(this.statusCode);
        res.end(data);
      },
    };

    await defaultHandler(mockReq, mockRes);
  } catch (error) {
    console.error('API Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

function parseQuery(url) {
  const [, queryString] = url.split('?');
  if (!queryString) return {};

  const query = {};
  queryString.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    query[decodeURIComponent(key)] = decodeURIComponent(value || '');
  });
  return query;
}

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Dev API server running on http://localhost:${PORT}`);
});
