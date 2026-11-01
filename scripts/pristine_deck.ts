import * as fs from 'fs';
import * as path from 'path';

const storiesPath = path.join(process.cwd(), 'data', 'stories.json');
const allStories = JSON.parse(fs.readFileSync(storiesPath, 'utf8'));

// Quarantine any story with non-Latin, foreign stopwords, or nav artifacts:
for (const s of allStories) {
  const hasForeign = /[\u0400-\u04FF\u0370-\u03FF]|\b(der|die|das|und|pour|avec|dans|des|une|est|kopijuoti|dalintis|siūlau|recherche|rubrique|hausverwaltung|anzeige|verpasse|společnost|animátoři|pata|mata)\b/i.test(s.summary);
  const hasNav = /founder summit|techcrunch desktop logo|estonian-ukrainian defensetech startup lands/i.test(s.summary);
  const hasDigest = /\+{3,}|\/{3,}|#weekly/i.test(s.title);

  if (s.status === 'published' && (hasForeign || hasNav || hasDigest || s.wordCount < 38 || s.wordCount > 58)) {
    s.status = 'quarantined';
    s.quarantineReason = 'Automated quality gate quarantine: foreign text, navbar artifacts, or invalid word count.';
  }
}

fs.writeFileSync(storiesPath, JSON.stringify(allStories, null, 2), 'utf8');

const cleanPublished = allStories.filter((s: any) => s.status === 'published');
console.log('Total pristine published stories:', cleanPublished.length);
cleanPublished.forEach((s: any, idx: number) => {
  console.log(`[${idx+1}] (${s.wordCount} words) "${s.title}" (${s.publisher})`);
  console.log(`     "${s.summary}"\n`);
});
