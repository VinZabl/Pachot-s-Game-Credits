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
      <div
        onClick={handleCardClick}
        className={`flex flex-col ${!item.available ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {/* Game tile - image only (square, white card) */}
        <div className="relative rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300">
          {/* Closed overlay for unavailable items */}
          {!item.available && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg z-10">
              <span className="text-white font-semibold text-sm">Closed</span>
            </div>
          )}

          {/* Badge Overlay */}
          {item.badge_text && (
            <div 
              className="absolute top-0 left-0 z-20 px-1.5 py-0.5 rounded-br-lg shadow-sm"
              style={{ backgroundColor: item.badge_color || '#EC4899', color: 'white' }}
            >
              <span className="text-[8px] font-bold uppercase tracking-wider">{item.badge_text}</span>
            </div>
          )}

          <div className="relative w-full aspect-square overflow-hidden rounded-lg bg-gray-100">
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
              <div className="text-2xl opacity-30 text-gray-400">🎮</div>
            </div>
          </div>
        </div>

        {/* Game title - on transparent (like section headers), below the tile */}
        <div className="bg-transparent px-1 py-1.5 flex items-center justify-center min-h-[2.5rem]">
          <h4
            className="text-white text-xs font-medium text-center line-clamp-2 leading-tight"
            title={item.name}
          >
            {item.name}
          </h4>
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
