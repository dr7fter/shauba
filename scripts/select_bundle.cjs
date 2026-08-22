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
  flatCats.push({ id: node.id, name: node.name, path: currentPath });
  if (node.children) node.children.forEach(c => flatten(c, currentPath));
}
for (const c of rootCats) flatten(c);
const catMap = new Map();
flatCats.forEach(c => catMap.set(c.id, c.path));

console.log('=== 1. 有理函数精选题库 ===');
const rationalQs = qs.filter(q => {
  const p = catMap.get(q.category_id) || '';
  return p.startsWith('高等数学 / 一元积分 / 积分计算 / 有理函数');
});
rationalQs.forEach(q => {
  const branch = catMap.get(q.category_id).split(' / ').slice(-2).join(' · ');
  console.log(`[#${q.id}] (${branch}) ${q.stem.slice(0, 100).replace(/\r?\n/g, ' ')}`);
});

console.log('\n=== 2. 含根式精选题库 ===');
const radicalQs = qs.filter(q => {
  const p = catMap.get(q.category_id) || '';
  return p.startsWith('高等数学 / 一元积分 / 积分计算 / 含根式');
});
radicalQs.forEach(q => {
  const branch = catMap.get(q.category_id).split(' / ').slice(-2).join(' · ');
  console.log(`[#${q.id}] (${branch}) ${q.stem.slice(0, 100).replace(/\r?\n/g, ' ')}`);
});
