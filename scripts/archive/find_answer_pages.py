import fitz
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
pdf2 = r"E:\考研资料\信号\2027考研信号系统-基础习题--风中醉风.pdf"
doc = fitz.open(pdf2)

# Let's render a few sample pages towards the middle and end to see where answers start
check_pages = [30, 40, 50, 60, 70, 80, 90, 100, 105]
output_dir = r"E:\考研资料\题库-信号\temp_pages"

for p in check_pages:
    if p < len(doc):
        pix = doc[p].get_pixmap(dpi=150)
        out_path = os.path.join(output_dir, f"page_{p+1:03d}.png")
        pix.save(out_path)
        print(f"Rendered page {p+1} -> {out_path}")
