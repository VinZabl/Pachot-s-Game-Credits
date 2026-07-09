import React from 'react';
import { Search, X } from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { Member } from '../types';

interface SubNavProps {
  selectedCategory: string;
  onCategoryClick: (categoryId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  hasPopularItems: boolean;
  currentMember?: Member | null;
}

const SubNav: React.FC<SubNavProps> = ({ selectedCategory, onCategoryClick, searchQuery, onSearchChange, hasPopularItems }) => {
  const { categories, loading } = useCategories();
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);

  return (
    <div className="w-full" style={{ background: 'transparent' }}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 pb-3">

        {/* Search Bar — full width, transparent, bottom border only */}
        <div className="relative mb-5">
          <Search
            className={`absolute left-1 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200 ${
              isSearchFocused || searchQuery ? 'text-white' : 'text-gray-500'
            }`}
          />
          <input
            type="text"
            placeholder="Search game...."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="w-full pl-8 pr-10 py-3 text-base text-white placeholder-gray-500 bg-transparent border-b border-gray-700/60 transition-all duration-200 focus:outline-none focus:border-pink-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Pills wrapped in a border-enclosed row */}
        <div className="border border-gray-800/80 rounded-xl p-2 bg-[#0e1017]/60 flex items-center gap-2 overflow-x-auto scrollbar-hide flex-nowrap">
          {loading ? (
            <div className="flex space-x-2 flex-nowrap w-full">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-9 w-20 rounded-lg bg-white/5 animate-pulse flex-shrink-0" />
              ))}
            </div>
          ) : (
            <>
              <button
                onClick={() => onCategoryClick('all')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap border ${
                  selectedCategory === 'all'
                    ? 'text-pink-500 border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.15)] bg-transparent'
                    : 'text-gray-400 border-gray-800/80 hover:text-white hover:border-gray-700 bg-transparent'
                }`}
              >
                All games
              </button>

              {hasPopularItems && (
                <button
                  onClick={() => onCategoryClick('popular')}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap border ${
                    selectedCategory === 'popular'
                      ? 'text-pink-500 border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.15)] bg-transparent'
                      : 'text-gray-400 border-gray-800/80 hover:text-white hover:border-gray-700 bg-transparent'
                  }`}
                >
                  Popular
                </button>
              )}

              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onCategoryClick(c.id)}
                  title={c.name}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap border ${
                    selectedCategory === c.id
                      ? 'text-pink-500 border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.15)] bg-transparent'
                      : 'text-gray-400 border-gray-800/80 hover:text-white hover:border-gray-700 bg-transparent'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubNav;
