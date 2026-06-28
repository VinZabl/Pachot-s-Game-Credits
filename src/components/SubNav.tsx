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

        {/* Search Bar — full width, styled like the reference image */}
        <div className="relative mb-3">
          <Search
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${
              isSearchFocused || searchQuery ? 'text-white' : 'text-gray-400'
            }`}
          />
          <input
            type="text"
            placeholder="Search game..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-white placeholder-gray-400 border transition-all duration-200 focus:outline-none"
            style={{
              background: isSearchFocused || searchQuery
                ? 'rgba(45, 45, 55, 0.95)'
                : 'rgba(30, 30, 38, 0.85)',
              borderColor: isSearchFocused || searchQuery
                ? 'rgba(255, 105, 180, 0.5)'
                : 'rgba(255, 255, 255, 0.08)',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-nowrap">
          {loading ? (
            <div className="flex space-x-2 flex-nowrap">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-7 w-16 rounded-full bg-white/5 animate-pulse flex-shrink-0" />
              ))}
            </div>
          ) : (
            <>
              <button
                onClick={() => onCategoryClick('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                style={
                  selectedCategory === 'all'
                    ? { backgroundColor: '#FF69B4', boxShadow: '0 0 12px rgba(255,105,180,0.4)' }
                    : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }
                }
              >
                All
              </button>

              {hasPopularItems && (
                <button
                  onClick={() => onCategoryClick('popular')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
                    selectedCategory === 'popular'
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  style={
                    selectedCategory === 'popular'
                      ? { backgroundColor: '#FF69B4', boxShadow: '0 0 12px rgba(255,105,180,0.4)' }
                      : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }
                  }
                >
                  Popular
                </button>
              )}

              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onCategoryClick(c.id)}
                  title={c.name}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex-shrink-0 whitespace-nowrap max-w-[7rem] truncate ${
                    selectedCategory === c.id
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  style={
                    selectedCategory === c.id
                      ? { backgroundColor: '#FF69B4', boxShadow: '0 0 12px rgba(255,105,180,0.4)' }
                      : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }
                  }
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
