import { useEffect, useState } from 'react';
import { 
  Compass, 
  Home, 
  ArrowLeft, 
  AlertTriangle, 
  ShieldAlert, 
  ChevronRight, 
  MessageSquare,
  HelpCircle,
  Globe2
} from 'lucide-react';
import { motion } from 'motion/react';

interface NotFoundProps {
  onBackToHome?: () => void;
  onNavigateToSection?: (sectionId: string) => void;
  onOpenContactPopup?: () => void;
}

export default function NotFound({
  onBackToHome,
  onNavigateToSection,
  onOpenContactPopup
}: NotFoundProps) {
  const [isHoveredCompass, setIsHoveredCompass] = useState(false);

  // SEO Optimization & Metadata Handler
  useEffect(() => {
    const originalTitle = document.title;
    document.title = "404 - Page Not Found | ToolsDesk";

    let metaDesc = document.querySelector('meta[name="description"]');
    const originalMetaDesc = metaDesc ? metaDesc.getAttribute('content') : '';

    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', "The page you requested could not be found.");

    return () => {
      document.title = originalTitle;
      if (metaDesc) {
        if (originalMetaDesc) {
          metaDesc.setAttribute('content', originalMetaDesc);
        } else {
          metaDesc.remove();
        }
      }
    };
  }, []);

  const handleLinkClick = (sectionId: string) => {
    if (onBackToHome) onBackToHome();
    if (onNavigateToSection) {
      setTimeout(() => {
        onNavigateToSection(sectionId);
      }, 150);
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else if (onBackToHome) {
      onBackToHome();
    }
  };

  return (
    <div 
      className="min-h-screen bg-[#070B18] pt-28 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex flex-col justify-center items-center font-sans select-none"
      id="fintrax-premium-404"
    >
      {/* Visual background ambient grids & plasma glows matching corporate dashboard */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.18)_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,102,255,0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.1),transparent_60%)]" />
      
      {/* Glowing bottom line & top borders */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#0066FF]/40 to-transparent z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent z-10" />

      {/* Decorative Interactive Floating Nodes */}
      <div className="absolute inset-0 opacity-25 pointer-events-none">
        <div className="absolute top-20 left-16 w-2 h-2 bg-white rounded-full animate-ping [animation-duration:4s]" />
        <div className="absolute top-1/4 right-24 w-2.5 h-2.5 bg-[#0066FF] rounded-full animate-pulse [animation-duration:2.5s]" />
        <div className="absolute bottom-32 left-1/4 w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse [animation-duration:3.5s]" />
        <div className="absolute top-1/3 left-1/3 w-2 h-2 bg-emerald-500 rounded-full animate-pulse [animation-duration:6s]" />
      </div>

      <div className="max-w-4xl w-full text-center relative z-10 space-y-10">
        
        {/* Glow-Framed Premium Indicator Badge */}
        <div className="flex justify-center" id="premium-badge-404">
          <motion.div 
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="inline-flex items-center space-x-2 px-4 py-1.5 bg-slate-950/90 text-red-400 border border-red-500/30 rounded-full text-[10px] font-mono font-black uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.15)] backdrop-blur-md"
          >
            <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
            <span className="text-red-300">System Code Matrix: Invalid Route Identifier</span>
          </motion.div>
        </div>

        {/* Dynamic Display Grid combining interactive visualizer and copywriting */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center text-center lg:text-left pt-2 pb-6">
          
          {/* LEFT PANEL: Interactive Compass / Radar visualization */}
          <div className="lg:col-span-5 flex flex-col items-center space-y-6" id="visualizer-column">
            
            <div className="relative">
              {/* Outer soft blue accent glow */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-[#0066FF]/10 to-indigo-500/10 rounded-full blur-2xl opacity-75 pointer-events-none group-hover:opacity-100 transition-opacity" />
              
              <motion.div 
                whileHover={{ scale: 1.02 }}
                onMouseEnter={() => setIsHoveredCompass(true)}
                onMouseLeave={() => setIsHoveredCompass(false)}
                className="relative w-60 h-60 rounded-full border border-slate-800/80 flex items-center justify-center bg-slate-950/70 cursor-pointer transition-all duration-500 hover:border-[#0066FF]/60 hover:shadow-[0_0_60px_rgba(0,102,255,0.2)] group backdrop-blur-md"
              >
                {/* Radar Sweep Circles */}
                <div className="absolute inset-4 rounded-full border border-slate-900/50" />
                <div className="absolute inset-12 rounded-full border border-[#0066FF]/10" />
                <div className="absolute inset-24 rounded-full border border-slate-900" />
                <div className="absolute inset-32 rounded-full border border-slate-900/30" />
                
                {/* Sweep Lines */}
                <div className="absolute inset-0 rounded-full border-t border-transparent border-t-[#0066FF]/35 pointer-events-none animate-spin" style={{ animationDuration: '3.5s' }} />
                <div className="absolute inset-6 rounded-full border-r border-transparent border-r-indigo-500/25 pointer-events-none animate-spin" style={{ animationDuration: '7s', animationDirection: 'reverse' }} />
                
                {/* Active radar highlighting sector */}
                <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_75%,rgba(0,102,255,0.08))] rounded-full animate-spin [animation-duration:5s]" />

                {/* Cardinal Points */}
                <span className="absolute top-1.5 text-[9px] font-mono text-slate-500 font-bold">N</span>
                <span className="absolute bottom-1.5 text-[9px] font-mono text-slate-500 font-bold">S</span>
                <span className="absolute right-2.5 text-[9px] font-mono text-slate-500 font-bold">E</span>
                <span className="absolute left-2.5 text-[9px] font-mono text-slate-500 font-bold">W</span>

                <div className="z-10 text-center space-y-1 filter group-hover:drop-shadow-[0_0_10px_rgba(0,102,255,0.5)] transition-all">
                  <div className="relative inline-block">
                    {/* Glowing Accent Warning Icon */}
                    <AlertTriangle className={`w-12 h-12 text-[#0066FF] mx-auto transition-all duration-500 ${isHoveredCompass ? 'scale-110 drop-shadow-[0_0_15px_rgba(0,102,255,0.8)]' : ''}`} />
                  </div>
                  <span className="block text-[10px] font-mono uppercase tracking-widest text-[#0066FF] font-black">
                    GRID_DESYNC
                  </span>
                  <span className="block text-[8px] font-mono text-slate-500 uppercase leading-none">
                    SECURE_MODE_ACTIVE
                  </span>
                </div>
                
                {/* Digital location stamp coordinates */}
                <span className="absolute top-6 left-12 text-[7px] font-mono text-slate-600">SEC_LAT: 12.87N</span>
                <span className="absolute bottom-6 right-12 text-[7px] font-mono text-slate-600">SEC_LON: 74.84E</span>
              </motion.div>
            </div>

            <div className="text-center space-y-1 flex items-center space-x-2 bg-slate-900/30 px-3.5 py-1.5 rounded-xl border border-slate-900 backdrop-blur-sm">
              <Globe2 className="w-3.5 h-3.5 text-[#0066FF]" />
              <span className="text-[9px] font-mono font-bold tracking-wider text-slate-400">FINANCIAL COMPLIANCE GRID</span>
            </div>

          </div>

          {/* RIGHT PANEL: Large 404 text, description, action items */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6 text-center lg:text-left" id="text-content-column">
            
            {/* Massive Glowing 404 Display */}
            <div className="relative select-none inline-block lg:block">
              <motion.h1 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="text-8xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-100 to-slate-500 drop-shadow-[0_15px_30px_rgba(0,100,255,0.18)] font-mono leading-none"
              >
                4<span className="text-[#0066FF] drop-shadow-[0_0_30px_rgba(0,102,255,0.85)] inline-block animate-pulse">0</span>4
              </motion.h1>
              <div className="text-xs font-mono text-[#0066FF]/65 mt-2 tracking-widest uppercase font-extrabold flex items-center justify-center lg:justify-start space-x-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                <span>Page Not Found</span>
              </div>
            </div>

            {/* Title & Copy description */}
            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight uppercase font-display leading-tight">
                Oops! Pathway Displaced
              </h2>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed font-sans font-medium">
                The page you are looking for doesn't exist, may have been moved, or the URL might be incorrect.
              </p>
              <p className="text-xs text-slate-500 font-mono font-semibold tracking-wide">
                Let's get you back to where you need to be.
              </p>
            </div>

            {/* Production-grade Navigation Action CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-3" id="not-found-navigation-ctas">
              {/* Primary button: Go to Dashboard */}
              <button 
                onClick={() => handleLinkClick('home')}
                className="flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-black text-xs uppercase tracking-wider shadow-[0_4px_20px_rgba(0,102,255,0.3)] hover:shadow-[0_6px_25px_rgba(0,102,255,0.45)] transition-all duration-300 cursor-pointer hover:translate-y-[-1.5px] w-full sm:w-auto"
              >
                <Home className="w-4 h-4" />
                <span>Go to Dashboard</span>
              </button>

              {/* Secondary button: Go Back */}
              <button 
                onClick={handleGoBack}
                className="flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-slate-350 border border-slate-800 hover:border-slate-700 hover:text-white transition-all duration-300 cursor-pointer w-full sm:w-auto font-black text-xs uppercase tracking-wider shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Go Back</span>
              </button>
            </div>

            {/* Popular safe links section */}
            <div className="pt-4 border-t border-slate-900 space-y-3" id="popular-links-box">
              <div className="flex items-center space-x-1.5 justify-center lg:justify-start">
                <HelpCircle className="w-3.5 h-3.5 text-[#0066FF]" />
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Popular compliance links</span>
              </div>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                <button 
                  onClick={() => handleLinkClick('home')}
                  className="text-xs px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-[#0066FF]/40 text-slate-400 hover:text-[#0066FF] rounded-lg transition-all cursor-pointer font-bold uppercase tracking-wider"
                >
                  Home
                </button>
                <button 
                  onClick={() => handleLinkClick('services')}
                  className="text-xs px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-[#0066FF]/40 text-slate-400 hover:text-[#0066FF] rounded-lg transition-all cursor-pointer font-bold uppercase tracking-wider"
                >
                  Services
                </button>
                <button 
                  onClick={() => handleLinkClick('about')}
                  className="text-xs px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-[#0066FF]/40 text-slate-400 hover:text-[#0066FF] rounded-lg transition-all cursor-pointer font-bold uppercase tracking-wider"
                >
                  About
                </button>
                <button 
                  onClick={() => handleLinkClick('contact')}
                  className="text-xs px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-[#0066FF]/40 text-slate-400 hover:text-[#0066FF] rounded-lg transition-all cursor-pointer font-bold uppercase tracking-wider"
                >
                  Contact
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
