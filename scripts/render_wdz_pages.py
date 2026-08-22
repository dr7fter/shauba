import fitz
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
pdf1 = r"E:\考研资料\信号\002 【刷题本】吴大正课后刷题本(全).pdf"
doc = fitz.open(pdf1)

output_dir = r"E:\考研资料\题库-信号\temp_wdz"
os.makedirs(output_dir, exist_ok=True)

for p in [0, 1, 2, 3, 4, 5, 10, 20]:
    if p < len(doc):
        pix = doc[p].get_pixmap(dpi=150)
        out_path = os.path.join(output_dir, f"wdz_page_{p+1:03d}.png")
        pix.save(out_path)
        print(f"Rendered wdz page {p+1} -> {out_path}")
