// ============================================
// K-BOYZ FPL 2025/26 - Production Server.js
// ============================================

const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  PORT: process.env.PORT || 5001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FPL_BASE_URL: 'https://fantasy.premierleague.com/api',

  // Rate limiting
  RATE_LIMIT: {
    MIN_INTERVAL: 100,     // Minimum 100ms between FPL requests
    BURST_LIMIT: 5,        // Max 5 requests per burst
    BURST_WINDOW: 1000,    // 1 second burst window
    DAILY_LIMIT: 10000     // Conservative daily limit
  },

  // Caching
  CACHE: {
    BOOTSTRAP: 60 * 60 * 1000,      // 1 hour for bootstrap-static
    STANDINGS: 5 * 60 * 1000,       // 5 minutes for standings
    ENTRY: 5 * 60 * 1000,           // 5 minutes for entry data
    HISTORY: 10 * 60 * 1000,        // 10 minutes for history
    PICKS: 5 * 60 * 1000,           // 5 minutes for picks
    DEFAULT: 5 * 60 * 1000          // Default cache duration
  },

  // Security
  CORS_ORIGINS: [
    'http://127.0.0.1:5500',        // VSCode Live Server
    'http://localhost:5500',        // Live Server alternate
    'http://localhost:5001',        // Self
    'http://localhost:3000',        // Common React dev
    'https://kboyz-fpl.vercel.app', // Production domain
    'https://*.vercel.app'          // Vercel previews
  ]
};

// ============================================
// APPLICATION SETUP
// ============================================

const app = express();

// Trust proxy for production deployment
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // CSP for security
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Required for inline scripts
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
    "font-src 'self' fonts.gstatic.com r2cdn.perplexity.ai",
    "img-src 'self' data: https:",
    "connect-src 'self' fantasy.premierleague.com",
    "frame-ancestors 'none'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  next();
});

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list or matches pattern
    const isAllowed = CONFIG.CORS_ORIGINS.some(allowed => {
      if (allowed.includes('*')) {
        const regex = new RegExp(allowed.replace('*', '.*'));
        return regex.test(origin);
      }
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: false, // No credentials needed for FPL data
  methods: ['GET', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Accept', 'Cache-Control'],
  maxAge: 86400 // 24 hours
}));

// Parse JSON requests
app.use(express.json({ limit: '1mb' }));

// Serve static files with proper caching
app.use(express.static(path.join(__dirname, '/'), {
  maxAge: CONFIG.NODE_ENV === 'production' ? '1d' : '0',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Set appropriate cache headers based on file type
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.html':
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        break;
      case '.js':
      case '.css':
        res.setHeader('Cache-Control', CONFIG.NODE_ENV === 'production' 
          ? 'public, max-age=86400' 
          : 'no-cache'
        );
        break;
      case '.png':
      case '.jpg':
      case '.jpeg':
      case '.gif':
      case '.ico':
      case '.svg':
        res.setHeader('Cache-Control', 'public, max-age=604800'); // 1 week
        break;
      default:
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
    }
  }
}));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
  next();
});

// ============================================
// RATE LIMITING & CACHING
// ============================================

class RateLimiter {
  constructor() {
    this.requests = [];
    this.lastRequestTime = 0;
    this.dailyRequests = 0;
    this.dailyReset = Date.now() + (24 * 60 * 60 * 1000);
  }

  async waitForSlot() {
    const now = Date.now();

    // Reset daily counter if needed
    if (now > this.dailyReset) {
      this.dailyRequests = 0;
      this.dailyReset = now + (24 * 60 * 60 * 1000);
    }

    // Check daily limit
    if (this.dailyRequests >= CONFIG.RATE_LIMIT.DAILY_LIMIT) {
      throw new Error('Daily request limit exceeded');
    }

    // Remove old requests from burst window
    this.requests = this.requests.filter(
      time => now - time < CONFIG.RATE_LIMIT.BURST_WINDOW
    );

    // Check burst limit
    if (this.requests.length >= CONFIG.RATE_LIMIT.BURST_LIMIT) {
      const waitTime = CONFIG.RATE_LIMIT.BURST_WINDOW - (now - this.requests[0]);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.waitForSlot(); // Retry after waiting
      }
    }

    // Check minimum interval
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < CONFIG.RATE_LIMIT.MIN_INTERVAL) {
      const waitTime = CONFIG.RATE_LIMIT.MIN_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Record this request
    this.requests.push(Date.now());
    this.lastRequestTime = Date.now();
    this.dailyRequests++;
  }
}

class ResponseCache {
  constructor() {
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0 };

    // Clean expired entries every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  set(key, data, ttl = CONFIG.CACHE.DEFAULT) {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
      created: Date.now()
    });
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      total,
      hitRate: total ? (this.stats.hits / total * 100).toFixed(1) : '0.0',
      size: this.cache.size
    };
  }

  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }
}

const rateLimiter = new RateLimiter();
const responseCache = new ResponseCache();

// ============================================
// FPL API PROXY FUNCTIONS
// ============================================

async function fetchFromFPL(apiPath, options = {}) {
  const targetUrl = CONFIG.FPL_BASE_URL + apiPath;

  // Wait for rate limit slot
  await rateLimiter.waitForSlot();

  console.log(`[FPL] Fetching: ${targetUrl}`);

  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; K-BOYZ-FPL/1.0; +https://kboyz-fpl.vercel.app)',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...options.headers
    },
    timeout: 15000 // 15 second timeout
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `FPL API Error: ${response.status} ${response.statusText}\n` +
      `URL: ${targetUrl}\n` +
      `Body: ${errorText.slice(0, 500)}`
    );
  }

  return response;
}

