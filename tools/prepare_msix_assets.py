import os
from PIL import Image

assets_dir = 'StoreAssets'
if not os.path.exists(assets_dir):
    os.makedirs(assets_dir)

src_img = 'sample-gui/public/logo.ico'
alt_img = '../horizon.in/public/512-icon-5.png'

img_path = src_img if os.path.exists(src_img) else alt_img

if not os.path.exists(img_path):
    print(f"Source image not found.")
else:
    img = Image.open(img_path)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # Ensure sizes are exactly as required by Windows Store
    # StoreLogo.png (50x50)
    img_50 = img.resize((50, 50), Image.Resampling.LANCZOS)
    img_50.save(os.path.join(assets_dir, 'StoreLogo.png'))

    # Square150x150Logo.png
    img_150 = img.resize((150, 150), Image.Resampling.LANCZOS)
    img_150.save(os.path.join(assets_dir, 'Square150x150Logo.png'))

    # Square44x44Logo.png
    img_44 = img.resize((44, 44), Image.Resampling.LANCZOS)
    img_44.save(os.path.join(assets_dir, 'Square44x44Logo.png'))

    # SplashScreen.png (620x300)
    splash = Image.new('RGBA', (620, 300), (15, 23, 42, 255))
    img_splash_logo = img.resize((150, 150), Image.Resampling.LANCZOS)
    splash.paste(img_splash_logo, ((620-150)//2, (300-150)//2), img_splash_logo)
    splash.save(os.path.join(assets_dir, 'SplashScreen.png'))

    print("StoreAssets generated successfully.")
