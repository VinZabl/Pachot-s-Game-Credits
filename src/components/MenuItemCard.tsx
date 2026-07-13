import React, { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { MenuItem } from '../types';
import GameItemOrderModal from './GameItemOrderModal';

interface MenuItemCardProps {
  item: MenuItem;
  quantity?: number;
  currentMember?: import('../types').Member | null;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, currentMember }) => {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleCardClick = () => {
    if (!item.available) return;
    setShowOrderModal(true);
  };

  return (
    <>
      <button
        onClick={handleCardClick}
        disabled={!item.available}
        className={`
          group relative w-full text-left rounded-xl p-3 sm:p-4
          flex items-center gap-3 sm:gap-4 h-20 sm:h-24
          transition-all duration-300
          border border-transparent
          ${!item.available
            ? 'opacity-50 cursor-not-allowed bg-[#161922]/40'
            : 'cursor-pointer bg-[#161922]/90 hover:bg-[#2c1524] active:bg-[#3d1d32] hover:border-pink-500 hover:shadow-[0_0_15px_rgba(236,72,153,0.25)] hover:scale-[1.01] active:scale-[0.99]'
          }
        `}
      >
        {/* Closed overlay */}
        {!item.available && (
          <div className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center z-10">
            <span className="text-white font-bold text-xs bg-red-600/80 px-2.5 py-1 rounded-md uppercase tracking-wider">Closed</span>
          </div>
        )}

        {/* Thumbnail Image on the Left */}
        <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 border border-white/5 flex items-center justify-center">
          {!item.image || imageError ? (
            <Gamepad2 className="w-5 h-5 sm:w-8 sm:h-8 text-pink-500/80" />
          ) : (
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImageError(true)}
            />
          )}
        </div>

        {/* Content on the Right */}
        <div className="flex-1 min-w-0 flex flex-col justify-center pr-2 sm:pr-3">
          {/* Game Title */}
          <span className={`font-extrabold text-pink-500 uppercase tracking-wide leading-tight whitespace-normal break-words line-clamp-2 ${
            item.name.replace(/^[🟢\s]+/, '').trim().length > 15
              ? 'text-[10px] sm:text-xs'
              : 'text-xs sm:text-sm'
          }`}>
            {item.name.replace(/^[🟢\s]+/, '').trim()}
          </span>
          
          {/* Subtitle / Estimated Time */}
          <span className="text-[10px] sm:text-xs text-gray-400 mt-0.5 whitespace-normal break-words truncate">
            {(() => {
              const sub = item.subtitle ? item.subtitle.trim() : '';
              if (!sub || /region|code/i.test(sub)) {
                return '10m - 1hr';
              }
              return sub
                .replace(/processing\s+time:?/i, '')
                .replace(/processing/i, '')
                .replace(/few\s+hours/gi, '1hr')
                .replace(/minutes/gi, 'm')
                .replace(/mins/gi, 'm')
                .replace(/hours?/gi, 'hr')
                .replace(/(\d+)\s*m\b/gi, '$1m')
                .replace(/(\d+)\s*hr\b/gi, '$1hr')
                .trim() || '10m - 1hr';
            })()}
          </span>
        </div>

        {/* Absolute badge overlapping the top-right border to keep card heights 100% consistent */}
        {item.badge_text && (
          <div
            className={`
              absolute -top-1.5 right-2 px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-extrabold uppercase tracking-widest border transition-all duration-300 z-20 shadow-md
              ${item.badge_color ? '' : 'border-pink-500 text-pink-500 bg-[#161922] group-hover:bg-pink-500 group-hover:text-white'}
            `}
            style={item.badge_color ? {
              borderColor: item.badge_color,
              color: item.badge_color,
              backgroundColor: '#161922'
            } : undefined}
          >
            {item.badge_text}
          </div>
        )}
      </button>

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
