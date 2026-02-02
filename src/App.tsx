import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import SubNav from './components/SubNav';
import Menu from './components/Menu';
import FloatingSupportButton from './components/FloatingSupportButton';
import AdminDashboard from './components/AdminDashboard';
import MemberLogin from './components/MemberLogin';
import WelcomeModal from './components/WelcomeModal';
import MemberProfile from './components/MemberProfile';
import OrderStatusModal from './components/OrderStatusModal';
import { useMenu } from './hooks/useMenu';
import { useMemberAuth } from './hooks/useMemberAuth';
import { useOrders } from './hooks/useOrders';
import Footer from './components/Footer';

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

  // Restore scroll position when view changes
  React.useEffect(() => {
    const restoreScroll = () => {
      if (currentView === 'menu') {
        const savedScroll = localStorage.getItem('amber_menuScrollPos');
        if (savedScroll) {
          setTimeout(() => {
            window.scrollTo({ top: parseInt(savedScroll), behavior: 'auto' });
          }, 100);
        }
      } else if (currentView === 'cart') {
        const savedScroll = localStorage.getItem('amber_cartScrollPos');
        if (savedScroll) {
          setTimeout(() => {
            window.scrollTo({ top: parseInt(savedScroll), behavior: 'auto' });
          }, 100);
        }
      }
    };

    // Only restore scroll if not coming from item added (which should scroll to top)
    const skipRestore = localStorage.getItem('amber_skipScrollRestore');
    if (!skipRestore) {
      restoreScroll();
    } else {
      localStorage.removeItem('amber_skipScrollRestore');
    }
  }, [currentView]);

  // Save scroll position periodically while on a page
  React.useEffect(() => {
    const handleScroll = () => {
      if (currentView === 'menu') {
        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        localStorage.setItem('amber_menuScrollPos', scrollPosition.toString());
      } else if (currentView === 'cart') {
        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        localStorage.setItem('amber_cartScrollPos', scrollPosition.toString());
      }
    };

    // Throttle scroll events
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });
    
    // Also save on page unload/refresh
    window.addEventListener('beforeunload', handleScroll);

    return () => {
      window.removeEventListener('scroll', throttledScroll);
      window.removeEventListener('beforeunload', handleScroll);
    };
  }, [currentView]);

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

  // Show welcome modal when member logs in
  React.useEffect(() => {
    if (currentMember && justLoggedIn) {
      setShowWelcomeModal(true);
      setJustLoggedIn(false);
    }
  }, [currentMember, justLoggedIn]);

  // Redirect from login view if member is already logged in
  React.useEffect(() => {
    // Wait for auth to finish loading before checking
    if (!authLoading && currentMember && currentView === 'member-login') {
      setCurrentView('menu');
      setJustLoggedIn(true);
    }
  }, [currentMember, currentView, authLoading]);

  // Check for pending order with "place_order" option when app loads
  React.useEffect(() => {
    const checkPendingOrder = async () => {
      // Wait for auth to finish loading
      if (authLoading) return;

      // Check localStorage for pending order ID
      const storedOrderId = localStorage.getItem('pendingPlaceOrderId');
      if (!storedOrderId) return;

      try {
        // Fetch the order to check its status
        const order = await fetchOrderById(storedOrderId);
        
        if (order && order.order_option === 'place_order') {
          // Only show modal if order is still pending or processing
          if (order.status === 'pending' || order.status === 'processing') {
            setPendingOrderId(storedOrderId);
            setShowOrderStatusModal(true);
          } else {
            // Order is completed (approved/rejected), clear localStorage
            localStorage.removeItem('pendingPlaceOrderId');
          }
        } else {
          // Order doesn't exist or is not place_order option, clear localStorage
          localStorage.removeItem('pendingPlaceOrderId');
        }
      } catch (error) {
        console.error('Error checking pending order:', error);
        // Clear localStorage on error
        localStorage.removeItem('pendingPlaceOrderId');
      }
    };

    checkPendingOrder();
  }, [authLoading, fetchOrderById]);


  const handleMemberClick = () => {
    if (currentMember) {
      // If already logged in, show member profile
      setShowMemberProfile(true);
    } else {
      setCurrentView('member-login');
    }
  };

  const handleGetStarted = () => {
    // Show profile after Get Started is clicked
    setShowMemberProfile(true);
  };

  const handleLogout = () => {
    logout();
    setShowMemberProfile(false);
    setShowWelcomeModal(false);
  };

  const handleLoginSuccess = () => {
    // Force view change immediately
    setCurrentView('menu');
    // Set justLoggedIn to trigger welcome modal
    setJustLoggedIn(true);
  };

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
      
      {showWelcomeModal && currentMember && (
        <WelcomeModal 
          username={currentMember.username}
          onClose={() => setShowWelcomeModal(false)}
          onGetStarted={handleGetStarted}
        />
      )}
      {showMemberProfile && currentMember && (
        <MemberProfile
          onClose={() => setShowMemberProfile(false)}
          onLogout={handleLogout}
        />
      )}

      {/* Order Status Modal for pending "place_order" orders */}
      <OrderStatusModal
        orderId={pendingOrderId}
        isOpen={showOrderStatusModal}
        onClose={() => {
          setShowOrderStatusModal(false);
          // Don't clear localStorage here - let it clear when order is completed
        }}
        onSucceededClose={() => {
          // Order is approved/rejected, clear localStorage and close modal
          localStorage.removeItem('pendingPlaceOrderId');
          setShowOrderStatusModal(false);
          setPendingOrderId(null);
        }}
      />
      
      {currentView !== 'member-login' && (
        <>
          <FloatingSupportButton />
          <Footer />
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/member/login" element={<MainApp />} />
      </Routes>
    </Router>
  );
}

export default App;