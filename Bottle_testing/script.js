let isRealtimeActive = false;
let videoStream = null;
let realtimeInterval = null;
let currentAnalysisResult = null;
let currentQRData = null; 
let hasShownCSVWarning = false;

const stats = { totalInspected: 0, defectsFound: 0, passRate: 100, avgTime: 0 };

const realtimeBtn = document.getElementById('realtimeBtn');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const cameraFeed = document.getElementById('cameraFeed');
const videoElement = document.getElementById('videoElement');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsContainer = document.getElementById('resultsContainer');
const defaultState = document.getElementById('defaultState');
const loadingState = document.getElementById('loadingState');
const resultsDisplay = document.getElementById('resultsDisplay');
const generateQRBtn = document.getElementById('generateQRBtn');
const generateReportBtn = document.getElementById('generateReportBtn');
const qrModal = document.getElementById('qrModal');
const closeModal = document.getElementById('closeModal');
const newImageBtn = document.getElementById('newImageBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
const freezeCanvas = document.getElementById('freezeCanvas');
const redoDetectionBtn = document.getElementById('redoDetectionBtn');

settingsBtn.addEventListener('click', () => settingsMenu.style.display = 'block');
window.closeSettings = () => settingsMenu.style.display = 'none';

document.addEventListener('DOMContentLoaded', () => {
    realtimeBtn.addEventListener('click', toggleRealtimeMode);
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', e => e.preventDefault());
    uploadArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
    analyzeBtn.addEventListener('click', analyzeImage);
    generateQRBtn.addEventListener('click', generateQRCode);
    generateReportBtn.addEventListener('click', generateReport);
    closeModal.addEventListener('click', () => qrModal.style.display = 'none');
    qrModal.addEventListener('click', e => { if (e.target === qrModal) qrModal.style.display = 'none'; });
    newImageBtn.addEventListener('click', resetToUploadMode);
});

redoDetectionBtn.addEventListener('click', () => {
    videoElement.style.display = 'block';
    freezeCanvas.style.display = 'none';
    redoDetectionBtn.style.display = 'none';
    captureAndAnalyzeSingleFrame();
});

function resetToUploadMode() {
    uploadArea.style.display = 'block';
    imagePreview.style.display = 'none';
    cameraFeed.style.display = 'none';
    newImageBtn.style.display = 'none';
    showDefaultState();
    
    // Reset file input
    fileInput.value = '';
    
    // Stop real-time mode if active
    if (isRealtimeActive) {
        toggleRealtimeMode();
    }
}

function resetEverything() {
    // Clear preview
    previewImg.src = '';
    fileInput.value = '';
    currentAnalysisResult = null;
    currentQRData = null;
    
    // Reset UI
    resetToUploadMode();
    showDefaultState();

    // Reset stats
    stats.totalInspected = 0;
    stats.defectsFound = 0;
    stats.passRate = 100;
    stats.avgTime = 0;
    document.getElementById('totalInspected').textContent = 0;
    document.getElementById('defectsFound').textContent = 0;
    document.getElementById('passRate').textContent = `100%`;
    document.getElementById('avgTime').textContent = `0s`;

    // Close modal
    settingsMenu.style.display = 'none';

    alert('Dashboard has been reset.');
}

function preprocessCapImage(ctx, width, height) {
    const paddedCanvas = document.createElement('canvas');
    paddedCanvas.width = 128;
    paddedCanvas.height = 128;

    const paddedCtx = paddedCanvas.getContext('2d');

    paddedCtx.fillStyle = '#f0f0f0';
    paddedCtx.fillRect(0, 0, 128, 128);

    const scale = Math.min(100 / width, 100 / height);
    const newW = width * scale;
    const newH = height * scale;

    const offsetX = (128 - newW) / 2;
    const offsetY = (128 - newH) / 2;

    paddedCtx.drawImage(ctx.canvas, 0, 0, width, height, offsetX, offsetY, newW, newH);
    return paddedCanvas;
}


function captureAndAnalyzeSingleFrame(retries = 10) {
    const countdownOverlay = document.getElementById('countdownOverlay');

    if (!videoElement.videoWidth || !videoElement.videoHeight) {
        if (retries > 0) {
            setTimeout(() => captureAndAnalyzeSingleFrame(retries - 1), 300);
        } else {
            alert("❌ Video not ready. Please try again.");
        }
        return;
    }

    // Start 3-second countdown
    let counter = 3;
    countdownOverlay.style.display = 'block';
    countdownOverlay.textContent = counter;

    const countdownInterval = setInterval(() => {
        counter--;
        if (counter > 0) {
            countdownOverlay.textContent = counter;
        } else {
            clearInterval(countdownInterval);
            countdownOverlay.style.display = 'none';

            // Freeze frame
            const ctx = freezeCanvas.getContext('2d');
            const width = videoElement.videoWidth;
            const height = videoElement.videoHeight;

            freezeCanvas.width = width;
            freezeCanvas.height = height;
            ctx.drawImage(videoElement, 0, 0, width, height);

            // Crop center and wrap into bottle-style input
            const cropSize = Math.min(width, height) * 0.5;
            const x = (width - cropSize) / 2;
            const y = (height - cropSize) / 2;

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropSize;
            cropCanvas.height = cropSize;
            const cropCtx = cropCanvas.getContext('2d');
            cropCtx.drawImage(videoElement, x, y, cropSize, cropSize, 0, 0, cropSize, cropSize);

            const padded = preprocessCapImage(cropCtx, cropSize, cropSize);

            freezeCanvas.width = 128;
            freezeCanvas.height = 128;
            const finalCtx = freezeCanvas.getContext('2d');
            finalCtx.drawImage(padded, 0, 0);


            // Show frozen frame
            videoElement.style.display = 'none';
            freezeCanvas.style.display = 'block';
            redoDetectionBtn.style.display = 'inline-block';

            freezeCanvas.toBlob(blob => {
                if (!blob) {
                    alert("❌ Failed to capture image from canvas.");
                    return;
                }
                analyzeImageBlob(blob);
            }, 'image/jpeg', 0.95);
        }
    }, 1000);
}

function toggleRealtimeMode() {
    const btnIcon = realtimeBtn.querySelector('i');
    const btnText = realtimeBtn.querySelector('span');

    if (!isRealtimeActive) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                videoStream = stream;
                videoElement.srcObject = stream;
                cameraFeed.style.display = 'block';
                uploadArea.style.display = 'none';
                imagePreview.style.display = 'none';
                newImageBtn.style.display = 'inline-flex';
                isRealtimeActive = true;
                btnIcon.className = 'fas fa-pause';
                btnText.textContent = 'Stop Real-time';
                captureAndAnalyzeSingleFrame();
            })
            .catch(() => alert('Camera access denied or unavailable.'));
    } else {
        videoStream.getTracks().forEach(track => track.stop());
        cameraFeed.style.display = 'none';
        uploadArea.style.display = 'block';
        newImageBtn.style.display = 'none';
        isRealtimeActive = false;
        btnIcon.className = 'fas fa-play';
        btnText.textContent = 'Start Real-time';
        stopRealtimeAnalysis();
    }
}

