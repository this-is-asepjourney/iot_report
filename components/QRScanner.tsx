'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
  title?: string;
}

export function QRScanner({ onScan, onClose, title = 'Scan QR Code' }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerId = useRef(`qr-reader-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (scanning && containerRef.current) {
      const html5QrCode = new Html5Qrcode(scannerId.current);
      scannerRef.current = html5QrCode;

      html5QrCode
        .start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            onScan(decodedText);
            stopScanning();
          },
          (errorMessage) => {
            // Ignore scanning errors
          }
        )
        .catch((err) => {
          setError(err.message);
          setScanning(false);
        });
    }

    return () => {
      stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const startScanning = () => {
    setError(null);
    setScanning(true);
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div id={scannerId.current} ref={containerRef} className="w-full mb-4" />

        {error && (
          <div className="text-destructive text-sm mb-4">{error}</div>
        )}

        <div className="flex gap-2">
          {!scanning ? (
            <Button onClick={startScanning} className="flex-1">
              Start Scanning
            </Button>
          ) : (
            <Button onClick={stopScanning} variant="destructive" className="flex-1">
              Stop Scanning
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
