print("\nShrikant Kudale MIT ADT University B31 Batch - AI Internship Email- pixelreceives@gmail.com\n")
print("Task 3 - AI Internship : High Accuracy Image Captioning With Top 3 Predictions)\n")

import torch
import torch_directml
from torchvision.models import resnet50, ResNet50_Weights
from torchvision import transforms
from PIL import Image
import matplotlib.pyplot as plt
import os
import time
import sys

# [>] Set AMD GPU via DirectML
device = torch_directml.device()
print(f"[>] Using Device: {device}\n")

# [>] Load pre-trained ResNet50 model
start_model = time.time()
print("[>] Loading ResNet50 model...")
weights = ResNet50_Weights.DEFAULT
model = resnet50(weights=weights)
model.eval().to(device)
print(f"[✓] Model loaded in {round(time.time() - start_model, 2)} seconds\n")

# [>] Get class labels and preprocessing transform
labels = weights.meta["categories"]
transform = weights.transforms()

def show_progress(stage, percent):
    sys.stdout.write(f"\r[>] {stage}: {percent}% completed")
    sys.stdout.flush()

def predict_image(image_path):
    try:
        print("\n[>] Verifying image file...")
        show_progress("Verification", 0)

        if not os.path.exists(image_path):
            print("\n[x] File not found.")
            return

        image = Image.open(image_path)
        image.verify()
        image = Image.open(image_path).convert("RGB")

        show_progress("Verification", 100)
        print("\n[✓] Image verified and loaded.")

        # Display the image
        plt.imshow(image)
        plt.title("Input Image")
        plt.axis("off")
        plt.show(block=False)
        time.sleep(1.5)
        plt.close()

        # [>] Preprocess image
        print("\n[>] Preprocessing:")
        for percent in range(0, 101, 25):
            time.sleep(0.1)
            show_progress("Preprocessing", percent)
        image_tensor = transform(image).unsqueeze(0).to(device)
        print("\n[✓] Image preprocessing complete.")

        # [>] Run inference
        print("\n[>] Running inference:")
        show_progress("Inference", 0)
        with torch.no_grad():
            start = time.time()
            output = model(image_tensor)
            probabilities = torch.nn.functional.softmax(output[0], dim=0)
            show_progress("Inference", 70)
            top_probs, top_classes = torch.topk(probabilities, 3)
            show_progress("Inference", 100)
            end = time.time()

        # [>] Output prediction
        print("\n\n[✓] Captioning Result:")
        print(f"Most likely: {labels[top_classes[0]]} ({round(top_probs[0].item() * 100, 2)}% confidence)")
        print("Top alternatives:")
        for label, conf in zip(top_classes[1:], top_probs[1:]):
            print(f"- {labels[label]} ({round(conf.item() * 100, 2)}%)")

        print(f"\n[✓] Inference completed in {round(end - start, 2)} seconds.\n")

    except Exception as e:
        print("[x] Error during prediction:")
        print(str(e))

def start_captioning():
    print("[>] Enter the full path to your image (JPG/JPEG/PNG):")
    path = input("Image path: ").strip()
    predict_image(path)

if __name__ == "__main__":
    print("[>] This image classification tool shows top 3 predictions with confidence.\n")
    start_captioning()
