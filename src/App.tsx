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
  const { currentMember, logout, loading: authLoading } = useMemberAuth();
  const { menuItems } = useMenu();
  const { fetchOrderById } = useOrders();

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

  const [showWelcomeModal, setShowWelcomeModal] = React.useState(false);
  const [showMemberProfile, setShowMemberProfile] = React.useState(false);
  const [justLoggedIn, setJustLoggedIn] = React.useState(false);
  const [pendingOrderId, setPendingOrderId] = React.useState<string | null>(null);
  const [showOrderStatusModal, setShowOrderStatusModal] = React.useState(false);

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

  // Show welcome modal when member logs in
  React.useEffect(() => {
    if (currentMember && justLoggedIn) {
      setShowWelcomeModal(true);
      setJustLoggedIn(false);
    }
  }, [currentMember, justLoggedIn]);

  // Check for pending order when app loads
  React.useEffect(() => {
    const checkPendingOrder = async () => {
      if (authLoading) return;
      const storedOrderId = localStorage.getItem('current_order_id');
      if (!storedOrderId) return;
      try {
        const order = await fetchOrderById(storedOrderId);
        if (order && (order.status === 'pending' || order.status === 'processing')) {
          setPendingOrderId(storedOrderId);
          setShowOrderStatusModal(true);
        }
      } catch {
        // ignore
      }
    };
    checkPendingOrder();
  }, [authLoading, fetchOrderById]);

  const handleMemberClick = () => {
    if (currentMember) {
      setShowMemberProfile(true);
    } else {
      window.location.href = '/member/login';
    }
  };

  const handleGetStarted = () => {
    setShowMemberProfile(true);
  };

  const handleLogout = () => {
    logout();
    setShowMemberProfile(false);
    setShowWelcomeModal(false);
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSearchQuery('');
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim() !== '') {
      setSelectedCategory('all');
    }
  };

  const hasPopularItems = React.useMemo(() => {
    return menuItems.some(item => Boolean(item.popular) === true);
  }, [menuItems]);

  React.useEffect(() => {
    if (selectedCategory === 'popular' && !hasPopularItems && menuItems.length > 0) {
      setSelectedCategory('all');
    }
  }, [hasPopularItems, selectedCategory, menuItems.length]);

  const filteredMenuItems = React.useMemo(() => {
    let filtered = menuItems;
    if (selectedCategory === 'popular') {
      filtered = filtered.filter(item => Boolean(item.popular) === true);
    } else if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => item.name.toLowerCase().includes(query));
    }
    return filtered;
  }, [menuItems, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#0d0d0d' }}>
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

      <Header onMenuClick={() => {}} onMemberClick={handleMemberClick} currentMember={currentMember} />
      <SubNav
        selectedCategory={selectedCategory}
        onCategoryClick={handleCategoryClick}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        hasPopularItems={hasPopularItems}
        currentMember={currentMember}
      />

      <Menu
        menuItems={filteredMenuItems}
        selectedCategory={selectedCategory}
        searchQuery={searchQuery}
        currentMember={currentMember}
      />

      {showWelcomeModal && currentMember && (
        <WelcomeModal
          username={currentMember.username}
          onClose={() => setShowWelcomeModal(false)}
          onGetStarted={handleGetStarted}
        />
      )}
      {showMemberProfile && currentMember && (
        <MemberProfile onClose={() => setShowMemberProfile(false)} onLogout={handleLogout} />
      )}

      <OrderStatusModal
        orderId={pendingOrderId}
        isOpen={showOrderStatusModal}
        onClose={() => setShowOrderStatusModal(false)}
        onSucceededClose={() => {
          localStorage.removeItem('current_order_id');
          setShowOrderStatusModal(false);
          setPendingOrderId(null);
        }}
      />

      <FloatingSupportButton />
      <Footer />
    </div>
  );
}

function MemberLoginPage() {
  return (
    <MemberLogin
      onBack={() => (window.location.href = '/')}
      onLoginSuccess={() => {
        window.location.href = '/';
      }}
    />
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/member/login" element={<MemberLoginPage />} />
      </Routes>
    </Router>
  );
}

export default App;
