import React from 'react';
import { ClipboardList } from 'lucide-react';

interface OrderInstructionsModalProps {
  onClose: () => void;
}

const STEPS = [
  'Enter user ID',
  'Select Items',
  'Choose Payment Method',
  'Upload',
  'Submit Order',
];

const OrderInstructionsModal: React.FC<OrderInstructionsModalProps> = ({ onClose }) => {
  const cardStyle = {
    background: 'linear-gradient(180deg, #2d1b4e 0%, #1a0f2e 100%)',
    border: '1.5px solid rgba(255, 105, 180, 0.3)',
  };

  return (
    <div className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl" style={cardStyle}>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-pink-500 to-fuchsia-500 rounded-full mb-4">
            <ClipboardList className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-1">How to order</h2>
          <p className="text-sm text-pink-200/80">Follow these steps to place your order</p>
        </div>

        <ol className="space-y-3 mb-8 text-left">
          {STEPS.map((step, index) => (
            <li key={index} className="flex items-center gap-3 text-white">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-pink-500/30 border border-pink-500/50 flex items-center justify-center text-sm font-medium text-pink-200">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <button
          onClick={onClose}
          className="w-full py-3 bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
        >
          I understand
        </button>
      </div>
    </div>
  );
};

export default OrderInstructionsModal;
