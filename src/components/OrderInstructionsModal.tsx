import React, { useState, useEffect } from 'react';
import { useSiteSettings } from '../hooks/useSiteSettings';

interface OrderInstructionsModalProps {
  onClose: () => void;
}

const OrderInstructionsModal: React.FC<OrderInstructionsModalProps> = ({ onClose }) => {
  const { siteSettings } = useSiteSettings();
  const [view, setView] = useState<'announcement' | 'instructions'>('instructions');

  useEffect(() => {
    if (siteSettings?.announcement_active) {
      setView('announcement');
    } else {
      setView('instructions');
    }
  }, [siteSettings]);

  const cardStyle = {
    background: 'linear-gradient(180deg, #161922 0%, #0d0d0d 100%)',
    border: '1px solid rgba(255, 105, 180, 0.25)',
  };

  const steps = [
    siteSettings?.how_to_order_step_1 || 'Enter user ID',
    siteSettings?.how_to_order_step_2 || 'Select Items',
    siteSettings?.how_to_order_step_3 || 'Choose Payment Method',
    siteSettings?.how_to_order_step_4 || 'Submit Order',
  ];

  return (
    <div className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="rounded-2xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-2xl relative" style={cardStyle}>
        {view === 'announcement' ? (
          <>
            <div className="flex flex-col items-center text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider mb-2">
                {siteSettings?.announcement_title || 'ANNOUNCEMENT'}
              </h2>
            </div>

            {siteSettings?.announcement_image && (
              <div className="relative w-full rounded-xl overflow-hidden mb-4 border border-white/10 bg-black/40">
                <img 
                  src={siteSettings.announcement_image} 
                  alt="Announcement image" 
                  className="w-full h-auto max-h-[220px] object-contain"
                />
              </div>
            )}

            {siteSettings?.announcement_text && (
              <div className="text-gray-300 text-sm font-medium whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto pr-1 text-center">
                {siteSettings.announcement_text}
              </div>
            )}

            <button
              onClick={() => setView('instructions')}
              className="w-full mt-6 py-3.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-extrabold uppercase tracking-widest text-xs sm:text-sm shadow-[0_0_12px_rgba(255,0,127,0.25)] transition-all"
            >
              Next
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl mb-4 overflow-hidden border border-gray-800 bg-white/5">
                <img src="/bg.png" alt="How to Order Icon" className="w-full h-full object-contain p-1" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider mb-1">
                {siteSettings?.how_to_order_title || 'How to order'}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 font-semibold">
                {siteSettings?.how_to_order_subtitle || 'Follow these steps to place your order'}
              </p>
            </div>

            <ol className="space-y-3 mb-8 text-left">
              {steps.map((step, index) => (
                <li key={index} className="flex items-center gap-3 text-gray-300 font-semibold text-sm sm:text-base">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#2c1524]/40 border border-[#ff007f]/35 flex items-center justify-center text-xs font-black text-[#ff007f] shadow-[0_0_6px_rgba(255,0,127,0.1)]">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-extrabold uppercase tracking-widest text-xs sm:text-sm shadow-[0_0_12px_rgba(255,0,127,0.25)] transition-all"
            >
              I understand
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderInstructionsModal;
