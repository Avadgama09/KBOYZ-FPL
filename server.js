const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS for your frontend
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500']
}));

app.use(express.json());

// Rate limiting - simple implementation
let lastRequestTime = 0;
const RATE_LIMIT_MS = 100; // 100ms between requests

const rateLimitedFetch = async (url, options = {}) => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  return fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...options.headers
    }
  });
};

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'FPL Proxy Server Running',
    endpoints: {
      league: '/api/league/976735',
      bootstrap: '/api/bootstrap-static',
      entry: '/api/entry/:id'
    }
  });
});

// Generic FPL API proxy - handles ALL FPL endpoints
app.use('/api', async (req, res) => {
  try {
    const apiPath = req.originalUrl.substring(4); // remove leading "/api"
    const targetUrl = 'https://fantasy.premierleague.com/api' + apiPath;
    
    console.log(`[PROXY] ${req.method} ${targetUrl}`);
    
    const response = await rateLimitedFetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const contentType = response.headers.get('content-type') || 'application/json';
    const body = await response.text();
    
    res.status(response.status).type(contentType).send(body);
  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ FPL proxy running on http://localhost:${PORT}`);
  console.log(`📊 Test league endpoint: http://localhost:${PORT}/api/leagues-classic/976735/standings/`);
});
