import os
import csv
import random
import uuid
from datetime import datetime, timedelta

# Define the base path to your dataset
base_path = "mvtec_anomaly_detection/bottle/test"

# Define the output CSV file
output_csv = "product_traceability_bottle_log.csv"

# Function to generate random manufacturing date
def random_date(start, end):
    return start + timedelta(days=random.randint(0, (end - start).days))

# Define start and end dates for manufacturing
start_date = datetime.strptime("2022-01-01", "%Y-%m-%d")
end_date = datetime.strptime("2023-12-31", "%Y-%m-%d")

# Write headers for the CSV
with open(output_csv, mode='w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(["Image_Path", "Device_ID", "Batch_ID", "Serial_Number", 
                     "Manufacturing_Date", "RoHS_Compliance", "Label"])

    # Traverse through each label folder
    for folder in os.listdir(base_path):
        label_path = os.path.join(base_path, folder)
        if os.path.isdir(label_path):
            for image_file in os.listdir(label_path):
                image_path = os.path.join(label_path, image_file)

                # Simulated metadata
                device_id = str(uuid.uuid4())
                batch_id = f"BATCH{random.randint(1000,9999)}"
                serial_number = f"SN{random.randint(100000,999999)}"
                mfg_date = random_date(start_date, end_date).strftime("%Y-%m-%d")
                rohs_compliance = random.choice(["Compliant", "Non-Compliant"])

                # Write to CSV
                writer.writerow([image_path, device_id, batch_id, serial_number, 
                                 mfg_date, rohs_compliance, folder])
