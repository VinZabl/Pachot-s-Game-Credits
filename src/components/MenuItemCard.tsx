import React, { useState } from 'react';
import { MenuItem } from '../types';
import GameItemOrderModal from './GameItemOrderModal';

interface MenuItemCardProps {
  item: MenuItem;
  quantity?: number;
  currentMember?: import('../types').Member | null;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, currentMember }) => {
  const [showOrderModal, setShowOrderModal] = useState(false);

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
          relative w-full text-left rounded-xl px-4 py-4
          flex items-center gap-3
          transition-all duration-200
          border border-transparent
          ${!item.available
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:border-pink-500/50 hover:scale-[1.01] active:scale-[0.99]'
          }
        `}
        style={{
          background: 'rgba(30, 30, 36, 0.85)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {/* Badge */}
        {item.badge_text && (
          <div
            className="absolute top-0 left-0 z-20 px-2 py-0.5 rounded-tl-xl rounded-br-xl shadow-sm"
            style={{ backgroundColor: item.badge_color || '#EC4899', color: 'white' }}
          >
            <span className="text-[8px] font-bold uppercase tracking-wider">{item.badge_text}</span>
          </div>
        )}

        {/* Closed overlay */}
        {!item.available && (
          <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center z-10">
            <span className="text-white font-semibold text-xs bg-black/60 px-2 py-0.5 rounded">Closed</span>
          </div>
        )}


        <span
          className={`flex-1 font-semibold text-white uppercase tracking-wide leading-tight line-clamp-2 ${
            item.badge_text ? 'pl-9' : ''
          } ${
            item.name.length > 20
              ? 'text-[10px]'
              : item.name.length > 12
              ? 'text-xs'
              : 'text-sm'
          }`}
        >
          {item.name}
        </span>
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
