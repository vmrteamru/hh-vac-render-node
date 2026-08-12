const express = require('express');
const app = express();

app.use(express.json({ limit: '10mb' }));

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function getRandomJitter() {
  return Math.floor(Math.random() * 90) + 30; // 30-120ms Jitter
}

function parseVacancyHtml(htmlText, vacId) {
  try {
    const match = htmlText.match(/window\.HH\.InitialState\s*=\s*/);
    if (!match) return { id: vacId, status: "unresolved_or_empty" };

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

    if (jsonEnd === -1) return { id: vacId, status: "unresolved_or_empty" };

    const rawJson = htmlText.substring(jsonStart, jsonEnd);
    const parsedState = JSON.parse(rawJson);

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
  } catch (err) {
    return { id: vacId, status: "unresolved_or_empty" };
  }
}

async function fetchVacancySingle(vacId) {
  const url = `https://hh.ru/vacancy/${vacId}`;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Sec-Ch-Ua": '"Not-A.Brand";v="99", "Chromium";v="124", "Google Chrome";v="124"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
      }
    });

    if (resp.status === 404) {
      return { id: vacId, status: "404" };
    }

    if (resp.status === 200) {
      const html = await resp.text();
      return parseVacancyHtml(html, vacId);
    }
  } catch (e) {}

  return { id: vacId, status: "unresolved_or_empty" };
}

app.get('/', (req, res) => {
  res.send('HH Vacancy Render Node is Active!');
});

app.post('/', async (req, res) => {
  const ids = req.body.ids || [];
  const results = [];

  for (let i = 0; i < ids.length; i++) {
    const vacId = ids[i];
    const item = await fetchVacancySingle(vacId);
    results.push(item);

    if (i < ids.length - 1) {
      await new Promise(r => setTimeout(r, getRandomJitter()));
    }
  }

  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Render Node listening on port ${PORT}`);
});
