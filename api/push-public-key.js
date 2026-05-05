module.exports = async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY || '';
    if (!publicKey) return res.status(503).json({ error: 'push_public_key_unavailable' });
    return res.status(200).json({ publicKey });
  } catch (error) {
    return res.status(500).json({ error: 'push_public_key_error', detail: String(error?.message || error) });
  }
};
