from PIL import Image, ImageOps
import os

photo_dir = r"E:\刷吧\photo"
rot_dir = r"E:\刷吧\photo\batch_9602"
os.makedirs(rot_dir, exist_ok=True)

files = [
    "IMG_20260826_112929.jpg",
    "IMG_20260826_112938.jpg",
    "IMG_20260826_112945.jpg",
    "IMG_20260826_112953.jpg"
]

for f in files:
    path = os.path.join(photo_dir, f)
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    print(f"{f}: size = {im.size}")
    out_path = os.path.join(rot_dir, f)
    im.save(out_path)

print("Saved batch_9602 images.")
