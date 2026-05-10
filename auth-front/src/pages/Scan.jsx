import React, { useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";


function Scan() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  const startScanner = async () => {
  const codeReader = new BrowserMultiFormatReader();

  const videoInputDevices = await codeReader.listVideoInputDevices();
  const selectedDeviceId = videoInputDevices[0].deviceId;

  codeReader.decodeFromVideoDevice(
    selectedDeviceId,
    videoRef.current,
    (result, err) => {
      if (result) {
        alert("Barcode detected: " + result.getText());
      }
    }
  );
};


  // Open camera
  const openCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
  };

  // Take photo
  const takePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const img = canvas.toDataURL("image/png");
    setImage(img);
  };

  return (
    <div className="p-6 flex flex-col items-center gap-4">
      <h1 className="text-xl font-bold">Scan Product</h1>

      {/* Camera */}
      <video ref={videoRef} autoPlay className="w-80 rounded-xl shadow" />

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex gap-4">
        <button onClick={openCamera} className="px-4 py-2 bg-blue-500 text-white rounded">
          Open Camera
        </button>

        <button onClick={takePhoto} className="px-4 py-2 bg-green-500 text-white rounded">
          Take Photo
        </button>
      </div>

      {image && (
        <img src={image} alt="captured" className="w-60 rounded-lg shadow" />
      )}
    </div>
  );
}

export default Scan;