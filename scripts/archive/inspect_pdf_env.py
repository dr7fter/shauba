import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
pdf1 = r"E:\考研资料\信号\002 【刷题本】吴大正课后刷题本(全).pdf"
pdf2 = r"E:\考研资料\信号\2027考研信号系统-基础习题--风中醉风.pdf"

print("PDF1 exists:", os.path.exists(pdf1), "Size:", os.path.getsize(pdf1))
print("PDF2 exists:", os.path.exists(pdf2), "Size:", os.path.getsize(pdf2))

try:
    import pypdf
    reader = pypdf.PdfReader(pdf2)
    print("PDF2 page count:", len(reader.pages))
    print("PDF2 page 1 text sample:", reader.pages[0].extract_text()[:200])
except Exception as e:
    print("pypdf error or not installed:", e)

try:
    import fitz # PyMuPDF
    doc = fitz.open(pdf2)
    print("PyMuPDF PDF2 page count:", len(doc))
    print("PyMuPDF PDF2 page 1 text sample:", doc[0].get_text()[:200])
except Exception as e:
    print("fitz error or not installed:", e)
