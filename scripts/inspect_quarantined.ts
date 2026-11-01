import * as fs from 'fs';
import * as path from 'path';

const storiesPath = path.join(process.cwd(), 'data', 'stories.json');
const stories = JSON.parse(fs.readFileSync(storiesPath, 'utf8'));
const q = stories.filter((s: any) => s.status === 'quarantined');

console.log('Quarantined stories count:', q.length);
q.slice(0, 15).forEach((s: any, idx: number) => {
  console.log(`[${idx+1}] ID: ${s.id} | Publisher: ${s.publisher} | Country: ${s.country}`);
  console.log(`     Title: ${s.title}`);
  console.log(`     Reason: ${s.quarantineReason}`);
  console.log(`     URL: ${s.originalUrl}`);
  console.log(`     Summary: "${s.summary}"\n`);
});
