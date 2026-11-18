/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, Download, Info, Sparkles } from 'lucide-react';

interface QRCodeGeneratorProps {
  upiId: string;
  businessName: string;
  amount?: number;
  remarks?: string;
  accentColor?: string; // Kept for backwards compatibility
  badge?: string; // Kept for backwards compatibility
}

export default function QRCodeGenerator({ 
  upiId, 
  businessName, 
  amount,
  remarks = ''
}: QRCodeGeneratorProps) {
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>('');

  const cleanUpiId = upiId.trim();
  const cleanBusinessName = businessName.trim() || 'Merchant';

  // Construct standard NPCI UPI Deep Link Schema
  const upiLink = `upi://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanBusinessName)}&cu=INR${
    amount && amount > 0 ? `&am=${amount.toFixed(2)}` : ''
  }${remarks ? `&tn=${encodeURIComponent(remarks.trim())}` : ''}`;

  useEffect(() => {
    if (!cleanUpiId) {
      setQrUrl('');
      return;
    }

    QRCode.toDataURL(upiLink, {
      margin: 1,
      width: 512,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#030712', // High-contrast deep slate-black for reliable optical scanning
        light: '#ffffff' // Pure crisp white canvas background
      }
    })
    .then(url => {
      setQrUrl(url);
    })
    .catch(err => {
      console.error('Error generating working QR code URL:', err);
    });
  }, [cleanUpiId, cleanBusinessName, amount, remarks, upiLink]);

  const copyUpiId = () => {
    navigator.clipboard.writeText(cleanUpiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFintechStandee = () => {
    if (!qrUrl) return;

    // Create programmatically formatted offscreen canvas card
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 850;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. LinkUPI-themed Gradient Background
    const grad = ctx.createLinearGradient(0, 0, 0, 850);
    grad.addColorStop(0, '#0A0F24'); // Deep Midnight Blue
    grad.addColorStop(0.35, '#121B3A');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 850);

    // 2. Artistic decorative fintech pattern overlay lines
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 950; i += 45) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(600, i + 120);
      ctx.stroke();
    }

    // 3. Crisp Cyan Border Header Stripe
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(0, 0, 600, 16);

    // LinkUPI Standee Branding Header text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LinkUPI', 300, 75);

    ctx.fillStyle = '#CBE9FF';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('⚡ PEER-TO-PEER ZERO-FEE UPI GATEWAY ⚡', 300, 115);

    // 4. White Center QR Card Plate (Iconic merchant standee card body)
    ctx.fillStyle = '#FFFFFF';
    const rx = 80;
    const ry = 160;
    const rw = 440;
    const rh = 540;
    const radius = 24;
    ctx.beginPath();
    ctx.moveTo(rx + radius, ry);
    ctx.lineTo(rx + rw - radius, ry);
    ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
    ctx.lineTo(rx + rw, ry + rh - radius);
    ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
    ctx.lineTo(rx + radius, ry + rh);
    ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
    ctx.lineTo(rx, ry + radius);
    ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
    ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Top Brand Accent Logo in white container card
    ctx.fillStyle = '#2563EB';
    ctx.font = 'bold font-sora 30px sans-serif';
    ctx.fillText('LinkUPI', 300, 205); 
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(200, 215, 200, 2.5);

    // Business Name display in white card
    ctx.fillStyle = '#020C3E';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(cleanBusinessName.toUpperCase(), 300, 252);

    // 5. Draw actual UPI QR Image onto the grid canvas
    const qrImg = new Image();
    qrImg.onload = () => {
      // Draw centered image
      ctx.drawImage(qrImg, 140, 275, 320, 320);

      // Amount Badge / Layout
      if (amount && amount > 0) {
        // High-contrast gold background pill badge
        ctx.fillStyle = '#FFF8E7';
        ctx.strokeStyle = '#FFBA05';
        ctx.lineWidth = 2.5;
        const px = 170;
        const py = 612;
        const pw = 260;
        const ph = 52;
        const pr = 16;
        ctx.beginPath();
        ctx.moveTo(px + pr, py);
        ctx.lineTo(px + pw - pr, py);
        ctx.quadraticCurveTo(px + pw, py, px + pw, py + pr);
        ctx.lineTo(px + pw, py + ph - pr);
        ctx.quadraticCurveTo(px + pw, py + ph, px + pw - pr, py + ph);
        ctx.lineTo(px + pr, py + ph);
        ctx.quadraticCurveTo(px, py + ph, px, py + ph - pr);
        ctx.lineTo(px, py + pr);
        ctx.quadraticCurveTo(px, py, px + pr, py);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#DF9502';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('REQUESTED AMOUNT:', 300, 628);

        ctx.fillStyle = '#1E293B';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(`₹ ${amount.toFixed(2)}`, 300, 654);
      } else {
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('★ ZERO TRANSACTION LIMIT ★', 300, 625);
      }

      // Exact bank routing VPA handle
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`UPI ID: ${cleanUpiId}`, 300, 684);

      // Bottom support ribbon
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, 770, 600, 80);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px sans-serif';
      ctx.fillText('DIRECT PEER-TO-PEER BANK TRANSFER SECURED BY LINkUPI', 300, 805);

      ctx.fillStyle = '#3B82F6';
      ctx.font = 'italic 10px sans-serif';
      ctx.fillText('Direct account-to-account manual settlement matrix protected by LinkUPI Sandbox License', 300, 828);

      // Export canvas download stream safely
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `linkupi_merchant_standee_${cleanBusinessName.replace(/\s+/g, '_')}.jpg`;
      link.click();
    };

    qrImg.src = qrUrl;
  };

  return (
    <div id="qr-code-generator" className="flex flex-col items-center bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden w-full max-w-sm">
      {/* Absolute ambient light effects */}
      <div className="absolute top-0 right-0 -m-8 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -m-8 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

      {/* Title Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-slate-800 text-blue-400 rounded-lg flex items-center justify-center">
          <QrCode className="w-4 h-4 text-blue-400" />
        </div>
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Scan &amp; Settle Instantly</span>
      </div>

      {/* Frame Container holding the real generated QR Image */}
      <div className="bg-white p-4.5 rounded-2xl w-56 h-56 flex flex-col justify-center items-center relative shadow-inner border border-slate-100">
        {/* Dynamic target corner markers */}
        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>

        {qrUrl ? (
          <img 
            src={qrUrl} 
            alt="UPI QR Code Grid" 
            className="w-full h-full object-contain rounded-lg select-all" 
            id="svg-qr-matrix" // Keep the ID so downloader handles SVG/PNG fallback gracefully
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-3 text-slate-400 font-mono text-xs">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin mb-2"></div>
            <span>Configuring Matrix...</span>
          </div>
        )}
      </div>

      {/* Live Amount Indicator */}
      {amount && amount > 0 ? (
        <div className="text-center mt-3 z-10 bg-emerald-950/20 border border-emerald-900/40 px-3 py-1.5 rounded-xl">
          <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wide block">Dynamic Active Amount</span>
          <div className="font-black text-base text-emerald-400 font-mono">₹{amount.toFixed(2)}</div>
        </div>
      ) : (
        <div className="text-center mt-3 z-10 bg-slate-950/20 border border-slate-800/50 px-3 py-1.5 rounded-xl">
          <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wide block">Variable Cash Mode</span>
          <div className="font-extrabold text-xs text-slate-300">Enter Any Amount</div>
        </div>
      )}

      {/* Copy Actions */}
      <div className="w-full mt-4 flex flex-col items-center gap-2">
        <div className="text-[10px] text-slate-550 font-mono text-center flex items-center justify-center gap-1.5 max-w-full">
          <span className="text-slate-500">Payee:</span>
          <span className="font-bold text-slate-300 select-all truncate max-w-[150px] inline-block">{cleanUpiId || 'Pending Profile Setup'}</span>
        </div>
        
        <div className="flex flex-col gap-2 w-full">
          <div className="flex gap-2 w-full">
            <button
              onClick={copyUpiId}
              disabled={!cleanUpiId}
              type="button"
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-[10.5px] transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
                copied 
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700/80 hover:border-slate-650'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy UPI ID
                </>
              )}
            </button>

            {qrUrl && (
              <a
                href={qrUrl}
                download={`linkupi_qr_${cleanBusinessName.replace(/\s+/g, '_')}.png`}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl font-bold text-[10.5px] bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700/80 hover:border-slate-650 transition-all duration-300"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG QR</span>
              </a>
            )}
          </div>

          {qrUrl && (
            <button
              onClick={downloadFintechStandee}
              type="button"
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-extrabold text-[10.5px] uppercase tracking-wider bg-gradient-to-r from-blue-650 to-indigo-600 hover:from-blue-600 hover:to-indigo-550 text-white shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 cursor-pointer border border-blue-500/20"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-200 animate-pulse" />
              <span>Download LinkUPI Standee JPG</span>
            </button>
          )}
        </div>
      </div>

      {/* Safe message banner */}
      <div className="flex items-center gap-1.5 mt-4 text-[9.5px] text-slate-450">
        <span className="text-blue-400">🛡️</span>
        <span className="leading-tight">Compatible with all secure bank apps and standard peer-to-peer mobile payments.</span>
      </div>
    </div>
  );
}
