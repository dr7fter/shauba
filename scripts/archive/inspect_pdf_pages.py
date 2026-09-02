import fitz
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

pdf1 = r"E:\考研资料\信号\002 【刷题本】吴大正课后刷题本(全).pdf"
pdf2 = r"E:\考研资料\信号\2027考研信号系统-基础习题--风中醉风.pdf"

def inspect_doc(name, path):
    doc = fitz.open(path)
    print(f"\n=== {name} (Pages: {len(doc)}) ===")
    total_text = 0
    total_images = 0
    for i in range(min(15, len(doc))):
        page = doc[i]
        txt = page.get_text().strip()
        imgs = page.get_images()
        print(f"Page {i+1}: text_len={len(txt)}, img_count={len(imgs)}")
        if len(txt) > 0:
            print(f"   Sample: {txt[:100].replace(chr(10), ' ')}")
        total_text += len(txt)
        total_images += len(imgs)
    print(f"First 15 pages: total_text_len={total_text}, total_images={total_images}")

inspect_doc("吴大正刷题本", pdf1)
inspect_doc("基础习题-风中醉风", pdf2)
