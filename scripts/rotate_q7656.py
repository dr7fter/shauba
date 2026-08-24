from PIL import Image, ImageOps
import os

img_path = r"C:\Users\86136\.gemini\antigravity\brain\9ffe4fbd-966a-4632-8f9d-a2dd03e09dd2\.user_uploaded\media_1787563108180.jpg"
rot_dir = r"E:\刷吧\photo\task_7656"
os.makedirs(rot_dir, exist_ok=True)
out_path = os.path.join(rot_dir, "q7656_rotated.jpg")

im = Image.open(img_path)
im = ImageOps.exif_transpose(im)
# The image appears rotated 90 deg clockwise in preview, let's rotate 270 (or 90 counter-clockwise)
im_rot = im.rotate(270, expand=True)
im_rot.save(out_path)
print(f"Saved rotated image to {out_path}, size = {im_rot.size}")
