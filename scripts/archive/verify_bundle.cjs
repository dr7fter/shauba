const fs = require('fs');
const qData = JSON.parse(fs.readFileSync('E:\\考研资料\\题库-大观园\\all_questions_20260813.json', 'utf8').replace(/^\uFEFF/, ''));
const qs = qData.questions || [];

const ids = [10624, 2008, 1029, 7052, 981, 7090, 7074, 7088];
ids.forEach(id => {
  const q = qs.find(item => item.id === id);
  if (q) {
    console.log(`[VERIFIED #${q.id}] ${q.stem.slice(0, 80).replace(/\r?\n/g, ' ')}`);
  } else {
    console.log(`[ERROR NOT FOUND #${id}]`);
  }
});
