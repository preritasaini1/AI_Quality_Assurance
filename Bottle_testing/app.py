from flask import Flask, request, jsonify, send_from_directory
from tensorflow.keras.models import load_model
from tensorflow.keras.losses import MeanSquaredError
import numpy as np
from PIL import Image
import os
import qrcode
import io
import base64
import pandas as pd
import uuid
import random
from datetime import datetime
import hashlib


app = Flask(__name__, static_folder='.', static_url_path='')
model = load_model("bottle_autoencoder.h5", custom_objects={'mse': MeanSquaredError()})
IMG_SIZE = 128

def compute_image_md5_from_filestorage(file_storage):
    file_bytes = file_storage.read()  # Read raw bytes
    hash_val = hashlib.md5(file_bytes).hexdigest()
    file_storage.seek(0)  # Rewind the pointer so PIL can read again
    return hash_val

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/style.css')
def style():
    return send_from_directory('.', 'style.css')

@app.route('/script.js')
def script():
    return send_from_directory('.', 'script.js')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        file = request.files['image']
        if not file:
            raise ValueError("No image file received")

        img_hash = compute_image_md5_from_filestorage(file)

        img = Image.open(file.stream).convert("RGB").resize((IMG_SIZE, IMG_SIZE))
        img_array = np.array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        recon = model.predict(img_array)
        mse = np.mean((img_array - recon) ** 2)
        threshold = 0.0040  # Manual threshold override for higher sensitivity
        is_defective = mse > threshold

        df = pd.read_csv("D:/Intel_Unnati_Project 2025/Bottle_testing/product_traceability_bottle_log.csv")
        match = df[df['Image_Hash'] == img_hash]

        defect_label = "Unknown"
        serial_number = f"SN{random.randint(100000, 999999)}"
        batch_id = f"BATCH{random.randint(1000, 9999)}"

        if not match.empty:
            row = match.iloc[0]
            defect_label = row['Label']
            serial_number = row['Serial_Number']
            batch_id = row['Batch_ID']

        device_id = f"DEV-{int(datetime.now().timestamp())}"

        # Generate visual anomaly map if defective
        reconstruction_image_b64 = None
        anomaly_map_b64 = None
        if is_defective:
            import matplotlib.pyplot as plt

            original = (img_array[0] * 255).astype(np.uint8)
            reconstructed = (recon[0] * 255).astype(np.uint8)
            diff = np.abs(original.astype(np.int16) - reconstructed.astype(np.int16)).astype(np.uint8)

            # Encode reconstruction
            recon_img = Image.fromarray(reconstructed)
            buffer1 = io.BytesIO()
            recon_img.save(buffer1, format="PNG")
            reconstruction_image_b64 = base64.b64encode(buffer1.getvalue()).decode()

            # Encode diff heatmap
            diff_colored = Image.fromarray(diff)
            buffer2 = io.BytesIO()
            diff_colored.save(buffer2, format="PNG")
            anomaly_map_b64 = base64.b64encode(buffer2.getvalue()).decode()

        result = {
            "mseScore": float(round(mse, 5)),
            "confidence": float(round(100 - mse * 1000, 1)),
            "isDefective": bool(is_defective),
            "processingTime": "0.8",
            "defectType": defect_label if is_defective else "None",
            "batchId": batch_id,
            "serialNumber": serial_number,
            "deviceId": device_id,
            "timestamp": datetime.now().isoformat() + "Z",
            "reconstructionImage": reconstruction_image_b64,
            "anomalyMap": anomaly_map_b64
        }

        return jsonify(success=True, result=result)

    except Exception as e:
        print(f"🔥 ERROR: {str(e)}")
        return jsonify(success=False, error=str(e))




@app.route('/generate_qr', methods=['POST'])
def generate_qr():
    try:
        data = request.get_json()

        device_id = data.get('device_id', f"DEV-{uuid.uuid4()}")
        batch_id = data.get('batch_id', f"BATCH{random.randint(1000,9999)}")
        serial_number = data.get('serial_number', f"SN{random.randint(100000,999999)}")
        manufacturing_date = data.get('manufacturing_date', datetime.now().strftime("%Y-%m-%d"))
        rohs_compliance = data.get('rohs_compliance', "Compliant")
        quality_status = data.get('quality_status', "APPROVED")
        mse_score = data.get('mse_score', 0.0)
        timestamp = data.get('timestamp', datetime.now().isoformat() + "Z")

        # ✅ Check CSV for matching Serial Number to fetch label
        try:
            df = pd.read_csv("product_traceability_bottle_log.csv")
            match = df[df['Serial_Number'] == serial_number]
            if not match.empty:
                label = match.iloc[0]['Label']
            else:
                label = "Unknown"
        except:
            label = "Unknown"

        qr_data = (
            f"Device ID: {device_id}\n"
            f"Batch ID: {batch_id}\n"
            f"Serial Number: {serial_number}\n"
            f"Manufacturing Date: {manufacturing_date}\n"
            f"RoHS Compliance: {rohs_compliance}\n"
            f"Label: {label}\n"
            f"\u2705 QR Data Matched with CSV."
        )

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_data)
        qr.make(fit=True)

        qr_img = qr.make_image(fill_color="black", back_color="white")

        os.makedirs("qr_codes_bottle", exist_ok=True)
        qr_filename = f"qr_codes_bottle/qr_{serial_number}.png"

        # ✅ Avoid duplicate QR file if already exists
        if os.path.exists(qr_filename):
            print(f"QR already exists for {serial_number}. Skipping QR generation.")
        else:
            qr_img.save(qr_filename)

        # Save log regardless
        log_to_csv({
            'Device_ID': device_id,
            'Batch_ID': batch_id,
            'Serial_Number': serial_number,
            'Manufacturing_Date': manufacturing_date,
            'RoHS_Compliance': rohs_compliance,
            'Label': label,
            'Quality_Status': quality_status,
            'MSE_Score': mse_score,
            'Timestamp': timestamp
        })

        # Encode image to base64
        img_buffer = io.BytesIO()
        qr_img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode()

        return jsonify({
            'success': True,
            'qr_image': f"data:image/png;base64,{img_base64}",
            'qr_data': qr_data,
            'filename': qr_filename,
            'meta': {
                'device_id': device_id,
                'batch_id': batch_id,
                'serial_number': serial_number,
                'manufacturing_date': manufacturing_date,
                'rohs_compliance': rohs_compliance,
                'label': label
            }
        })

    except Exception as e:
        print(f"🔥 QR Generation ERROR: {str(e)}")
        return jsonify(success=False, error=str(e))


@app.route('/download_qr/<filename>', methods=['GET'])
def download_qr(filename):
    try:
        return send_from_directory('qr_codes_bottle', filename, as_attachment=True)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 404

def log_to_csv(row, filename="qr_data_log.csv"):
    file_exists = os.path.isfile(filename)
    df = pd.DataFrame([row])
    df.to_csv(filename, mode='a', header=not file_exists, index=False)

#if __name__ == '__main__':
    #app.run(debug=True)
if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
