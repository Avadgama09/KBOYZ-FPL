// Dynamically import node-fetch for ESM compatibility
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

export default async function handler(req, res) {
  const { entryId } = req.query;
  try {
    const response = await fetch(
      `https://fantasy.premierleague.com/api/entry/${entryId}/`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: `FPL API returned ${response.status}` });
    }
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
