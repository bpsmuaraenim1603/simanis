"use client";

import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";

type Props = {
  open: boolean;
  onClose: () => void;

  /**
   * Dipanggil setelah user capture foto.
   * File sudah JPEG.
   */
  onCapture: (file: File, previewUrl: string) => void;

  /**
   * Default: "environment" (kamera belakang)
   */
  facingMode?: "user" | "environment";

  /**
   * Kualitas JPEG 0..1. Default 0.92
   */
  jpegQuality?: number;

  /**
   * Lebar maksimum output capture (scale down). Default 1280
   */
  maxWidth?: number;

  /**
   * Kalau true: langsung capture begitu modal kebuka (opsional).
   */
  autoStart?: boolean;
};

export default function CameraCaptureModal({
  open,
  onClose,
  onCapture,
  facingMode = "environment",
  jpegQuality = 0.92,
  maxWidth = 1280,
  autoStart = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const canUseCamera = useMemo(() => {
    return (
      typeof window !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
    );
  }, []);

  async function startCamera() {
    if (!canUseCamera) {
      setError("Browser tidak mendukung kamera (getUserMedia).");
      return;
    }

    setError(null);
    setStarting(true);
    setIsReady(false);

    try {
      // Stop stream lama kalau ada
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError"
          ? "Izin kamera ditolak. Aktifkan permission kamera di browser."
          : e?.message || "Gagal membuka kamera."
      );
    } finally {
      setStarting(false);
    }
  }

  function stopCamera() {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }

  function handleClose() {
    stopCamera();
    onClose();
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;

    // Pastikan metadata sudah kebaca
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      setError("Video belum siap. Coba tunggu sebentar.");
      return;
    }

    // Scale down ke maxWidth
    const ratio = vw > maxWidth ? maxWidth / vw : 1;
    const w = Math.round(vw * ratio);
    const h = Math.round(vh * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Canvas tidak tersedia.");
      return;
    }

    ctx.drawImage(video, 0, 0, w, h);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Gagal membuat JPEG."))),
        "image/jpeg",
        jpegQuality
      );
    });

    const filename = `capture_${Date.now()}.jpg`;
    const file = new File([blob], filename, { type: "image/jpeg" });
    const previewUrl = URL.createObjectURL(blob);

    // Hentikan kamera setelah capture (biar hemat baterai & jelas “foto saat itu”)
    stopCamera();

    onCapture(file, previewUrl);
    onClose();
  }

  // Start/stop otomatis saat open berubah
  useEffect(() => {
    if (!open) {
      stopCamera();
      setError(null);
      setStarting(false);
      return;
    }
    if (open && autoStart) startCamera();

    // Cleanup saat unmount
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tanda video ready
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onCanPlay = () => setIsReady(true);
    v.addEventListener("canplay", onCanPlay);
    return () => v.removeEventListener("canplay", onCanPlay);
  }, [open]);

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-lg overflow-hidden rounded-lg bg-white text-left shadow-xl">
                <div className="px-4 pt-5 pb-3 sm:px-6">
                  <Dialog.Title className="text-base font-semibold text-gray-900">
                    Ambil Foto (Kamera)
                  </Dialog.Title>

                  <div className="mt-3 space-y-3">
                    {!canUseCamera ? (
                      <div className="text-sm text-red-600">
                        Browser tidak mendukung kamera.
                      </div>
                    ) : null}

                    {error ? (
                      <div className="text-sm text-red-600">{error}</div>
                    ) : null}

                    <div className="rounded-md border bg-black overflow-hidden">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full h-[320px] object-contain"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>
                        {starting
                          ? "Membuka kamera..."
                          : isReady
                            ? "Kamera siap"
                            : "Menunggu kamera..."}
                      </span>
                      <span>{facingMode === "environment" ? "Back" : "Front"}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3 py-2 rounded-md bg-white border text-sm font-semibold"
                  >
                    Batal
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={starting}
                      className="px-3 py-2 rounded-md bg-gray-200 text-gray-900 text-sm font-semibold disabled:opacity-70"
                    >
                      {starting ? "Memuat..." : "Reload Kamera"}
                    </button>

                    <button
                      type="button"
                      onClick={capture}
                      disabled={starting || !isReady}
                      className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold disabled:opacity-70"
                    >
                      Capture
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
