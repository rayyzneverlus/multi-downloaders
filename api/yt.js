// api/yt.js
export default async function handler(req, res) {
  const url = (req.query.url || '').toString();
  const format = (req.query.format || 'mp3').toString();

  if (!url) return res.status(400).json({ error: 'url parameter is required' });
  const valid = ['mp3','360p','720p','1080p'];
  if (!valid.includes(format)) return res.status(400).json({ error: 'invalid format' });

  const baseOrigin = 'https://ssvid.net'
  const headers = {
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    origin: baseOrigin,
    referer: baseOrigin + '/youtube-to-mp3'
  }

  const hit = async (path, payload) => {
    const body = new URLSearchParams(payload)
    const r = await fetch(baseOrigin + path, { method: 'POST', headers, body })
    if (!r.ok) {
      const text = await r.text()
      throw new Error(`${r.status} ${r.statusText} - ${text}`)
    }
    return r.json()
  }

  try {
    // 1. search
    let search = await hit('/api/ajax/search', { query: url, cf_token: '', vt: 'youtube' })
    if (search.p === 'search') {
      if (!search?.items?.length) throw new Error('video not found')
      const { v } = search.items[0]
      const videoUrl = 'https://www.youtube.com/watch?v=' + v
      search = await hit('/api/ajax/search', { query: videoUrl, cf_token: '', vt: 'youtube' })
    }

    const vid = search.vid

    // 2. choose format key
    let k
    if (format === 'mp3') k = search.links?.mp3?.mp3128?.k
    else {
      const allFormats = Object.entries(search.links?.mp4 || {})
      // find exact quality label
      const find = allFormats.find(v => v[1].q === format)
      if (find) k = find[1].k
      else {
        // fallback to highest available
        const quality = allFormats.map(v => v[1].q).filter(q => /\d+p/.test(q)).map(q => parseInt(q)).sort((a,b)=>b-a).map(q=>q+'p')
        const selected = quality[0]
        const f = allFormats.find(v=>v[1].q===selected)
        k = f?.[1]?.k
      }
    }
    if (!k) throw new Error('requested format not available')

    // 3. convert
    const convert = await hit('/api/ajax/convert', { k, vid })
    if (convert.c_status === 'CONVERTING') {
      // poll a few times
      let attempt = 0
      let converted
      do {
        attempt++
        await new Promise(r => setTimeout(r, 2000))
        converted = await hit('/api/convert/check?hl=en', { vid, b_id: convert.b_id })
        if (converted.c_status === 'CONVERTED') {
          return res.json({ title: search.title, format, dlink: converted.dlink, raw: converted })
        }
      } while(attempt < 6 && converted?.c_status === 'CONVERTING')
      throw new Error('file not ready yet')
    }

    // immediate return
    return res.json({ title: search.title, format, dlink: convert.dlink, raw: convert })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
      }
