import React from 'react';
import { ShoppingCart, Coins } from 'lucide-react';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { Member } from '../types';

interface HeaderProps {
  cartItemsCount?: number;
  onCartClick?: () => void;
  onMenuClick?: () => void;
  onMemberClick?: () => void;
  currentMember?: Member | null;
}

const Header: React.FC<HeaderProps> = ({ cartItemsCount = 0, onCartClick, onMenuClick, onMemberClick, currentMember }) => {
  const showCart = onCartClick != null;
  const { siteSettings } = useSiteSettings();

  // Blinking dot state for online indicator
  const [dotVisible, setDotVisible] = React.useState(true);
  React.useEffect(() => {
    const t = setInterval(() => setDotVisible(v => !v), 900);
    return () => clearInterval(t);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 shadow-sm"
      style={{
        border: 'none',
        background: 'rgba(13, 13, 13, 0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 105, 180, 0.15)',
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Top row: logo + member button */}
        <div className="flex items-center justify-between py-1.5 md:py-2">
          <button
            onClick={onMenuClick ?? (() => {})}
            className="text-white hover:opacity-80 transition-colors duration-200 flex items-center gap-2.5"
          >
            <img
              src="/logo.png"
              alt="Pachot's Game Credits Logo"
              className="h-9 sm:h-11 md:h-14 w-auto object-contain"
              onError={(e) => {
                if (e.currentTarget.src !== '/logo.png') {
                  e.currentTarget.src = '/logo.png';
                }
              }}
            />
            <div className="flex flex-col items-start leading-tight">
              <span className="text-sm sm:text-base md:text-lg font-bold text-white whitespace-nowrap">
                Pachot's Game Credits
              </span>
              {/* Status row */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="w-1.5 h-1.5 rounded-full transition-opacity duration-300"
                  style={{
                    backgroundColor: '#4ade80',
                    opacity: dotVisible ? 1 : 0.2,
                    boxShadow: dotVisible ? '0 0 6px rgba(74,222,128,0.8)' : 'none',
                  }}
                />
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                  Mon–Sun · 8AM–10PM
                </span>
                <span className="text-gray-600 text-[9px]">·</span>
                <span className="text-[9px] text-gray-500 uppercase tracking-widest whitespace-nowrap">
                  Manual Process · Order Form
                </span>
              </div>
            </div>
          </button>

          <div className="flex items-center space-x-2">
            {onMemberClick && (
              <button
                onClick={onMemberClick}
                className="p-2 text-white hover:opacity-80 hover:bg-white/10 rounded-full transition-all duration-200"
                title={currentMember ? currentMember.username : 'Member Login'}
              >
                <Coins className={`h-5 w-5 sm:h-6 sm:w-6 ${currentMember?.user_type === 'reseller' ? 'text-amber-400' : 'text-white'}`} />
              </button>
            )}
            {showCart && (
              <button
                onClick={onCartClick}
                className="relative p-2 text-white hover:opacity-80 hover:bg-white/10 rounded-full transition-all duration-200"
              >
                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center glow-blue">
                    {cartItemsCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;