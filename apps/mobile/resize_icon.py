from PIL import Image
import os

input_path = os.path.join("assets", "images", "android-icon-foreground.png")
output_path = os.path.join("assets", "images", "android-icon-foreground-512.png")

img = Image.open(input_path)
img = img.resize((512, 512), Image.LANCZOS)
img.save(output_path)

print(f"Original size: {img.size}")
print(f"Saved to: {output_path}")
