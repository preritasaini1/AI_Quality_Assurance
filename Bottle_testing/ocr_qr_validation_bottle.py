import pandas as pd
import cv2
import os

# Load original product data
df = pd.read_csv("product_traceability_bottle_log.csv")

# Path where QR codes are stored
qr_folder = "qr_codes_bottle"

# Initialize OpenCV QRCode detector
detector = cv2.QRCodeDetector()

# Open output file in write mode (overwrite each time)
with open("qr_validation_output_bottle.txt", "w", encoding="utf-8") as output_file:
    for index, row in df.iterrows():
        qr_filename = os.path.join(qr_folder, f"qr_{row['Serial_Number']}.png")
        img = cv2.imread(qr_filename)

        if img is None:
            msg = f"⚠️ Could not read image for Serial Number {row['Serial_Number']}.\n"
            print(msg.strip())
            output_file.write(msg)
            continue

        # Detect and decode the QR code
        data, bbox, _ = detector.detectAndDecode(img)

        if data:
            msg = f"\n✅ QR Code Read for Serial Number {row['Serial_Number']}:\n{data}\n"
            print(msg.strip())
            output_file.write(msg)

            expected_text = (
                f"Device ID: {row['Device_ID']}\n"
                f"Batch ID: {row['Batch_ID']}\n"
                f"Serial Number: {row['Serial_Number']}\n"
                f"Manufacturing Date: {row['Manufacturing_Date']}\n"
                f"RoHS Compliance: {row['RoHS_Compliance']}\n"
                f"Label: {row['Label']}"
            )

            if data.strip() == expected_text.strip():
                result = "✅ QR Data Matched with CSV.\n"
            else:
                result = "❌ Mismatch Found in QR Data.\n"

            print(result.strip())
            output_file.write(result)
        else:
            msg = f"⚠️ Could not decode QR for Serial Number {row['Serial_Number']}.\n"
            print(msg.strip())
            output_file.write(msg)
