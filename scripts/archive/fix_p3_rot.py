from PIL import Image
import os

rot_dir = r"E:\刷吧\photo\rotated"
im3 = Image.open(os.path.join(rot_dir, "page3_p7_8.jpg"))
im3_rot = im3.rotate(180, expand=True)
im3_rot.save(os.path.join(rot_dir, "page3_p7_8_upright.jpg"))
print("page3_p7_8_upright.jpg saved!")
