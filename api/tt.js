// api/tt.js
export default async function handler(req, res) {
  const url = (req.query.url || '').toString()
  if (!url) return res.status(400).json({ error: 'url parameter is required' })

  // CHANGE THIS upstream to point to your working TikTok API if different
  const upstream = `https://tiktokdownloaders.vercel.app/api/tt?url=${encodeURIComponent(url)}`

  try {
    const r = await fetch(upstream)
    if (!r.ok) {
      const t = await r.text()
      throw new Error(`${r.status} ${r.statusText} - ${t}`)
    }
    const data = await r.json()
    return res.json(data)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
