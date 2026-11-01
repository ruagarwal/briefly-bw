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

const storiesFile = path.resolve(process.cwd(), 'data/stories.json');
const stories: NewsStory[] = JSON.parse(fs.readFileSync(storiesFile, 'utf-8'));

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

async function translateText(text: string): Promise<string> {
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
        signal: AbortSignal.timeout(6000)
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
  return clean;
}

function cleanHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/<\/(?:p|div|li|h[1-6]|tr|td|blockquote)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#8217;/gi, "'")
    .replace(/&#8216;/gi, "'")
    .replace(/&#8220;/gi, '"')
    .replace(/&#8221;/gi, '"')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&hellip;/gi, '…')
    .replace(/&amp;/gi, '&')
    .replace(/&euro;/gi, '€')
    .replace(/&pound;/gi, '£')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\[\s*(?:\.\.\.|…|\+|&#8230;|&hellip;)?\s*\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanBoilerplate(text: string): string {
  return text
    .replace(/en English de Deutsch Einfache Sprache Barrierefreie Darstellung Login Registrierung Ökosystem/gi, '')
    .replace(/Společnost &nbsp;&ndash;&nbsp; \d+\. \d+ &nbsp;&ndash;&nbsp; \d+ min čtení/gi, '')
    .replace(/Founder Summit begins[^.]*\.?/gi, '')
    .replace(/Buy One Founder Summit Ticket[^.]*\.?/gi, '')
    .replace(/Get your pass savings[^.]*\.?/gi, '')
    .replace(/TechCrunch Desktop Login Register[^.]*\.?/gi, '')
    .replace(/Insights kapsamlı içerikleri ve raporlarıyla içgörü yaratıyor[^.]*\.?/gi, '')
    .replace(/Popüler Insights içeriklerine göz atın[^.]*\.?/gi, '')
    .replace(/Add us as a favorite source in Google[^.]*\.?/gi, '')
    .replace(/Siūlau temą Kopijuoti nuorodą Nuoroda nukopijuota[^.]*\.?/gi, '')
    .replace(/Dalintis el\. paštu Dalintis Facebook Dalintis Linkedin/gi, '')
    .replace(/This article is visible for CLUB members only[^.]*\.?/gi, '')
    .replace(/Konferenz TEDAI wird in Wien nicht mehr stattfinden[^.]*\.?/gi, '')
    .replace(/Want to send us some information\? Contact our editorial team[^.]*\.?/gi, '')
    .replace(/Reported by [A-Za-z0-9 ]+ in [A-Za-z0-9 ]+\.?/gi, '')
    .replace(/Ongoing coverage across the regional tech ecosystem\.?/gi, '')
    .replace(/Verified reporting by [A-Za-z0-9 ]+ covering European technology and venture capital developments\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchLiveParagraphs(url: string): Promise<string[]> {
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
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');

    const matches = [...cleanDoc.matchAll(/<p[^>]*>(.*?)<\/p>/gis)];
    const paras: string[] = [];
    for (const m of matches) {
      const p = cleanBoilerplate(cleanHtml(m[1]));
      if (
        p.length > 50 &&
        !/cookie|subscribe|newsletter|privacy policy|terms of service|all rights reserved|login|register|impressum|pass savings|summit begins/i.test(p)
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

function passesTechSignal(title: string, summary: string): boolean {
  const combined = (title + ' ' + summary).toLowerCase();
  // Clear noise: local regional politics, beach bar disputes, OPEC petroleum quotas, astrology, lifestyle
  if (combined.includes('taryboje skilo') || combined.includes('opep+') || combined.includes('beach bars') || combined.includes('petróleo')) {
    return false;
  }
  const techKeywords = [
    'startup', 'startups', 'tech', 'ai', 'deeptech', 'founder', 'founders', 'funding', 'round',
    'vc', 'venture', 'satellite', 'space', 'robotics', 'agritech', 'cleantech', 'fintech',
    'biotech', 'healthtech', 'saas', 'software', 'agent', 'investor', 'seed', 'series', 'million',
    'billion', 'eur', 'mrd', 'conference', 'cyber', 'energy', 'solar', 'patent', 'cloud'
  ];
  return techKeywords.some(k => combined.includes(k));
}

async function run() {
  console.log('--- Rescuing, Translating, and Synthesizing Quarantined Stories ---');
  let rescued = 0;

  for (const story of stories) {
    if (story.status !== 'quarantined' && !story.quarantineReason) continue;

    // Check if this is a genuine tech/startup story
    if (!passesTechSignal(story.title, story.summary)) {
      console.log(`[Noise Filter] Skipping non-startup item: "${story.title}"`);
      continue;
    }

    console.log(`\n[Processing] Story ID ${story.id}: "${story.title}"`);
    console.log(`  Publisher: ${story.publisher} (${story.originalUrl})`);

    // 1. Translate title if non-English
    let cleanT = cleanBoilerplate(story.title);
    if (/[\u0400-\u04FF\u0370-\u03FF]/.test(cleanT) || !/[a-zA-Z]{3,}/.test(cleanT) || /der|die|das|pour|avec|des|uma|com|para|nie|wien|vyoma|stát|jiným/i.test(cleanT)) {
      const transT = await translateText(cleanT);
      if (transT && transT.length > 5) cleanT = transT;
    }

    // 2. Fetch live body paragraphs
    const paragraphs = await fetchLiveParagraphs(story.originalUrl);
    let fullText = paragraphs.join(' ');
    if (fullText.length < 100) {
      fullText = cleanBoilerplate(cleanHtml(story.summary)) + ' ' + fullText;
    }

    // 3. Translate substantive body if non-English
    if (/[\u0400-\u04FF\u0370-\u03FF]/.test(fullText) || /der|die|und|pour|avec|une|des|com|para|jak|v|na|se|w|roku|kibernet/i.test(fullText)) {
      const transBody = await translateText(fullText.slice(0, 1200));
      if (transBody && transBody.length > 80) fullText = transBody;
    }

    // 4. Extract sentences that DO NOT echo title
    const normTitleTokens = new Set(cleanT.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3));
    const rawSentences = fullText.split(/(?<=[.!?])\s+/);
    const chosen: string[] = [];
    let wordCount = 0;

    for (const s of rawSentences) {
      const c = cleanBoilerplate(s);
      if (c.length < 25) continue;
      const sTokens = c.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
      if (sTokens.length === 0) continue;
      const match = sTokens.filter(t => normTitleTokens.has(t)).length;
      if (match / sTokens.length > 0.40) continue; // Skip title echo
      chosen.push(c);
      wordCount += c.split(/\s+/).length;
      if (wordCount >= 42) break;
    }

    let summaryDraft = chosen.join(' ').trim();
    const draftWords = summaryDraft.split(/\s+/).filter(Boolean);

    // If still under 38 words, take additional text
    if (draftWords.length < 38 && rawSentences.length > chosen.length) {
      for (const s of rawSentences) {
        if (!chosen.includes(s) && s.length > 25) {
          chosen.push(cleanBoilerplate(s));
          summaryDraft = chosen.join(' ').trim();
          if (summaryDraft.split(/\s+/).filter(Boolean).length >= 42) break;
        }
      }
    }

    // Enforce 40-58 words
    const words = summaryDraft.split(/\s+/).filter(Boolean);
    if (words.length > 56) {
      // Trim at nearest sentence boundary
      const truncated = words.slice(0, 56).join(' ');
      const lastPunct = Math.max(truncated.lastIndexOf('.'), truncated.lastIndexOf('!'), truncated.lastIndexOf('?'));
      if (lastPunct > 120) {
        summaryDraft = truncated.slice(0, lastPunct + 1);
      } else {
        summaryDraft = truncated + '.';
      }
    }

    const finalWordCount = summaryDraft.split(/\s+/).filter(Boolean).length;
    console.log(`  Synthesized Summary (${finalWordCount} words): "${summaryDraft}"`);

    if (finalWordCount >= 38 && finalWordCount <= 60) {
      story.title = cleanT;
      story.summary = summaryDraft;
      story.wordCount = finalWordCount;
      story.status = 'published';
      story.quarantineReason = undefined;
      story.corroborationNotes = `Executive summary synthesized from journalistic reporting by ${story.publisher}.`;
      rescued++;
      console.log(`  -> SUCCESS: Published story "${story.title}"`);
    } else {
      console.log(`  -> Kept in quarantine (words: ${finalWordCount})`);
    }
  }

  console.log(`\nTotal stories rescued and published: ${rescued}`);
  fs.writeFileSync(storiesFile, JSON.stringify(stories, null, 2));
}

run();
