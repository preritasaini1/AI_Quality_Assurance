import os
import cv2
import numpy as np
from tensorflow.keras.models import load_model
from tensorflow.keras.losses import MeanSquaredError
import matplotlib.pyplot as plt

img_size = 128
model_path = "bottle_autoencoder.h5"
test_path = "D:/Intel_Unnati_Project 2025/mvtec_anomaly_detection/bottle/test"

# Load model
autoencoder = load_model(model_path, custom_objects={'mse': MeanSquaredError()})

# Load test images
def load_test_images(folder):
    data = []
    labels = []
    filenames = []
    for category in os.listdir(folder):
        category_path = os.path.join(folder, category)
        for img_file in os.listdir(category_path):
            img = cv2.imread(os.path.join(category_path, img_file))
            if img is not None:
                img = cv2.resize(img, (img_size, img_size))
                data.append(img / 255.0)
                labels.append(category)
                filenames.append(img_file)
    return np.array(data), labels, filenames

X_test, y_labels, filenames = load_test_images(test_path)

# Get reconstructions and MSE
reconstructions = autoencoder.predict(X_test)
mse = np.mean((X_test - reconstructions) ** 2, axis=(1, 2, 3))

# Manual threshold for better sensitivity
threshold = 0.0040

# Evaluate and visualize
for i in range(len(X_test)):
    is_anomaly = mse[i] > threshold
    print(f"{filenames[i]} | {y_labels[i]} | MSE: {mse[i]:.5f} | {'Anomaly 🚨' if is_anomaly else 'Normal ✅'}")

    if is_anomaly:
        fig, ax = plt.subplots(1, 3, figsize=(12, 4))
        ax[0].imshow(X_test[i])
        ax[0].set_title("Original")
        ax[0].axis('off')

        ax[1].imshow(reconstructions[i])
        ax[1].set_title("Reconstructed")
        ax[1].axis('off')

        diff = np.abs(X_test[i] - reconstructions[i])
        ax[2].imshow(diff)
        ax[2].set_title("Anomaly Map")
        ax[2].axis('off')

        plt.suptitle(f"{filenames[i]} - MSE: {mse[i]:.5f}")
        plt.tight_layout()
        plt.show()
