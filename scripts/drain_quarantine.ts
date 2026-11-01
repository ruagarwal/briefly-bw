import * as fs from 'fs';
import * as path from 'path';

const storiesPath = path.join(process.cwd(), 'data', 'stories.json');
const allStories = JSON.parse(fs.readFileSync(storiesPath, 'utf8'));

let cachedVqd: string | null = null;
let lastVqdTime = 0;

async function getVqdToken(): Promise<string | null> {
  if (cachedVqd && Date.now() - lastVqdTime < 300000) {
    return cachedVqd;
  }
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
  if (!text || text.trim().length === 0) return '';
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
            if (parsed && parsed.text && typeof parsed.text === 'string') {
              return parsed.text.trim();
            }
          } catch {
            if (typeof data.translated === 'string') return data.translated.trim();
          }
        }
      }
    }
  } catch (err) {}

  return clean;
}

function cleanPublisherBoilerplate(text: string): string {
  if (!text) return '';
  return text
    .replace(/Volg\s+[A-Za-z0-9\/_\- ]+\s+op\s+Google\s+Discover/gi, '')
    .replace(/L[’']article\s+.+\s+est\s+apparu\s+en\s+premier\s+sur.+/gi, '')
    .replace(/Der\s+Beitrag\s+.+\s+erschien\s+zuerst\s+auf.+/gi, '')
    .replace(/Sign\s+up\s+for\s+our\s+newsletter/gi, '')
    .replace(/The\s+post\s+.+\s+appeared\s+first\s+on.+/gi, '')
    .replace(/Set\s+[A-Za-z0-9\/_\- ]+\s+as\s+a\s+preferred\s+source/gi, '')
    .replace(/Link\s+kopieren|Foto:|Photo:|Image:|Credits:/gi, '')
    .replace(/©\s*[^.]*?(?:Unsplash|Pexels|Getty|Reuters)[^.]*\.?/gi, '')
    .replace(/Buy One Founder Summit Ticket[^.]*\.?/gi, '')
    .replace(/Menu ECO login \| register[^.]*\.?/gi, '')
    .replace(/Log in to subscribe[^.]*\.?/gi, '')
    .replace(/Tech\.eu Insights creates insight[^.]*\.?/gi, '')
    .replace(/Reported by [A-Za-z0-9 ]+ in [A-Za-z0-9 ]+\.?/gi, '')
    .replace(/Ongoing coverage across the regional tech ecosystem\.?/gi, '')
    .replace(/Verified reporting by [A-Za-z0-9 ]+ covering European technology and venture capital developments\.?/gi, '')
    .replace(/Utilizamos conexões seguras[^.]*\.?/gi, '')
    .replace(/Ao registar-se está a aceitar[^.]*\.?/gi, '')
    .replace(/Acesso imediato a todo o conteúdo[^.]*\.?/gi, '')
    .replace(/Přejít k obsahu\s*\|\s*Přejít k hlavnímu menu[^.]*\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function hydrateArticle(url: string, rawSnippet: string = ''): Promise<string> {
  const cleanSnippet = cleanPublisherBoilerplate(rawSnippet);
  if (cleanSnippet.split(/\s+/).length >= 75) return cleanSnippet;
  if (!url || !url.startsWith('http')) return cleanSnippet;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const html = await res.text();
      const cleanedHtml = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');

      const pMatches = [...cleanedHtml.matchAll(/<p[^>]*>(.*?)<\/p>/gis)];
      const paragraphs: string[] = [];

      for (const m of pMatches) {
        const text = cleanPublisherBoilerplate(m[1].replace(/<[^>]+>/g, ' '));
        if (text.length > 45 && !/cookie|subscribe|newsletter|privacy policy|terms of service|all rights reserved|login \| register/i.test(text)) {
          paragraphs.push(text);
          if (paragraphs.length >= 6) break;
        }
      }

      if (paragraphs.length > 0) {
        const combined = paragraphs.join(' ');
        if (combined.split(/\s+/).length >= 40) return combined;
      }
    }
  } catch (err) {}

  return cleanSnippet;
}

function enforce60Words(text: string, maxWords = 56): { text: string; wordCount: number } {
  let cleaned = text.trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) {
    const trimmed = words.slice(0, maxWords).join(' ');
    const lastPunct = Math.max(trimmed.lastIndexOf('. '), trimmed.lastIndexOf('! '), trimmed.lastIndexOf('? '));
    if (lastPunct > 80) {
      cleaned = trimmed.slice(0, lastPunct + 1).trim();
    } else {
      cleaned = trimmed.replace(/[,;:\s]+$/, '') + '.';
    }
  }
  if (!/[.!?]["']?$/.test(cleaned)) cleaned += '.';
  const finalWords = cleaned.split(/\s+/).filter(Boolean);
  return { text: cleaned, wordCount: finalWords.length };
}

async function run() {
  console.log('Scanning quarantined stories to read, translate, and publish...');
  const quarantined = allStories.filter((s: any) => s.status === 'quarantined');
  console.log(`Found ${quarantined.length} quarantined stories.`);

  let newlyPublished = 0;

  for (const story of quarantined) {
    // Skip junk (link-dumps, podcasts, consumer gossip)
    if (/\+{3,}|\/{3,}|#weekly/i.test(story.title) || /gastronomijos|spooky science|antifrágil|anthony bourbon/i.test(story.title.toLowerCase())) {
      continue;
    }

    try {
      console.log(`\nProcessing: "${story.title}" (${story.publisher})`);
      const transTitle = await translateText(story.title);
      const hydratedBody = await hydrateArticle(story.originalUrl, story.summary);

      if (!hydratedBody || hydratedBody.length < 50) {
        console.log('  -> Skipping: insufficient content on original page');
        continue;
      }

      const transBody = await translateText(hydratedBody);

      // Extract non-echoing sentences
      const sentences = transBody.split(/(?<=[.!?])\s+/);
      const normTitle = transTitle.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
      const titleTokens = new Set(normTitle.split(/\s+/).filter((w: string) => w.length > 3));

      const candidates: string[] = [];
      let totalWords = 0;

      for (const s of sentences) {
        const clean = cleanPublisherBoilerplate(s);
        if (clean.length < 25) continue;
        const normS = clean.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
        const sTokens = normS.split(/\s+/).filter(w => w.length > 3);
        const match = sTokens.filter(t => titleTokens.has(t)).length;
        if (sTokens.length > 0 && match / sTokens.length > 0.35) continue;
        if (normS.includes(normTitle)) continue;

        candidates.push(clean);
        totalWords += clean.split(/\s+/).length;
        if (totalWords >= 42) break;
      }

      const drafted = candidates.join(' ').trim();
      const { text: finalSummary, wordCount } = enforce60Words(drafted, 56);

      // Check quality: >= 40 words, English, no boilerplate
      if (wordCount >= 40 && wordCount <= 58 && !/[\u0400-\u04FF]/.test(finalSummary) && !/utilizamos/i.test(finalSummary)) {
        story.title = transTitle;
        story.summary = finalSummary;
        story.wordCount = wordCount;
        story.status = 'published';
        story.quarantineReason = undefined;
        newlyPublished++;
        console.log(`  -> QUALIFIED & PUBLISHED (${wordCount} words):`);
        console.log(`     "${finalSummary}"`);
      } else {
        console.log(`  -> Remains in quarantine: wordCount = ${wordCount}`);
      }
    } catch (err: any) {
      console.log('  -> Error:', err.message);
    }
  }

  fs.writeFileSync(storiesPath, JSON.stringify(allStories, null, 2), 'utf8');
  console.log(`\n======================================================`);
  console.log(`Completed! Upgraded and published ${newlyPublished} stories from quarantine.`);
  console.log(`Total Published Stories Now: ${allStories.filter((s: any) => s.status === 'published').length}`);
  console.log(`======================================================`);
}

run().catch(console.error);