function stopRealtimeAnalysis() {
    clearInterval(realtimeInterval);
}

function handleDrop(e) {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) return alert('Please upload an image.');
    const reader = new FileReader();
    reader.onload = e => {
        previewImg.src = e.target.result;
        uploadArea.style.display = 'none';
        cameraFeed.style.display = 'none';
        imagePreview.style.display = 'block';
        newImageBtn.style.display = 'inline-flex';
        showDefaultState();
    };
    reader.readAsDataURL(file);
}

function analyzeImage() {
    if (!previewImg.src) return alert('Select an image first.');
    fetch(previewImg.src)
        .then(res => res.blob())
        .then(blob => analyzeImageBlob(blob));
}

async function analyzeImageBlob(blob) {
    showLoadingState();
    const formData = new FormData();
    formData.append('image', blob);

    try {
        const res = await fetch('http://127.0.0.1:5000/predict', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            currentAnalysisResult = data.result;
            showResults(currentAnalysisResult);
            updateStats(currentAnalysisResult);
        } else {
            alert('Prediction failed: ' + (data.error || 'Unknown error'));
            showDefaultState();
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Error communicating with server. Make sure the Flask server is running on port 5000.');
        showDefaultState();
    }
}

function showDefaultState() {
    defaultState.style.display = 'flex';
    loadingState.style.display = 'none';
    resultsDisplay.style.display = 'none';
}

function showLoadingState() {
    defaultState.style.display = 'none';
    loadingState.style.display = 'flex';
    resultsDisplay.style.display = 'none';
}

function showResults(result) {
    defaultState.style.display = 'none';
    loadingState.style.display = 'none';
    resultsDisplay.style.display = 'block';

    const badge = document.getElementById('statusBadge');
    const icon = document.getElementById('statusIcon');
    const title = document.getElementById('statusTitle');
    const confidence = document.getElementById('confidenceText');
    const mseScore = document.getElementById('mseScore');
    const defectRow = document.getElementById('defectTypeRow');
    const defectType = document.getElementById('defectType');
    const processingTime = document.getElementById('processingTime');

    badge.className = `status-badge ${result.isDefective ? 'fail' : 'pass'}`;
    icon.innerHTML = result.isDefective ? '<i class="fas fa-exclamation-triangle"></i>' : '<i class="fas fa-check-circle"></i>';
    title.textContent = result.isDefective ? 'DEFECT DETECTED' : 'QUALITY PASSED';
    title.className = result.isDefective ? 'fail' : 'pass';
    confidence.textContent = `Confidence: ${result.confidence}%`;
    mseScore.textContent = result.mseScore;
    processingTime.textContent = `${result.processingTime}s`;

    if (result.isDefective && result.defectType) {
    defectRow.style.display = 'flex';
    defectType.textContent = result.defectType;

        if (result.defectType === "Not in CSV" || result.defectType === "Unknown") {
            alert("⚠️ This image was not found in the CSV data. Random labeling applied.");
            hasShownCSVWarning = true;
        }
    } else {
        defectRow.style.display = 'none';
    }
    const visualPanel = document.getElementById('visualDebugPanel');
    const reconImage = document.getElementById('reconImage');
    const anomalyImage = document.getElementById('anomalyImage');

    if (result.isDefective && result.reconstructionImage && result.anomalyMap) {
    visualPanel.style.display = 'block';
    reconImage.src = `data:image/png;base64,${result.reconstructionImage}`;
    anomalyImage.src = `data:image/png;base64,${result.anomalyMap}`;
    } else {
    visualPanel.style.display = 'none';
    reconImage.src = '';
    anomalyImage.src = '';
    }


}

function updateStats(result) {
    stats.totalInspected++;
    if (result.isDefective) stats.defectsFound++;
    stats.passRate = ((stats.totalInspected - stats.defectsFound) / stats.totalInspected) * 100;
    stats.avgTime = parseFloat(result.processingTime);
    document.getElementById('totalInspected').textContent = stats.totalInspected;
    document.getElementById('defectsFound').textContent = stats.defectsFound;
    document.getElementById('passRate').textContent = `${stats.passRate.toFixed(1)}%`;
    document.getElementById('avgTime').textContent = `${stats.avgTime}s`;
}

async function generateQRCode() {
    if (!currentAnalysisResult) {
        alert('Please analyze an image first.');
        return;
    }

    const postData = {
    device_id: currentAnalysisResult.deviceId,
    batch_id: currentAnalysisResult.batchId,
    serial_number: currentAnalysisResult.serialNumber,
    manufacturing_date: new Date().toISOString().split('T')[0],
    rohs_compliance: "Compliant",
    quality_status: currentAnalysisResult.isDefective ? "REJECTED" : "APPROVED",
    mse_score: currentAnalysisResult.mseScore,
    timestamp: currentAnalysisResult.timestamp
};


    const res = await fetch('/generate_qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
    });

    const data = await res.json();

    if (!data.success) {
        alert('QR generation failed');
        return;
    }

    const meta = data.meta;

    currentQRData = {
        qrText: `Device ID: ${meta.device_id}
        Batch ID: ${meta.batch_id}
        Serial Number: ${meta.serial_number}
        Manufacturing Date: ${meta.manufacturing_date}
        RoHS Compliance: ${meta.rohs_compliance}
        Label: ${currentAnalysisResult.isDefective ? 'defective' : 'good'}`,
        deviceId: meta.device_id,
        serialNumber: meta.serial_number,
        label: meta.label
    };

    // Render QR code
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    const qr = qrcode(0, 'M');
    qr.addData(currentQRData.qrText);
    qr.make();
    qrContainer.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4 });

    // Show QR data
    const qrDetails = document.getElementById('qrDetails');
    qrDetails.innerHTML = currentQRData.qrText
        .split('\n')
        .map(line => `<p><strong>${line.split(':')[0]}</strong>: ${line.split(':').slice(1).join(':').trim()}</p>`)
        .join('') +
        `<div class="qr-download-section">
            <button class="btn btn-primary qr-download-btn" onclick="downloadQRReceipt()">
                <i class="fas fa-download"></i> Download QR Code
            </button>
        </div>`;

    qrModal.style.display = 'block';
}


