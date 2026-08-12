const http = require('http');

const PORT = process.env.PORT || 10000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchVacancySingle(vacId) {
  const url = `https://hh.ru/vacancy/${vacId}`;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });

    const html = await resp.text();
    return {
      id: vacId,
      hh_status: resp.status,
      redirected: resp.redirected,
      final_url: resp.url,
      html_len: html.length,
      has_lux: html.indexOf('id="HH-Lux-InitialState">') !== -1,
      has_init: html.indexOf('InitialState') !== -1,
      sample: html.substring(0, 150)
    };
  } catch (e) {
    return { id: vacId, err: String(e) };
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('HH Vacancy Render Node Diagnostic is Active!');
    return;
  }

  if (req.method === 'POST') {
    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyStr);
        const ids = body.ids || [];
        const results = await Promise.all(ids.map(id => fetchVacancySingle(id)));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(results));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
