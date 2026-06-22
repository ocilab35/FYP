"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ImageUp, Loader2, ScanLine, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { DashboardCard, DashboardCardBody } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

interface PrescriptionIntakePanelProps {
  onImageReady: (file: File, previewUrl: string) => void;
  disabled?: boolean;
}

export function PrescriptionIntakePanel({ onImageReady, disabled }: PrescriptionIntakePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const validateFile = (file: File): boolean => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Use JPG, PNG, or WebP images only.");
      return false;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be 10MB or smaller.");
      return false;
    }
    return true;
  };

  const setPreview = useCallback((file: File) => {
    if (!validateFile(file)) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewFile(file);
    setPreviewUrl(url);
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      stopCamera();
    };
  }, [previewUrl]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      toast.error("Camera access denied or unavailable on this device.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Could not capture photo.");
          return;
        }
        const file = new File([blob], `prescription-${Date.now()}.jpg`, { type: "image/jpeg" });
        stopCamera();
        setCameraOpen(false);
        setPreview(file);
      },
      "image/jpeg",
      0.92
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) setPreview(file);
  };

  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const confirmPreview = () => {
    if (!previewFile || !previewUrl) return;
    onImageReady(previewFile, previewUrl);
  };

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {previewUrl ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <DashboardCard padding="none" className="overflow-hidden border-primary/20">
              <DashboardCardBody className="space-y-4 p-4 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <ScanLine className="h-4 w-4" />
                    Preview before extraction
                  </div>
                  <Button type="button" size="icon-sm" variant="ghost" onClick={clearPreview} disabled={disabled}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="relative overflow-hidden rounded-xl border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Prescription preview" className="max-h-72 w-full object-contain" />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl flex-1"
                    onClick={clearPreview}
                    disabled={disabled}
                  >
                    Choose different image
                  </Button>
                  <Button
                    type="button"
                    className="rounded-xl flex-1 bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]"
                    onClick={confirmPreview}
                    disabled={disabled}
                  >
                    {disabled ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ScanLine className="mr-2 h-4 w-4" />
                        Extract medications
                      </>
                    )}
                  </Button>
                </div>
              </DashboardCardBody>
            </DashboardCard>
          </motion.div>
        ) : cameraOpen ? (
          <motion.div
            key="camera"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <DashboardCard padding="none" className="overflow-hidden">
              <DashboardCardBody className="space-y-4 p-4 sm:p-6">
                <div className="relative overflow-hidden rounded-xl bg-black">
                  <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl flex-1"
                    onClick={() => {
                      stopCamera();
                      setCameraOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="rounded-xl flex-1 bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]"
                    onClick={capturePhoto}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Capture
                  </Button>
                </div>
              </DashboardCardBody>
            </DashboardCard>
          </motion.div>
        ) : (
          <motion.div
            key="intake"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <button
              type="button"
              disabled={disabled}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "group relative rounded-2xl border-2 border-dashed p-6 text-left transition-all duration-200",
                "hover:border-primary/50 hover:bg-primary/[0.03]",
                dragActive ? "border-primary bg-primary/[0.06] scale-[1.01]" : "border-muted-foreground/20",
                disabled && "pointer-events-none opacity-60"
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <Upload className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold">Upload Prescription Image</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Drag & drop or click to browse. Supports printed and handwritten prescriptions.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">JPG, PNG, WebP · Max 10MB</p>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPreview(file);
                }}
              />
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={startCamera}
              className={cn(
                "group relative rounded-2xl border p-6 text-left transition-all duration-200",
                "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/[0.03]",
                disabled && "pointer-events-none opacity-60"
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 transition-transform group-hover:scale-105">
                <Camera className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold">Take Photo Using Camera</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Use your device camera to capture a prescription on the spot.
              </p>
              <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <ImageUp className="h-3 w-3" />
                Mobile-friendly rear camera preferred
              </p>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
