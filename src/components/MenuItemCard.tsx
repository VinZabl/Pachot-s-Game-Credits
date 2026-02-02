import React, { useState, useRef, useEffect } from 'react';
import { XCircle } from 'lucide-react';
import { MenuItem } from '../types';
import GameItemOrderModal from './GameItemOrderModal';

interface MenuItemCardProps {
  item: MenuItem;
  quantity?: number;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item }) => {
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
      {/* Uniform vertical layout for all items: image on top, title, subtitle */}
      <div 
        onClick={handleCardClick}
        className={`flex flex-col items-center transition-all duration-300 group rounded-xl overflow-hidden ${!item.available ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} glass-card hover:glass-hover`}
      >
        {/* Game Image Icon on Top - corner to corner */}
        <div className="relative w-full aspect-square overflow-hidden bg-gradient-to-br from-cafe-darkCard to-cafe-darkBg transition-transform duration-300 group-hover:scale-105">
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
            {!item.available ? (
              <XCircle className="h-12 w-12 sm:h-16 sm:w-16 opacity-30 text-gray-400" />
            ) : (
              <div className="text-4xl opacity-20 text-gray-400">🎮</div>
            )}
          </div>
        </div>
        
        {/* Game Title and Subtitle - compact padding */}
        <div className="w-full px-2 py-1.5">
          <h4 
            ref={nameRef}
            className={`text-white font-bold text-center text-xs sm:text-sm mb-0 ${
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
          
          {/* Subtitle */}
          {item.subtitle && (
            <p className="text-xs text-gray-400 text-center mt-0.5">
              {item.subtitle}
            </p>
          )}
        </div>
      </div>

      <GameItemOrderModal
        item={item}
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
      />
    </>
  );
};

export default MenuItemCard;