function downloadQRReceipt() {
    if (!currentQRData || !currentAnalysisResult) {
        alert('No QR code data available for download');
        return;
    }

    try {
        // Create a canvas to draw the QR
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size
        canvas.width = 300;
        canvas.height = 350;

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Header Text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Product QR Code', canvas.width / 2, 30);

        // Generate QR code again on canvas
        const qr = qrcode(0, 'M');
        qr.addData(currentQRData.qrText);
        qr.make();

        const modules = qr.modules;
        const moduleSize = 200 / modules.length;
        ctx.fillStyle = '#000000';

        for (let r = 0; r < modules.length; r++) {
            for (let c = 0; c < modules[r].length; c++) {
                if (modules[r][c]) {
                    ctx.fillRect(c * moduleSize + 50, r * moduleSize + 50, moduleSize, moduleSize);
                }
            }
        }

        // Save as PNG
        canvas.toBlob(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `QR_${currentAnalysisResult.serialNumber}_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }, 'image/png');

    } catch (err) {
        console.error('QR Image download failed:', err);
        alert('Failed to download QR image');
    }
}

function downloadQRReceipt() {
    const svgElement = document.querySelector('#qrcode svg');
    if (!svgElement) {
        alert('QR code not available to download.');
        return;
    }

    // Serialize SVG
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Create temporary image
    const img = new Image();
    img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 300, 300);

        // Create PNG from canvas
        canvas.toBlob(function (blob) {
            const pngUrl = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            downloadLink.download = `QR_${currentAnalysisResult?.serialNumber || 'code'}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(pngUrl);
        }, 'image/png');

        URL.revokeObjectURL(url);
    };

    img.onerror = function () {
        alert('Failed to load QR image.');
    };

    img.src = url;
}


