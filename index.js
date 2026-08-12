const http = require('http');

const PORT = process.env.PORT || 10000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function buildResult(parsedState, vacId) {
  return {
    id: vacId,
    status: "ok",
    vacancyView: parsedState.vacancyView || {},
    vacancyInternalInfo: parsedState.vacancyInternalInfo || {},
    userLabelsForVacancies: parsedState.userLabelsForVacancies || {},
    vacancyChatInfo: parsedState.vacancyChatInfo || {},
    hasAiAssistantProperty: parsedState.hasAiAssistantProperty || false,
    hasNeuroSurveyProperty: parsedState.hasNeuroSurveyProperty || false,
    hasNraProperty: parsedState.hasNraProperty || false,
    hasNeuroInviteProperty: parsedState.hasNeuroInviteProperty || false,
    hasVacancyComplainButton: parsedState.hasVacancyComplainButton || false,
    isVacancyComplained: parsedState.isVacancyComplained || false,
    relatedVacanciesType: parsedState.relatedVacanciesType || null,
    relatedVacanciesEmployerId: parsedState.relatedVacanciesEmployerId || null,
    viewDuration: parsedState.viewDuration || 0,
    langs: parsedState.langs || {},
    applicantVacancyResponseStatuses: parsedState.applicantVacancyResponseStatuses || {}
  };
}

function parseVacancyHtml(htmlText, vacId) {
  try {
    const marker = 'id="HH-Lux-InitialState">';
    const startIdx = htmlText.indexOf(marker);
    
    if (startIdx !== -1) {
      const jsonStart = startIdx + marker.length;
      const tagEnd = htmlText.indexOf("</", jsonStart);
      if (tagEnd !== -1) {
        let rawJson = htmlText.substring(jsonStart, tagEnd);
        if (rawJson.indexOf("&#34;") !== -1) rawJson = rawJson.split("&#34;").join('"');
        if (rawJson.indexOf("&quot;") !== -1) rawJson = rawJson.split("&quot;").join('"');
        if (rawJson.indexOf("&amp;") !== -1) rawJson = rawJson.split("&amp;").join('&');

        const parsedState = JSON.parse(rawJson);
        // Проверка непустоты vacancyView
        if (parsedState && parsedState.vacancyView && Object.keys(parsedState.vacancyView).length > 0) {
          return buildResult(parsedState, vacId);
        }
      }
    }

    const match = htmlText.match(/window\.HH\.InitialState\s*=\s*/);
    if (match) {
      const jsonStart = match.index + match[0].length;
      let braceCount = 0;
      let jsonEnd = -1;

      for (let i = jsonStart; i < htmlText.length; i++) {
        const char = htmlText[i];
        if (char === '{') braceCount++;
        else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }

      if (jsonEnd !== -1) {
        const rawJson = htmlText.substring(jsonStart, jsonEnd);
        const parsedState = JSON.parse(rawJson);
        if (parsedState && parsedState.vacancyView && Object.keys(parsedState.vacancyView).length > 0) {
          return buildResult(parsedState, vacId);
        }
      }
    }
  } catch (_e) {}

  return { id: vacId, status: "unresolved_or_empty" };
}

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

    if (resp.status === 404) {
      return { id: vacId, status: "404" };
    }

    if (resp.status === 200) {
      const html = await resp.text();
      return parseVacancyHtml(html, vacId);
    }
  } catch (_e) {}

  return { id: vacId, status: "unresolved_or_empty" };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('HH Vacancy Render Node is Active!');
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
