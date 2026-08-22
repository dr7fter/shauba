const fs = require('fs');

function readJson(p) {
  let content = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(content);
}

const rootCats = readJson('E:\\考研资料\\题库-大观园\\categories.json');
const qData = readJson('E:\\考研资料\\题库-大观园\\all_questions_20260813.json');
const qs = qData.questions || [];

const flatCats = [];
function flatten(node, parentPath = '') {
  const currentPath = parentPath ? (parentPath + ' / ' + node.name) : node.name;
  flatCats.push({
    id: node.id,
    name: node.name,
    path: currentPath,
    count: node.total_question_count || node.question_count || 0,
    directCount: node.question_count || 0
  });
  if (node.children) {
    for (const child of node.children) {
      flatten(child, currentPath);
    }
  }
}

for (const c of rootCats) flatten(c);

const catMap = new Map();
flatCats.forEach(c => catMap.set(c.id, c.path));

console.log('=== 一元积分 / 积分计算 所有子分支 ===');
const calcBranches = flatCats.filter(c => c.path.startsWith('高等数学 / 一元积分 / 积分计算'));
calcBranches.forEach(c => console.log(`[#${c.id}] ${c.path} (total: ${c.count}, direct: ${c.directCount})`));

console.log('\n=== 有理函数题型详细题目展示 ===');
const rationalQs = qs.filter(q => {
  const p = catMap.get(q.category_id) || '';
  return p.includes('有理函数');
});

const byCategory = new Map();
rationalQs.forEach(q => {
  const p = catMap.get(q.category_id) || '未知';
  if (!byCategory.has(p)) byCategory.set(p, []);
  byCategory.get(p).push(q);
});

for (const [p, list] of byCategory.entries()) {
  console.log(`\n========================================`);
  console.log(`【${p}】 (共 ${list.length} 题)`);
  list.forEach((q, idx) => {
    console.log(`  (${idx + 1}) #${q.id} [难度${q.difficulty}]: ${q.stem.slice(0, 150).replace(/\r?\n/g, ' ')}`);
  });
}
