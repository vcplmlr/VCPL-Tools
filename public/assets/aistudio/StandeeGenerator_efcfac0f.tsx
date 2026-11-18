/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Page, StandeeConfig, StandeeSize, PosterTheme } from '../types';
import { QRCanvas } from '../components/QRCanvas';
import { generateUPILink, validateUPIId } from '../utils/upi';
import { showToast } from '../hooks/useToast';
import { SEO } from '../components/SEO';
import { 
  Download, 
  Printer, 
  Upload, 
  Check, 
  Sliders, 
  Sparkles, 
  Palette, 
  Compass, 
  FileImage,
  QrCode,
  Megaphone,
  LayoutTemplate
} from 'lucide-react';
import { toPng } from '../utils/domExport';
import { jsPDF } from 'jspdf';

export const StandeeGenerator: React.FC = () => {
  const standeeRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const parentWidth = containerRef.current.clientWidth;
        const newScale = Math.min(parentWidth / 400, 1);
        setScale(newScale);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  const [config, setConfig] = useState<StandeeConfig>({
    size: 'A3',
    theme: 'premium',
    businessName: '',
    tagline: '',
    offerBanner: '',
    upiId: '',
    payeeName: '',
    phone: '',
    address: ''
  });

  const upiLink = generateUPILink({
    upiId: config.upiId,
    name: config.payeeName,
    note: 'Standee Cashier QR'
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size should be under 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setConfig(prev => ({ ...prev, logoUrl: reader.result as string }));
      showToast('Logo attached to standee!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadPNG = async () => {
    const node = standeeRef.current;
    if (!node) return;

    setDownloading(true);
    showToast('Snapshotting standee vinyl canvas...', 'info');

    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 3, // High-fidelity scaling for printing
        backgroundColor: '#FFFFFF',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: '400px',
        }
      });

      const link = document.createElement('a');
      link.download = `roll-up-standee-${config.size}-${config.businessName.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`High DPI PNG for roll-up standee generated!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to create image.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPDF = async () => {
    const node = standeeRef.current;
    if (!node) return;

    setDownloading(true);
    showToast('Assembling high-res roll-up PDF...', 'info');

    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 3,
        backgroundColor: '#FFFFFF',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: '400px',
        }
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: config.size.toLowerCase() as any
      });

      // Map standard dimensions for A3, A2, A1 in mm
      let width = 297;
      let height = 420;
      if (config.size === 'A2') {
        width = 420;
        height = 594;
      } else if (config.size === 'A1') {
        width = 594;
        height = 841;
      }

      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
      pdf.save(`standee-banner-${config.size}-${config.businessName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
      showToast(`Standee PDF compiled in ${config.size} standard successfully!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('PDF compilation failed.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const getThemeStyles = (theme: PosterTheme) => {
    switch (theme) {
      case 'premium':
        return {
          bg: 'bg-gradient-to-b from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white border-16 border-rose-600/85',
          heading: 'text-white font-extrabold',
          subtext: 'text-rose-400',
          banner: 'bg-rose-600 text-white font-extrabold border-y border-rose-400/20',
          bannerIcon: '🔥',
          qrBorder: 'border-rose-500/30'
        };
      case 'minimal':
        return {
          bg: 'bg-white text-slate-900 border-16 border-slate-900',
          heading: 'text-slate-950 font-black',
          subtext: 'text-slate-500 font-mono tracking-wider',
          banner: 'bg-slate-100 text-slate-800 font-bold border-y border-slate-200',
          bannerIcon: '📢',
          qrBorder: 'border-slate-300'
        };
      case 'dark':
        return {
          bg: 'bg-[#0B1220] text-white border-16 border-slate-800',
          heading: 'text-rose-300 font-black',
          subtext: 'text-slate-400 font-mono',
          banner: 'bg-slate-800 text-rose-300 border-y border-slate-700/50 font-bold',
          bannerIcon: '⭐',
          qrBorder: 'border-slate-800'
        };
      case 'neon':
        return {
          bg: 'bg-black text-white border-16 border-indigo-600',
          heading: 'text-cyan-300 font-extrabold',
          subtext: 'text-cyan-400 font-mono tracking-widest',
          banner: 'bg-indigo-950 text-cyan-300 font-black border-y border-indigo-500/40',
          bannerIcon: '⚡',
          qrBorder: 'border-indigo-500/50'
        };
      case 'business-gold':
        return {
          bg: 'bg-slate-950 text-yellow-100 border-16 border-yellow-600/60',
          heading: 'text-amber-400 font-black',
          subtext: 'text-yellow-500 font-mono tracking-wider',
          banner: 'bg-yellow-500 text-black font-extrabold border-y border-yellow-400',
          bannerIcon: '✨',
          qrBorder: 'border-yellow-600/30'
        };
      default:
        return {
          bg: 'bg-white text-slate-900 border-16 border-slate-900',
          heading: 'text-slate-950 font-black',
          subtext: 'text-slate-500',
          banner: 'bg-slate-100 text-slate-800 font-bold',
          bannerIcon: '📢',
          qrBorder: 'border-slate-300'
        };
    }
  };

  const themeStyles = getThemeStyles(config.theme);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <SEO 
        title="Roll-Up Shop Standee Generator | Print Ready Large Format Banners" 
        description="Format huge vinyl shop banners (A3, A2, A1 sizes) with custom offer callouts, contact footers, and large high-DPI scans. Free, professional, and secure."
      />

      <div className="mb-8 space-y-2">
        <h1 className="font-sans font-extrabold text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
          Shop Standee Generator
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-3xl">
          Construct giant vertical banner layouts for printing. Perfect for roll-up banners, storefront vinyl wraps, or cash-register promotional cards.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* DESIGN EDITOR PANEL */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-6">
          
          {/* Standee Size select */}
          <div className="space-y-4">
            <h2 className="font-sans font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-rose-500" />
              1. Commercial Poster Dimensions
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {(['A3', 'A2', 'A1'] as StandeeSize[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setConfig({ ...config, size: s })}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    config.size === s 
                      ? 'bg-rose-50 text-rose-500 border-rose-500/50 dark:bg-rose-950/20' 
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  {s} Roll-up Standard
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">
              {config.size === 'A3' ? 'A3 (297 x 420 mm)' : config.size === 'A2' ? 'A2 (420 x 594 mm)' : 'A1 Giant Vinyl (594 x 841 mm)'}. Perfect for commercial printer sizing.
            </p>
          </div>

          {/* Theme select */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="font-sans font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-rose-500" />
              2. Visual Banner Preset
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'premium', label: 'Premium Charcoal' },
                { id: 'minimal', label: 'Clean Swiss White' },
                { id: 'dark', label: 'Tech Space Dark' },
                { id: 'neon', label: 'Cyber Electric' },
                { id: 'business-gold', label: '✨ Royal Gold' }
              ].map((themeObj) => (
                <button
                  key={themeObj.id}
                  onClick={() => setConfig({ ...config, theme: themeObj.id as any })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer ${
                    config.theme === themeObj.id 
                      ? 'bg-rose-50 text-rose-600 border-rose-500/50 dark:bg-rose-950/30 dark:text-rose-300' 
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  {themeObj.label}
                </button>
              ))}
            </div>
          </div>

          {/* Offer callout */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="font-sans font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-rose-500" />
              3. Custom Offer / Promotional Banner
            </h2>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Promotion Text</label>
              <input
                type="text"
                value={config.offerBanner}
                onChange={(e) => setConfig({ ...config, offerBanner: e.target.value })}
                placeholder="e.g. FLAT 10% CASHBACK ON ALL UPI PAYMENTS"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500/50"
              />
            </div>
          </div>

          {/* Other labels */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="font-sans font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-rose-500" />
              4. Company Contact Headers
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Business Name</label>
                <input
                  type="text"
                  value={config.businessName}
                  onChange={(e) => setConfig({ ...config, businessName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Tagline / Slogan</label>
                <input
                  type="text"
                  value={config.tagline}
                  onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">UPI ID (VPA)</label>
                <input
                  type="text"
                  value={config.upiId}
                  onChange={(e) => setConfig({ ...config, upiId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Legal Name</label>
                <input
                  type="text"
                  value={config.payeeName}
                  onChange={(e) => setConfig({ ...config, payeeName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Address</label>
                <input
                  type="text"
                  value={config.address}
                  onChange={(e) => setConfig({ ...config, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Logo Upload</label>
                <input
                  type="file"
                  id="standee-logo"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <label htmlFor="standee-logo" className="flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Upload Shop Badge
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* POSTER PREVIEW */}
        <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-24">
          <div className="bg-slate-800 dark:bg-slate-950 p-4 rounded-xl flex gap-3 justify-between items-center">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Check className="w-4.5 h-4.5 text-emerald-400 stroke-[3]" /> Banner Layout Ready
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md shadow-rose-500/15 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {downloading ? 'Assembling...' : `Standee PDF (${config.size})`}
              </button>
              <button
                onClick={handleDownloadPNG}
                disabled={downloading}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                Standee PNG
              </button>
            </div>
          </div>

          {/* LARGE STANDEE CANVAS PREVIEW (Forced vertical banner ratio 400x700px) */}
          <div className="flex justify-center w-full">
            <div 
              ref={containerRef}
              className="border border-slate-200/60 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl bg-white text-slate-800 w-full max-w-[400px]"
            >
              <div 
                className="w-full relative overflow-hidden"
                style={{ height: `${700 * scale}px` }}
              >
                <div 
                  ref={standeeRef}
                  className={`absolute top-0 left-0 origin-top-left flex flex-col justify-between items-center text-center transition-all ${themeStyles.bg}`}
                  style={{ 
                    width: '400px', 
                    minHeight: '700px',
                    borderWidth: '20px',
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    padding: '32px'
                  }}
                >
                {/* Header branding */}
                <div className="space-y-1 z-10 w-full pt-2">
                  {config.logoUrl ? (
                    <img src={config.logoUrl} alt="Logo" className="max-h-14 max-w-[140px] mx-auto object-contain mb-2 bg-white/10 p-1.5 rounded-lg" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white text-base font-bold mx-auto mb-2">
                      ⭐
                    </div>
                  )}
                  <h2 className={`font-sans text-2xl uppercase tracking-tight leading-none ${themeStyles.heading}`}>
                    {config.businessName}
                  </h2>
                  <p className={`text-[10px] tracking-widest uppercase font-semibold opacity-80 ${themeStyles.subtext}`}>
                    {config.tagline || 'Shop Checkout Spot'}
                  </p>
                </div>

                {/* Offer Callout Banner block */}
                {config.offerBanner && (
                  <div className={`w-full py-3.5 px-2 my-4 z-10 ${themeStyles.banner}`}>
                    <p className="text-xs tracking-wide uppercase leading-normal">
                      {themeStyles.bannerIcon} {config.offerBanner} {themeStyles.bannerIcon}
                    </p>
                  </div>
                )}

                {/* Giant QR Canvas for roll-up scan distance */}
                <div className="my-3 z-10">
                  <span className="block text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                    CASHIER DIGITAL COUNTER
                  </span>
                  <div className={`p-4 rounded-[2.5rem] bg-white shadow-2xl border-4 ${themeStyles.qrBorder}`}>
                    <QRCanvas
                      value={upiLink}
                      fgColor="#0F172A"
                      bgColor="#FFFFFF"
                      qrStyle={config.theme === 'minimal' ? 'square' : 'rounded'}
                      logoUrl={config.logoUrl}
                      transparentBg={false}
                      size={200}
                    />
                  </div>
                </div>

                {/* Bottom App intent options and address info */}
                <div className="space-y-3 w-full z-10 pb-2">
                  <div className="text-[10px] tracking-widest font-extrabold text-slate-400 uppercase">
                    Scan with any merchant banking app
                  </div>

                  <div className="flex justify-center gap-1.5 text-[9px] font-mono opacity-80">
                    <span className="bg-white/15 px-2 py-0.5 rounded text-[10px]">GPay</span>
                    <span className="bg-white/15 px-2 py-0.5 rounded text-[10px]">PhonePe</span>
                    <span className="bg-white/15 px-2 py-0.5 rounded text-[10px]">BHIM</span>
                    <span className="bg-white/15 px-2 py-0.5 rounded text-[10px]">CRED</span>
                    <span className="bg-white/15 px-2 py-0.5 rounded text-[10px]">Paytm</span>
                  </div>

                  {/* Footing rails */}
                  <div className="text-[9px] opacity-60 leading-relaxed font-semibold">
                    {config.address && <p>📍 {config.address}</p>}
                    <p className="font-mono text-[8px] uppercase tracking-wider pt-1 opacity-40">
                      VPA: {config.upiId}
                    </p>
                  </div>
                </div>

                {/* Standee watermark banner */}
                <div className="absolute bottom-1 left-4 right-4 text-[7px] opacity-35 uppercase tracking-widest font-mono text-center">
                  ROLL-UP BANNER READY • COMPILATION SIZE {config.size} • TOOLSDESK
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
