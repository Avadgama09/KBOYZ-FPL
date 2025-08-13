const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());

// Proxy all requests that start with /api to the official FPL API
app.use('/api', async (req, res) => {
  try {
    // Example incoming: /api/api/bootstrap-static/ → forward to https://fantasy.premierleague.com/api/bootstrap-static/
    const apiPath = req.originalUrl.substring(4); // remove leading "/api"
    const targetUrl = 'https://fantasy.premierleague.com' + apiPath;

    const upstream = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    const body = await upstream.text();

    res.status(upstream.status).type(contentType).send(body);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Proxy error' });
  }
});

app.listen(PORT, () => {
  console.log(`FPL proxy running on http://localhost:${PORT}`);
});
