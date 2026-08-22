import fitz
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

pdf2 = r"E:\考研资料\信号\2027考研信号系统-基础习题--风中醉风.pdf"
doc = fitz.open(pdf2)

output_dir = r"E:\考研资料\题库-信号\temp_pages"
os.makedirs(output_dir, exist_ok=True)

for pno in range(10, min(30, len(doc))):
    page = doc[pno]
    pix = page.get_pixmap(dpi=150)
    out_path = os.path.join(output_dir, f"page_{pno+1:03d}.png")
    pix.save(out_path)
    print(f"Rendered page {pno+1} -> {out_path}")
