from PIL import Image
import os

img_path = r"C:\Users\86136\.gemini\antigravity\brain\9ffe4fbd-966a-4632-8f9d-a2dd03e09dd2\.user_uploaded\media_1787563108180.jpg"
out_path = r"E:\刷吧\photo\task_7656\q7656_upright.jpg"

im = Image.open(img_path)
im_rot = im.rotate(90, expand=True)
im_rot.save(out_path)
print(f"Saved upright image to {out_path}, size = {im_rot.size}")
