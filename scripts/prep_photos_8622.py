from PIL import Image, ImageOps
import os

photo_dir = r"E:\刷吧\photo"
rot_dir = r"E:\刷吧\photo\batch_8622"
os.makedirs(rot_dir, exist_ok=True)

files = ["IMG_20260825_185031.jpg", "IMG_20260825_185043.jpg", "IMG_20260825_185050.jpg"]

for f in files:
    path = os.path.join(photo_dir, f)
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    print(f"{f}: size = {im.size}")
    out_path = os.path.join(rot_dir, f)
    im.save(out_path)

print("Saved batch_8622 images.")
