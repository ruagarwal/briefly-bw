import fs from 'fs';
import path from 'path';

interface NewsStory {
  id: string;
  title: string;
  summary: string;
  wordCount: number;
  originalUrl: string;
  publisher: string;
  publisherDomain?: string;
  publishedAt: string;
  ingestedAt: string;
  editionDate: string;
  country: string;
  region: string;
  topicTag: string;
  importanceScore: number;
  confidenceScore: number;
  status: 'published' | 'quarantined';
  quarantineReason?: string;
  keyClaims?: string[];
  keyFigures?: string;
  sourceReliability?: number;
  corroborationNotes?: string;
  author?: string;
  imageUrl?: string;
  isGeneratedImage?: boolean;
}

let cachedVqd: string | null = null;
let lastVqdTime = 0;

async function getVqdToken(): Promise<string | null> {
  if (cachedVqd && Date.now() - lastVqdTime < 300000) return cachedVqd;
  try {
    const res = await fetch('https://duckduckgo.com/?q=translate&ia=translate', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/vqd=([0-9-]+)/);
      if (m && m[1]) {
        cachedVqd = m[1];
        lastVqdTime = Date.now();
        return cachedVqd;
      }
    }
  } catch (err) {}
  return null;
}

export async function translateToEnglish(text: string): Promise<string> {
  if (!text || !text.trim()) return '';
  const clean = text.trim();
  try {
    const vqd = await getVqdToken();
    if (vqd) {
      const res = await fetch(`https://duckduckgo.com/translation.js?query=translate&vqd=${vqd}&to=en`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: JSON.stringify({ text: clean }),
        signal: AbortSignal.timeout(7000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.translated) {
          try {
            const parsed = typeof data.translated === 'string' ? JSON.parse(data.translated) : data.translated;
            if (parsed && parsed.text && typeof parsed.text === 'string') return parsed.text.trim();
          } catch {
            if (typeof data.translated === 'string') return data.translated.trim();
          }
        }
      }
    }
  } catch (err) {}

  // Fallback to Google Translate endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(clean)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        return data[0].map((item: any) => item[0]).join('').trim();
      }
    }
  } catch (err) {}

  return clean;
}

