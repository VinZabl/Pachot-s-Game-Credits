import React from 'react';
import { ClipboardList } from 'lucide-react';
import { useSiteSettings } from '../hooks/useSiteSettings';

interface OrderInstructionsModalProps {
  onClose: () => void;
}

const OrderInstructionsModal: React.FC<OrderInstructionsModalProps> = ({ onClose }) => {
  const { siteSettings } = useSiteSettings();
  
  const title = siteSettings?.how_to_order_title || 'How to order';
  const subtitle = siteSettings?.how_to_order_subtitle || 'Follow these steps to place your order';
  
  const steps = [
    siteSettings?.how_to_order_step_1 || 'Enter user ID',
    siteSettings?.how_to_order_step_2 || 'Select Items',
    siteSettings?.how_to_order_step_3 || 'Choose Payment Method',
    siteSettings?.how_to_order_step_4 || 'Submit Order',
  ];

  const cardStyle = {
    background: 'linear-gradient(180deg, #161922 0%, #0d0d0d 100%)',
    border: '1px solid rgba(255, 105, 180, 0.25)',
  };

  return (
    <div className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="rounded-2xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-2xl relative" style={cardStyle}>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl mb-4 overflow-hidden border border-gray-800 bg-white/5">
            <img src="/bg.png" alt="How to Order Icon" className="w-full h-full object-contain p-1" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider mb-1">{title}</h2>
          <p className="text-xs sm:text-sm text-gray-500 font-semibold">{subtitle}</p>
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
      </div>
    </div>
  );
};

export default OrderInstructionsModal;
