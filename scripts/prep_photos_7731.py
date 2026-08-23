from PIL import Image, ImageOps
import os

photo_dir = r"E:\刷吧\photo"
rot_dir = r"E:\刷吧\photo\batch_7731"
os.makedirs(rot_dir, exist_ok=True)

files = ["IMG_20260823_154529.jpg", "IMG_20260823_154550.jpg", "IMG_20260823_154558.jpg"]

for f in files:
    path = os.path.join(photo_dir, f)
    im = Image.open(path)
    im = ImageOps.exif_transpose(im) # apply EXIF rotation if present
    # Check width and height
    print(f"{f}: size = {im.size}")
    # If width > height, let's also save rotated 90 / 270 just in case
    out_path = os.path.join(rot_dir, f)
    im.save(out_path)
    if im.width > im.height:
        # save rotated 90 clockwise
        im.rotate(270, expand=True).save(os.path.join(rot_dir, "rot270_" + f))
        im.rotate(90, expand=True).save(os.path.join(rot_dir, "rot90_" + f))

print("Prepared images in batch_7731 directory.")
