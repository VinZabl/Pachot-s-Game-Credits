import React from 'react';
import { ShoppingCart, Coins } from 'lucide-react';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { Member } from '../types';

interface HeaderProps {
  cartItemsCount?: number;
  onCartClick?: () => void;
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ cartItemsCount = 0, onCartClick, onMenuClick }) => {
  const showCart = onCartClick != null;

  return (
    <header className="sticky top-0 z-50 shadow-sm" style={{ 
      border: 'none',
      background: 'rgba(13, 13, 13, 0.95)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 105, 180, 0.2)'
    }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 md:py-2">
        <div className="flex items-center justify-between min-h-10 md:min-h-12">
          <button 
            onClick={onMenuClick ?? (() => {})}
            className="text-white hover:opacity-80 transition-colors duration-200 flex items-center gap-3"
          >
            <img 
              src="/logo.png" 
              alt="Pachot's Game Credits Logo"
              className="h-10 sm:h-12 md:h-16 w-auto object-contain"
              onError={(e) => {
                if (e.currentTarget.src !== '/logo.png') {
                  e.currentTarget.src = '/logo.png';
                }
              }}
            />
            <span className="text-base sm:text-lg md:text-xl font-bold text-white whitespace-nowrap">
              Pachot's Game Credits
            </span>
          </button>

          {showCart && (
            <div className="flex items-center space-x-2">
              <button 
                onClick={onCartClick}
                className="relative p-2 text-white hover:opacity-80 hover:bg-white/10 rounded-full transition-all duration-200"
              >
                <ShoppingCart className="h-6 w-6" />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-bounce-gentle glow-blue">
                    {cartItemsCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;