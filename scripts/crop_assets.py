import fitz
import os
import json
from PIL import Image

output_base = r"E:\考研资料\题库-信号"
assets_dir = os.path.join(output_base, "assets")
os.makedirs(assets_dir, exist_ok=True)

pdf_path = r"E:\考研资料\信号\2027考研信号系统-基础习题--风中醉风.pdf"
doc = fitz.open(pdf_path)

# Let's crop diagrams for Chapter 1 questions
# Page 5 (index 4): question 5 diagram
p5 = doc[4]
pix5 = p5.get_pixmap(dpi=200)
img5_path = os.path.join(output_base, "temp_pages", "p5_hi.png")
pix5.save(img5_path)

im5 = Image.open(img5_path)
# Crop the diagram in the middle of page 5
# Coordinates relative to 200dpi image
w, h = im5.size
# Diagram is located around x: 30%~70%, y: 15%~30%
crop5 = im5.crop((int(w*0.35), int(h*0.13), int(w*0.75), int(h*0.30)))
crop5.save(os.path.join(assets_dir, "sig_q005_waveform.png"))
print("Saved sig_q005_waveform.png")

# Page 6 (index 5): question 6 diagram
p6 = doc[5]
pix6 = p6.get_pixmap(dpi=200)
img6_path = os.path.join(output_base, "temp_pages", "p6_hi.png")
pix6.save(img6_path)
im6 = Image.open(img6_path)
crop6 = im6.crop((int(w*0.35), int(h*0.12), int(w*0.75), int(h*0.28)))
crop6.save(os.path.join(assets_dir, "sig_q006_waveform.png"))
print("Saved sig_q006_waveform.png")

# Page 7 (index 6): question 7 diagrams (3 diagrams: f1, f2, f3)
p7 = doc[6]
pix7 = p7.get_pixmap(dpi=200)
img7_path = os.path.join(output_base, "temp_pages", "p7_hi.png")
pix7.save(img7_path)
im7 = Image.open(img7_path)
crop7_1 = im7.crop((int(w*0.35), int(h*0.12), int(w*0.70), int(h*0.26)))
crop7_1.save(os.path.join(assets_dir, "sig_q007_f1.png"))
crop7_2 = im7.crop((int(w*0.35), int(h*0.28), int(w*0.70), int(h*0.40)))
crop7_2.save(os.path.join(assets_dir, "sig_q007_f2.png"))
crop7_3 = im7.crop((int(w*0.35), int(h*0.42), int(w*0.70), int(h*0.56)))
crop7_3.save(os.path.join(assets_dir, "sig_q007_f3.png"))
print("Saved sig_q007_f1/f2/f3.png")

# Page 8 (index 7): question 8 diagrams
p8 = doc[7]
pix8 = p8.get_pixmap(dpi=200)
img8_path = os.path.join(output_base, "temp_pages", "p8_hi.png")
pix8.save(img8_path)
im8 = Image.open(img8_path)
crop8_1 = im8.crop((int(w*0.38), int(h*0.11), int(w*0.72), int(h*0.24)))
crop8_1.save(os.path.join(assets_dir, "sig_q008_f1.png"))
crop8_2 = im8.crop((int(w*0.38), int(h*0.28), int(w*0.72), int(h*0.41)))
crop8_2.save(os.path.join(assets_dir, "sig_q008_f2.png"))
print("Saved sig_q008_f1/f2.png")
