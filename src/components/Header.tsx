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
        <div className="flex items-center justify-between py-2 sm:py-3">
          <a
            href="/"
            className="hover:opacity-90 transition-opacity duration-200 flex items-center"
          >
            <img
              src="/logo.png"
              alt="PGCSHOP Logo"
              className="h-8 sm:h-11 md:h-14 w-auto object-contain"
              onError={(e) => {
                if (e.currentTarget.src !== '/logo.png') {
                  e.currentTarget.src = '/logo.png';
                }
              }}
            />
          </a>

          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Custom Schedule & Process Banner */}
            <div className="flex flex-col items-end justify-center leading-none">
              <div className="relative bg-[#161922]/30 rounded-full px-3.5 py-1 text-[9px] sm:text-xs font-extrabold text-[#ff007f] tracking-wider whitespace-nowrap">
                Manual Process Top-Up
              </div>
              <span className="text-[8px] sm:text-[10px] font-black text-gray-400 tracking-widest mt-1.5 uppercase pr-3.5">
                Open 8AM - 10PM
              </span>
            </div>

            {onMemberClick && (
              <button
                onClick={onMemberClick}
                className="p-1.5 sm:p-2 text-white hover:opacity-80 hover:bg-white/10 rounded-full transition-all duration-200"
                title={currentMember ? currentMember.username : 'Member Login'}
              >
                <Coins className={`h-5 w-5 sm:h-6 sm:w-6 ${currentMember?.user_type === 'reseller' ? 'text-amber-400' : 'text-white'}`} />
              </button>
            )}
            {showCart && (
              <button
                onClick={onCartClick}
                className="relative p-1.5 sm:p-2 text-white hover:opacity-80 hover:bg-white/10 rounded-full transition-all duration-200"
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