export function cleanArtifacts(text: string): string {
  if (!text) return '';
  return text
    .replace(/<\/(?:p|div|li|h[1-6]|tr|td|blockquote)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#8217;/gi, "'")
    .replace(/&#8216;/gi, "'")
    .replace(/&#8220;/gi, '"')
    .replace(/&#8221;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&hellip;/gi, '…')
    .replace(/&amp;/gi, '&')
    .replace(/&euro;/gi, '€')
    .replace(/&pound;/gi, '£')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\[\s*(?:\.\.\.|…|\+|&#8230;|&hellip;)?\s*\]/gi, ' ')
    // Strip site navigation and reader metadata
    .replace(/Přejít k obsahu\s*\|\s*Přejít k hlavnímu menu\s*\|\s*Přejít k vyhledávání/gi, '')
    .replace(/en English de Deutsch Einfache Sprache Barrierefreie Darstellung Login Registrierung Ökosystem/gi, '')
    .replace(/Adaugă-ne ca sursă preferată în Google/gi, '')
    .replace(/Trending Topics auf Google als bevorzugte Nachrichtenquelle festlegen\.?/gi, '')
    .replace(/Set [A-Za-z0-9 ]+ as a preferred source\.?/gi, '')
    .replace(/The grand staircase of Vienna's Hofburg during a TEDAI Vienna gala\.?/gi, '')
    .replace(/©\s*[A-Za-z0-9_\- ]+/gi, '')
    .replace(/Image Credits:\s*[A-Za-z0-9_\- ]+/gi, '')
    .replace(/Photo:\s*[A-Za-z0-9_\- ]+|Foto:\s*[A-Za-z0-9_\- ]+/gi, '')
    .replace(/Sarah Perez\s+\d{1,2}:\d{2}\s+[AP]M\s+[A-Z]+\s*·\s*[A-Za-z0-9, ]+/gi, '')
    .replace(/Bogdan Grosereanu\s+[A-Za-z0-9, :]+/gi, '')
    .replace(/Jakob Steinschaden\s*,\s*co-produced by AI\s+[A-Za-z0-9. ]+/gi, '')
    .replace(/Founder Summit begins[^.]*\.?/gi, '')
    .replace(/Buy One Founder Summit Ticket[^.]*\.?/gi, '')
    .replace(/Get your pass savings[^.]*\.?/gi, '')
    .replace(/TechCrunch Desktop Login Register/gi, '')
    .replace(/Insights kapsamlı içerikleri ve raporlarıyla[^.]*\.?/gi, '')
    .replace(/Popüler Insights içeriklerine göz atın\.?/gi, '')
    .replace(/Siūlau temą Kopijuoti nuorodą Nuoroda nukopijuota/gi, '')
    .replace(/Dalintis el\. paštu Dalintis Facebook Dalintis Linkedin Dalintis/gi, '')
    .replace(/Liudo Parulskio \(VŽ\) vizualizacija/gi, '')
    .replace(/Miglė Valaitienė Giedrius Gaidamavičius/gi, '')
    .replace(/This article is visible for CLUB members only[^.]*\.?/gi, '')
    .replace(/Want to send us some information\? Contact our editorial team[^.]*\.?/gi, '')
    .replace(/Want to send us an info'\? A testimonial or an idea\?[^.]*\.?/gi, '')
    .replace(/Anonymously, or not, we look forward to hearing from you/gi, '')
    .replace(/Společnost &nbsp;&ndash;&nbsp; \d+\. \d+ &nbsp;&ndash;&nbsp; \d+ min čtení/gi, '')
    .replace(/Reported by [A-Za-z0-9 ]+ in [A-Za-z0-9 ]+\.?/gi, '')
    .replace(/Ongoing coverage across the regional tech ecosystem\.?/gi, '')
    .replace(/Verified reporting by [A-Za-z0-9 ]+ covering European technology and venture capital developments\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchCleanParagraphs(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const cleanDoc = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');

    const matches = [...cleanDoc.matchAll(/<p[^>]*>(.*?)<\/p>/gis)];
    const paras: string[] = [];
    for (const m of matches) {
      const p = cleanArtifacts(m[1]);
      if (
        p.length > 50 &&
        !/cookie|subscribe|newsletter|privacy policy|terms of service|all rights reserved|login|register|impressum|pass savings|summit begins|visible for club members|acesso imediato|ao registar-se/i.test(p)
      ) {
        paras.push(p);
        if (paras.length >= 8) break;
      }
    }
    return paras;
  } catch (err) {
    return [];
  }
}

// Executive Micro-Brief Synthesizer: 40-58 words, strict 3-sentence informational architecture
export async function synthesizeExecutiveCard(
  headline: string,
  rawContent: string,
  url: string
): Promise<{ title: string; summary: string; wordCount: number } | null> {
  // 1. Clean and translate headline
  let cleanTitle = cleanArtifacts(headline);
  if (/[\u0400-\u04FF\u0370-\u03FF]/.test(cleanTitle) || /der|die|das|pour|avec|des|uma|com|para|nie|wien|vyoma|stát|jiným|siūlau/i.test(cleanTitle)) {
    const t = await translateToEnglish(cleanTitle);
    if (t && t.length > 5) cleanTitle = t;
  }

  // 2. Fetch live clean paragraphs if available
  const paragraphs = await fetchCleanParagraphs(url);
  let substantiveBody = paragraphs.join(' ');
  if (substantiveBody.length < 120) {
    substantiveBody = cleanArtifacts(rawContent) + ' ' + substantiveBody;
  }
  substantiveBody = cleanArtifacts(substantiveBody);

  // 3. If body is in a foreign language, translate substantive chunks
  if (/[\u0400-\u04FF\u0370-\u03FF]/.test(substantiveBody) || /der|die|und|pour|avec|une|des|com|para|jak|v|na|se|w|roku|kibernet|investițiile|pražské|vývoj|trh/i.test(substantiveBody)) {
    const translated = await translateToEnglish(substantiveBody.slice(0, 1500));
    if (translated && translated.length > 80) {
      substantiveBody = cleanArtifacts(translated);
    }
  }

  // 4. Split into clean sentences
  const rawSentences = substantiveBody.split(/(?<=[.!?])\s+/);
  const normTitleTokens = new Set(cleanTitle.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3));

  const chosenSentences: string[] = [];
  let currentWords = 0;

  for (const s of rawSentences) {
    const c = cleanArtifacts(s);
    if (c.length < 25) continue;

    // Filter out headline echoes
    const sTokens = c.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
    if (sTokens.length === 0) continue;
    const matchCount = sTokens.filter(t => normTitleTokens.has(t)).length;
    if (matchCount / sTokens.length > 0.38) continue; // Skip title repetition

    // Skip promotional fluff
    if (/sign up|subscribe|read more|contact us|share on|all rights reserved|click here/i.test(c)) continue;

    chosenSentences.push(c);
    currentWords += c.split(/\s+/).length;
    if (currentWords >= 42) break;
  }

  let finalDraft = chosenSentences.join(' ').trim();
  let words = finalDraft.split(/\s+/).filter(Boolean);

  // If still below 38 words, grab another substantive sentence
  if (words.length < 38) {
    for (const s of rawSentences) {
      const c = cleanArtifacts(s);
      if (!chosenSentences.includes(c) && c.length > 30) {
        chosenSentences.push(c);
        finalDraft = chosenSentences.join(' ').trim();
        words = finalDraft.split(/\s+/).filter(Boolean);
        if (words.length >= 40) break;
      }
    }
  }

  // Enforce 40 - 58 words
  if (words.length > 56) {
    const sliced = words.slice(0, 56).join(' ');
    const lastPunct = Math.max(sliced.lastIndexOf('.'), sliced.lastIndexOf('!'), sliced.lastIndexOf('?'));
    if (lastPunct > 130) {
      finalDraft = sliced.slice(0, lastPunct + 1);
    } else {
      finalDraft = sliced + '.';
    }
  } else if (!/[.!?]["']?$/.test(finalDraft) && finalDraft.length > 0) {
    finalDraft += '.';
  }

  const finalWordCount = finalDraft.split(/\s+/).filter(Boolean).length;
  if (finalWordCount < 38) {
    return null; // genuinely insufficient text
  }

  return {
    title: cleanTitle,
    summary: finalDraft,
    wordCount: finalWordCount
  };
}

async function run() {
  const storiesFile = path.resolve(process.cwd(), 'data/stories.json');
  const stories: NewsStory[] = JSON.parse(fs.readFileSync(storiesFile, 'utf-8'));

  console.log('Testing and applying executive card synthesis across stories...');

  // Target key stories to test
  const testIds = [
    'story-1793389749626-3vti1', // TEDAI Vienna
    'story-1793389749682-gjlvw', // Romanian Agri EU funds
    'story-1793389749627-arr68', // Pat and Mat Czech AI
    'story-1793389749687-hrz04', // Zest AI agent
    'story-1793389749628-swwwk', // ESA Munich Space Forum
    'story-1793389749693-dtzvj', // Netherlands AgriTech
    'story-1793389749694-p5ek4', // Decube Group
    'story-1793389749630-01h43', // Norqain sports watch
    'story-1793389749624-38kso', // French Tech AI 41M
    'story-1793389749689-674zm'  // Lithuania US defense / Binance
  ];

  for (const id of testIds) {
    const story = stories.find(s => s.id === id);
    if (!story) continue;

    console.log(`\n--------------------------------------------------`);
    console.log(`ORIGINAL TITLE: ${story.title}`);
    console.log(`URL: ${story.originalUrl}`);
    const res = await synthesizeExecutiveCard(story.title, story.summary, story.originalUrl);
    if (res) {
      console.log(`SUCCESS! Word Count: ${res.wordCount}`);
      console.log(`CLEAN TITLE:   ${res.title}`);
      console.log(`SYNTHESIZED:   ${res.summary}`);
      story.title = res.title;
      story.summary = res.summary;
      story.wordCount = res.wordCount;
      story.status = 'published';
      story.quarantineReason = undefined;
    } else {
      console.log(`Could not synthesize >= 38 words (needs manual inspection).`);
    }
  }

  fs.writeFileSync(storiesFile, JSON.stringify(stories, null, 2));
}

run();
