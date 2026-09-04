const fs = require('fs');
const path = require('path');

const qData = JSON.parse(fs.readFileSync('E:\\考研资料\\题库-大观园\\all_questions_20260813.json', 'utf8').replace(/^\uFEFF/, ''));
const qs = qData.questions || [];

const selectedIds = [
  10623, 1284, 10624, 2008, 1024, 1026, 1029, 7052,
  981, 10576, 7090, 10590, 7074, 7088, 7105, 1266
];

console.log('Verifying 16 selected questions:');
selectedIds.forEach((id, idx) => {
  const q = qs.find(item => item.id === id);
  if (q) {
    console.log(`[${idx + 1}] #${q.id}: ${q.stem.slice(0, 80).replace(/\r?\n/g, ' ')}`);
  } else {
    console.log(`[ERROR NOT FOUND #${id}]`);
  }
});

const appData = process.env.APPDATA || 'C:\\Users\\86136\\AppData\\Roaming';
const inboxDir = path.join(appData, 'com.shuaba.math', 'codex-inbox');

const recPayload = {
  schemaVersion: 1,
  kind: 'recommendation',
  taskId: 'SB-REC-20260819-int02',
  questionId: null,
  summary: '一元积分深度攻坚大题组：有理函数(8题) + 含根式(8题) 完整肌肉记忆梯度',
  verdict: null,
  earliestError: null,
  errorTags: [],
  weaknessTags: ['有理函数积分', '根式代换', '三角代换', '分部积分', '倒代换', '组合积分'],
  advice: '16道题按两阶段由浅入深递进：前8题打通有理函数裂项/配方/长除/对称技巧，后8题掌握根式直接换元/三角代换/倒代换/复合分部。',
  confidence: 0.98,
  recommendedQuestionIds: selectedIds,
  recommendationReason: '完整覆盖一元积分两大核心硬骨头：包含有理函数8种变式结构与含根式8种标准代换模型，题量适中，深度与梯度兼备。'
};

const targetFile = path.join(inboxDir, 'SB-REC-20260819-int02.json');
fs.writeFileSync(targetFile, JSON.stringify(recPayload, null, 2), 'utf8');
console.log('\nSuccessfully generated and saved recommendation to:', targetFile);
