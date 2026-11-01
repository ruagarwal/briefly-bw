import fs from 'fs';
import path from 'path';

const file = path.resolve(process.cwd(), 'data/stories.json');
const stories = JSON.parse(fs.readFileSync(file, 'utf-8'));

for (const s of stories) {
  if (s.id === 'story-1793540985398-7e11q') {
    s.summary = "The floodgates reopened as the feared bank run materialized as a modest trickle, with $2.5 billion in customer assets flowing out smoothly. Just under three days after suffering the largest crypto theft in history, Binance resumed full customer withdrawals on Sunday morning. The exchange's native token BNB stabilized above key support levels, reassuring nervous digital asset markets.";
    s.wordCount = s.summary.split(/\s+/).filter(Boolean).length;
    console.log('Fixed Binance story:', s.wordCount, 'words');
  }
  if (s.id === 'story-1793485522053-yjxd4') {
    s.status = 'quarantined';
    s.quarantineReason = 'Event ticket marketing promotion notice';
    console.log('Quarantined TechCrunch event promo');
  }
}

fs.writeFileSync(file, JSON.stringify(stories, null, 2));
