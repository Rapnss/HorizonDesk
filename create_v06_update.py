import os
import zipfile
import shutil

TARGET_ZIP = "v0.6.zip"

def main():
    if os.path.exists(TARGET_ZIP):
        os.remove(TARGET_ZIP)

    print(f"Creating {TARGET_ZIP}...")

    # Create navigator.txt
    nav_content = "dist -> _internal/sample-gui/dist\n"
    with open("navigator.txt", "w") as f:
        f.write(nav_content)

    includes = [
        ("sample-gui/dist", "dist"),
        ("navigator.txt", "navigator.txt")
    ]

    with zipfile.ZipFile(TARGET_ZIP, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for src_path, in_zip_path in includes:
            if not os.path.exists(src_path):
                print(f"Warning: {src_path} does not exist.")
                continue

            if os.path.isfile(src_path):
                print(f"Adding file: {src_path} as {in_zip_path}")
                zipf.write(src_path, in_zip_path)
            elif os.path.isdir(src_path):
                print(f"Adding directory: {src_path} as {in_zip_path}")
                for root, dirs, files in os.walk(src_path):
                    for file in files:
                        file_path = os.path.join(root, file)
                        rel_path = os.path.relpath(file_path, src_path)
                        zipf_path = os.path.join(in_zip_path, rel_path)
                        zipf.write(file_path, zipf_path)

    os.remove("navigator.txt")
    print(f"Successfully created {TARGET_ZIP}")

if __name__ == "__main__":
    main()
