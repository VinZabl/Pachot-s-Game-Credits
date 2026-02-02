import React from 'react';
import { X, CheckCircle } from 'lucide-react';

interface WelcomeModalProps {
  username: string;
  onClose: () => void;
  onGetStarted: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ username, onClose, onGetStarted }) => {
  const cardStyle = {
    background: 'linear-gradient(180deg, #2d1b4e 0%, #1a0f2e 100%)',
    border: '1.5px solid rgba(255, 105, 180, 0.3)',
  };

  return (
    <div className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl" style={cardStyle}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">Welcome {username}!</h2>
            <p className="text-sm text-pink-200/80 mt-1">
              You have successfully logged in
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-pink-500/30 hover:bg-pink-500/20 transition-colors duration-200"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-pink-500 to-fuchsia-500 rounded-full mb-4">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <p className="text-pink-200/80 mb-6">
            Enjoy exclusive member benefits!
          </p>
          <button
            onClick={() => {
              onClose();
              onGetStarted();
            }}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
