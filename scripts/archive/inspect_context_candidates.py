import json

with open(r"C:\Users\86136\AppData\Roaming\com.shuaba.math\codex-tasks\SB-AI-202608260929-1347.context.json", "r", encoding="utf-8") as f:
    ctx = json.load(f)

print(f"Total candidates: {len(ctx['candidates'])}")
categories = {}
for c in ctx['candidates']:
    cat = c['categoryPath']
    categories.setdefault(cat, []).append(c)

for cat, qlist in categories.items():
    print(f"\n--- {cat} ({len(qlist)} questions) ---")
    for q in qlist[:4]:
        print(f"  [{q['questionId']}] ({q['questionType']}, diff {q['difficulty']}) {q['stem'][:60]}")