function generateReport() {
    if (!currentAnalysisResult) {
        alert('Please analyze an image first to generate report');
        return;
    }

    // If QR was not generated, create minimal fallback
    if (!currentQRData && currentAnalysisResult) {
    currentQRData = {
            deviceId: currentAnalysisResult.deviceId,
            serialNumber: currentAnalysisResult.serialNumber,
            status: currentAnalysisResult.isDefective ? 'REJECTED' : 'APPROVED',
            qrText: `Device ID: DEV-${Date.now()}
            Batch ID: ${currentAnalysisResult.batchId}
            Serial Number: ${currentAnalysisResult.serialNumber}
            Manufacturing Date: ${new Date().toISOString().split('T')[0]}
            RoHS Compliance: Compliant
            Quality Status: ${currentAnalysisResult.isDefective ? 'REJECTED' : 'APPROVED'}
            MSE Score: ${currentAnalysisResult.mseScore}
            Timestamp: ${currentAnalysisResult.timestamp}`
        };
    }

    const report = `
=========================================
     AI QUALITY ASSURANCE REPORT
=========================================

PRODUCT INFORMATION
-------------------

Device ID: ${currentQRData.deviceId}
Batch ID: ${currentAnalysisResult.batchId}
Serial Number: ${currentAnalysisResult.serialNumber}
Manufacturing Date: ${new Date().toISOString().split('T')[0]}
RoHS Compliance: Compliant
Label: ${currentAnalysisResult.isDefective ? 'defective' : 'good'}

QUALITY CONTROL SUMMARY
-----------------------
MSE Score: ${currentAnalysisResult.mseScore}
Confidence: ${currentAnalysisResult.confidence}%
Processing Time: ${currentAnalysisResult.processingTime}s

Total Inspected: ${stats.totalInspected}
Defects Found: ${stats.defectsFound}
Pass Rate: ${stats.passRate.toFixed(1)}%
Average Processing Time: ${stats.avgTime}s

=========================================
Generated by AI Quality Assurance System
Generated on: ${new Date().toLocaleString()}
=========================================
`;


    const blob = new Blob([report], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `QA_Report_${currentAnalysisResult.serialNumber}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}
