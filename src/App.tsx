import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import SubNav from './components/SubNav';
import Menu from './components/Menu';
import FloatingSupportButton from './components/FloatingSupportButton';
import Footer from './components/Footer';
import AdminDashboard from './components/AdminDashboard';
import { useMenu } from './hooks/useMenu';

const APP_STATE_STORAGE_KEY = 'pachot_app_state';

function MainApp() {
  const { menuItems } = useMenu();
  
  const [selectedCategory, setSelectedCategory] = React.useState<string>(() => {
    try {
      const stored = localStorage.getItem(APP_STATE_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        return state.selectedCategory || 'all';
      }
    } catch (error) {
      console.error('Error loading app state from localStorage:', error);
    }
    return 'all';
  });
  
  const [searchQuery, setSearchQuery] = React.useState<string>(() => {
    try {
      const stored = localStorage.getItem(APP_STATE_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        return state.searchQuery || '';
      }
    } catch (error) {
      console.error('Error loading app state from localStorage:', error);
    }
    return '';
  });

  // Persist app state to localStorage whenever it changes
  React.useEffect(() => {
    try {
      localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify({
        selectedCategory,
        searchQuery
      }));
    } catch (error) {
      console.error('Error saving app state to localStorage:', error);
    }
  }, [selectedCategory, searchQuery]);

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    // Clear search when changing category
    setSearchQuery('');
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    // If searching, set category to 'all' to show all results
    if (query.trim() !== '') {
      setSelectedCategory('all');
    }
  };

  // Check if there are any popular items
  const hasPopularItems = React.useMemo(() => {
    return menuItems.some(item => Boolean(item.popular) === true);
  }, [menuItems]);

  // If user is on popular category but there are no popular items, redirect to 'all'
  React.useEffect(() => {
    if (selectedCategory === 'popular' && !hasPopularItems && menuItems.length > 0) {
      setSelectedCategory('all');
    }
  }, [hasPopularItems, selectedCategory, menuItems.length]);

  // Filter menu items based on selected category and search query
  const filteredMenuItems = React.useMemo(() => {
    let filtered = menuItems;

    // First filter by category
    if (selectedCategory === 'popular') {
      filtered = filtered.filter(item => Boolean(item.popular) === true);
    } else if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Then filter by search query if present
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [menuItems, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#0d0d0d' }}>
      {/* Background logo with 10% opacity - appears on all customer pages */}
      <div 
        className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
        style={{
          backgroundImage: 'url(/logo.png)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          opacity: 0.1
        }}
      />
      
      <Header onMenuClick={() => {}} />
      <SubNav 
          selectedCategory={selectedCategory} 
          onCategoryClick={handleCategoryClick}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          hasPopularItems={hasPopularItems}
        />
      
      <Menu 
        menuItems={filteredMenuItems}
        selectedCategory={selectedCategory}
        searchQuery={searchQuery}
      />
      
      <FloatingSupportButton />
      <Footer />
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;