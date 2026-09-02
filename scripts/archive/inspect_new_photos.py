from PIL import Image
import os
import sys

photo_dir = r"E:\刷吧\photo"
files = ["IMG_20260827_162040.jpg", "IMG_20260827_162044.jpg"]

for f in files:
    p = os.path.join(photo_dir, f)
    if os.path.exists(p):
        img = Image.open(p)
        print(f"{f}: size={img.size}, mode={img.mode}")