function getCacheTTL(apiPath) {
  if (apiPath.includes('bootstrap-static')) {
    return CONFIG.CACHE.BOOTSTRAP;
  } else if (apiPath.includes('standings')) {
    return CONFIG.CACHE.STANDINGS;
  } else if (apiPath.includes('/entry/') && !apiPath.includes('/picks')) {
    return CONFIG.CACHE.ENTRY;
  } else if (apiPath.includes('/history')) {
    return CONFIG.CACHE.HISTORY;
  } else if (apiPath.includes('/picks')) {
    return CONFIG.CACHE.PICKS;
  }
  return CONFIG.CACHE.DEFAULT;
}

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  const cacheStats = responseCache.getStats();

  res.json({
    status: 'OK',
    service: 'K-BOYZ FPL Proxy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    environment: CONFIG.NODE_ENV,
    port: CONFIG.PORT,
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    },
    cache: cacheStats,
    rateLimiter: {
      dailyRequests: rateLimiter.dailyRequests,
      dailyLimit: CONFIG.RATE_LIMIT.DAILY_LIMIT
    }
  });
});

// Debug endpoint (development only)
if (CONFIG.NODE_ENV === 'development') {
  app.get('/debug', (req, res) => {
    res.json({
      config: {
        ...CONFIG,
        // Don't expose sensitive data
      },
      cache: responseCache.getStats(),
      rateLimiter: {
        requests: rateLimiter.requests.length,
        dailyRequests: rateLimiter.dailyRequests,
        lastRequest: new Date(rateLimiter.lastRequestTime).toISOString()
      }
    });
  });

  app.post('/debug/cache/clear', (req, res) => {
    responseCache.clear();
    res.json({ message: 'Cache cleared successfully' });
  });
}

// Generic FPL API proxy
app.use('/api', async (req, res) => {
  try {
    const apiPath = req.originalUrl.substring(4); // Remove '/api' prefix
    const cacheKey = `${req.method}:${apiPath}`;
    const cacheTTL = getCacheTTL(apiPath);

    // Check cache first
    const cachedResponse = responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log(`[CACHE] Hit for ${apiPath}`);
      return res.json(cachedResponse);
    }

    console.log(`[CACHE] Miss for ${apiPath}`);

    // Fetch from FPL API
    const response = await fetchFromFPL(apiPath);
    const contentType = response.headers.get('content-type') || 'application/json';
    const responseText = await response.text();

    // Parse JSON response
    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
    } catch (parseError) {
      console.warn(`[PARSE] Failed to parse JSON for ${apiPath}, attempting cleanup...`);
      // Attempt to fix common JSON issues
      const cleanedJson = responseText
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      jsonData = JSON.parse(cleanedJson);
    }

    // Cache successful responses
    responseCache.set(cacheKey, jsonData, cacheTTL);

    // Set appropriate cache headers
    if (response.ok) {
      const maxAge = Math.floor(cacheTTL / 1000);
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
      res.setHeader('ETag', `"${Date.now()}"`);
    }

    res.status(response.status).json(jsonData);

  } catch (error) {
    console.error('[PROXY] Error:', {
      url: req.originalUrl,
      message: error.message,
      stack: CONFIG.NODE_ENV === 'development' ? error.stack : undefined
    });

    // Determine appropriate error response
    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error.message.includes('FPL API Error')) {
      statusCode = 502;
      errorMessage = 'Fantasy Premier League API is currently unavailable';
    } else if (error.message.includes('timeout')) {
      statusCode = 504;
      errorMessage = 'Request timeout - please try again';
    } else if (error.message.includes('Daily request limit')) {
      statusCode = 429;
      errorMessage = 'Rate limit exceeded - please try again later';
    }

    res.status(statusCode).json({
      error: true,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      ...(CONFIG.NODE_ENV === 'development' && {
        details: error.message,
        path: req.originalUrl
      })
    });
  }
});

// Catch-all route - serve index.html for client-side routing
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');

  // Check if index.html exists
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({
      error: true,
      message: 'Application not found',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

// Global error handler
app.use((error, req, res, next) => {
  console.error('[ERROR] Unhandled error:', {
    message: error.message,
    stack: CONFIG.NODE_ENV === 'development' ? error.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    error: true,
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Handle 404s
app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: 'Endpoint not found',
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

function gracefulShutdown(signal) {
  console.log(`\n[SHUTDOWN] Received ${signal}, shutting down gracefully...`);

  // Clean up resources
  responseCache.clear();

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ============================================
// SERVER STARTUP
// ============================================

const server = app.listen(CONFIG.PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 K-BOYZ FPL Server Started Successfully!');
  console.log('='.repeat(50));
  console.log(`📍 Server: http://localhost:${CONFIG.PORT}`);
  console.log(`🌐 Environment: ${CONFIG.NODE_ENV}`);
  console.log(`📊 Test endpoint: http://localhost:${CONFIG.PORT}/api/leagues-classic/976735/standings/`);
  console.log(`💚 Health check: http://localhost:${CONFIG.PORT}/health`);
  console.log(`📈 Cache TTL: Bootstrap=${CONFIG.CACHE.BOOTSTRAP/1000/60}min, Standings=${CONFIG.CACHE.STANDINGS/1000/60}min`);
  console.log(`⚡ Rate limit: ${CONFIG.RATE_LIMIT.BURST_LIMIT} req/sec, ${CONFIG.RATE_LIMIT.DAILY_LIMIT} req/day`);
  console.log('='.repeat(50) + '\n');
});

// Set server timeout
server.timeout = 30000; // 30 seconds

module.exports = app;