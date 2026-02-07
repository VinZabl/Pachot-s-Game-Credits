import React, { useState, useRef, useEffect } from 'react';
import { MenuItem } from '../types';
import GameItemOrderModal from './GameItemOrderModal';

interface MenuItemCardProps {
  item: MenuItem;
  quantity?: number;
  currentMember?: import('../types').Member | null;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, currentMember }) => {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  const handleCardClick = () => {
    if (!item.available) return;
    setShowOrderModal(true);
  };

  // Check if text overflows and needs scrolling
  useEffect(() => {
    const checkOverflow = () => {
      if (!nameRef.current) return;
      
      const element = nameRef.current;
      const isOverflowing = element.scrollWidth > element.clientWidth;
      setShouldScroll(isOverflowing);
    };

    // Use setTimeout to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      checkOverflow();
    }, 100);

    window.addEventListener('resize', checkOverflow);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [item.name]);

  return (
    <>
      <div 
        onClick={handleCardClick}
        className={`relative flex flex-col transition-all duration-300 group rounded-lg overflow-hidden ${!item.available ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          border: '1px solid rgba(185, 28, 28, 0.3)',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        onMouseEnter={(e) => {
          if (item.available) {
            e.currentTarget.style.borderColor = 'rgba(185, 28, 28, 0.6)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(185, 28, 28, 0.4), 0 8px 32px 0 rgba(0, 0, 0, 0.37)';
          }
        }}
        onMouseLeave={(e) => {
          if (item.available) {
            e.currentTarget.style.borderColor = 'rgba(185, 28, 28, 0.3)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
          }
        }}
      >
        {/* Closed Text Overlay for unavailable items */}
        {!item.available && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-t-lg z-10">
            <span className="text-white font-bold text-sm sm:text-base opacity-90 font-sans">Closed</span>
          </div>
        )}
        
        {/* Game Icon - square aspect */}
        <div className="relative w-full aspect-square overflow-hidden rounded-t-lg bg-gradient-to-br from-cafe-darkCard to-cafe-darkBg transition-transform duration-300 group-hover:scale-105">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`absolute inset-0 flex items-center justify-center ${item.image ? 'hidden' : ''}`}>
            <div className="text-2xl opacity-20 text-gray-400">🎮</div>
          </div>
        </div>

        {/* Game Title + Subtitle under icon */}
        <div className="bg-gradient-to-b from-cafe-darkCard to-cafe-darkBg px-2 py-2 rounded-b-lg">
          <h4 
            ref={nameRef}
            className={`text-white font-bold text-xs sm:text-sm text-center line-clamp-2 ${
              shouldScroll ? 'animate-scroll-text' : ''
            }`}
            style={shouldScroll ? {
              display: 'inline-block',
            } : {}}
          >
            {shouldScroll ? (
              <>
                <span>{item.name}</span>
                <span className="mx-4">•</span>
                <span>{item.name}</span>
              </>
            ) : (
              item.name
            )}
          </h4>
          {item.subtitle ? (
            <p className="text-[10px] sm:text-xs text-white/80 text-center mt-0.5 truncate px-0.5">
              {item.subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <GameItemOrderModal
        item={item}
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        currentMember={currentMember}
      />
    </>
  );
};

export default MenuItemCard;