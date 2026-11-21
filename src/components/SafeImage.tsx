import {useState} from 'react';
import {Building2} from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function SafeImage({src, alt, className = '', fallbackTitle}: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#EAE9E4] to-[#DCDAD2] text-[#575652] p-6 text-center ${className}`}
      >
        <Building2 className="w-8 h-8 mb-2 stroke-[1.5]" aria-hidden="true" />
        <span className="text-sm font-medium text-[#141413]">
          {fallbackTitle || 'Architectural Acoustic Pavilion'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
