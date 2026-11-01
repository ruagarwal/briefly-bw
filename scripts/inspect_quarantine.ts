import fs from 'fs';
import path from 'path';

interface NewsStory {
  id: string;
  title: string;
  summary: string;
  wordCount: number;
  originalUrl: string;
  publisher: string;
  status: string;
  quarantineReason?: string;
  [key: string]: any;
}

const storiesFile = path.resolve(process.cwd(), 'data/stories.json');
const stories: NewsStory[] = JSON.parse(fs.readFileSync(storiesFile, 'utf-8'));

console.log('Total stories:', stories.length);
const quarantined = stories.filter(s => s.status === 'quarantined' || s.quarantineReason);
console.log('Quarantined stories count:', quarantined.length);

quarantined.forEach((s, idx) => {
  console.log(`[${idx + 1}] Title: "${s.title}"`);
  console.log(`     Publisher: ${s.publisher}`);
  console.log(`     Reason: ${s.quarantineReason}`);
  console.log(`     URL: ${s.originalUrl}`);
  console.log(`     Current Summary (${s.wordCount} words): "${s.summary.slice(0, 100)}..."\n`);
});
