import pandas as pd
import qrcode
import os

# Load the CSV file
df = pd.read_csv("product_traceability_bottle_log.csv")

# Create directory for QR codes
os.makedirs("qr_codes_bottle", exist_ok=True)

# Generate QR code for each row
for index, row in df.iterrows():
    qr_data = (
        f"Device ID: {row['Device_ID']}\n"
        f"Batch ID: {row['Batch_ID']}\n"
        f"Serial Number: {row['Serial_Number']}\n"
        f"Manufacturing Date: {row['Manufacturing_Date']}\n"
        f"RoHS Compliance: {row['RoHS_Compliance']}\n"
        f"Label: {row['Label']}"
    )

    qr_img = qrcode.make(qr_data)
    qr_filename = f"qr_codes_bottle/qr_{row['Serial_Number']}.png"
    qr_img.save(qr_filename)
