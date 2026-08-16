import React from 'react';
import { useSiteSettings } from '../hooks/useSiteSettings';

interface AnnouncementModalProps {
  onNext: () => void;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ onNext }) => {
  const { siteSettings } = useSiteSettings();

  const title = siteSettings?.announcement_title || 'ANNOUNCEMENT';
  const text = siteSettings?.announcement_text || '';
  const image = siteSettings?.announcement_image || '';

  const cardStyle = {
    background: 'linear-gradient(180deg, #161922 0%, #0d0d0d 100%)',
    border: '1px solid rgba(255, 105, 180, 0.25)',
  };

  return (
    <div className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="rounded-2xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-2xl relative" style={cardStyle}>
        <div className="flex flex-col items-center text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider mb-2">{title}</h2>
        </div>

        {image && (
          <div className="relative w-full rounded-xl overflow-hidden mb-4 border border-white/10 bg-black/40">
            <img 
              src={image} 
              alt="Announcement image" 
              className="w-full h-auto max-h-[220px] object-contain"
            />
          </div>
        )}

        {text && (
          <div className="text-gray-300 text-sm font-medium whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto pr-1 text-center">
            {text}
          </div>
        )}

        <button
          onClick={onNext}
          className="w-full mt-6 py-3.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-extrabold uppercase tracking-widest text-xs sm:text-sm shadow-[0_0_12px_rgba(255,0,127,0.25)] transition-all"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AnnouncementModal;
