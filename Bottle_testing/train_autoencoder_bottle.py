import os
import cv2
import numpy as np
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, Conv2D, MaxPooling2D, UpSampling2D, BatchNormalization, Activation
from tensorflow.keras.optimizers import Adam
from sklearn.model_selection import train_test_split

# Path to train images (good only)
train_path = "D:/Intel_Unnati_Project 2025/mvtec_anomaly_detection/bottle/train/good"
img_size = 128

# Load and preprocess images
def load_images(folder):
    images = []
    for filename in os.listdir(folder):
        img_path = os.path.join(folder, filename)
        img = cv2.imread(img_path)
        if img is not None:
            img = cv2.resize(img, (img_size, img_size))
            images.append(img / 255.0)
    return np.array(images)

X = load_images(train_path)

# Split for training and validation
X_train, X_val = train_test_split(X, test_size=0.1, random_state=42)

# Define a deeper autoencoder with batch norm
def build_autoencoder(input_shape=(128, 128, 3)):
    input_img = Input(shape=input_shape)

    # Encoder
    x = Conv2D(64, (3, 3), padding='same')(input_img)
    x = BatchNormalization()(x)
    x = Activation('relu')(x)
    x = MaxPooling2D((2, 2), padding='same')(x)

    x = Conv2D(32, (3, 3), padding='same')(x)
    x = BatchNormalization()(x)
    x = Activation('relu')(x)
    x = MaxPooling2D((2, 2), padding='same')(x)

    x = Conv2D(16, (3, 3), padding='same')(x)
    x = BatchNormalization()(x)
    x = Activation('relu')(x)
    encoded = MaxPooling2D((2, 2), padding='same')(x)

    # Decoder
    x = Conv2D(16, (3, 3), padding='same')(encoded)
    x = BatchNormalization()(x)
    x = Activation('relu')(x)
    x = UpSampling2D((2, 2))(x)

    x = Conv2D(32, (3, 3), padding='same')(x)
    x = BatchNormalization()(x)
    x = Activation('relu')(x)
    x = UpSampling2D((2, 2))(x)

    x = Conv2D(64, (3, 3), padding='same')(x)
    x = BatchNormalization()(x)
    x = Activation('relu')(x)
    x = UpSampling2D((2, 2))(x)

    decoded = Conv2D(3, (3, 3), activation='sigmoid', padding='same')(x)

    autoencoder = Model(input_img, decoded)
    return autoencoder

# Build and compile
autoencoder = build_autoencoder()
autoencoder.compile(optimizer=Adam(learning_rate=0.001), loss='mse')

# Train
autoencoder.fit(X_train, X_train,
                epochs=50,
                batch_size=16,
                validation_data=(X_val, X_val),
                shuffle=True)

# Save model
autoencoder.save("bottle_autoencoder.h5")
