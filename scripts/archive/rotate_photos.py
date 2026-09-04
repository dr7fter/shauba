from PIL import Image
import os

photo_dir = r"E:\刷吧\photo"
rot_dir = r"E:\刷吧\photo\rotated"
os.makedirs(rot_dir, exist_ok=True)

# Image 1 (231359): Problems 1, 2, 3, 4 -> currently rotated 270 deg (counter-clockwise 90). Rotate 90 clockwise.
im1 = Image.open(os.path.join(photo_dir, "IMG_20260822_231359.jpg"))
im1_rot = im1.rotate(90, expand=True)
im1_rot.save(os.path.join(rot_dir, "page1_p1_4.jpg"))

# Image 2 (231404): Problems 5, 6 -> currently rotated 270 deg (counter-clockwise 90). Rotate 90 clockwise.
im2 = Image.open(os.path.join(photo_dir, "IMG_20260822_231404.jpg"))
im2_rot = im2.rotate(90, expand=True)
im2_rot.save(os.path.join(rot_dir, "page2_p5_6.jpg"))

# Image 3 (231411): Problems 7, 8 -> currently upside down (180 deg). Rotate 180 or 270? Let's check.
im3 = Image.open(os.path.join(photo_dir, "IMG_20260822_231411.jpg"))
im3_rot = im3.rotate(90, expand=True) # Let's try 90 or 270
im3_rot.save(os.path.join(rot_dir, "page3_p7_8.jpg"))

print("Rotated images successfully saved to E:\\刷吧\\photo\\rotated\\")
