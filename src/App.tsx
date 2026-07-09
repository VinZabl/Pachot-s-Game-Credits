import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import SubNav from './components/SubNav';
import Menu from './components/Menu';
import FloatingSupportButton from './components/FloatingSupportButton';
import AdminDashboard from './components/AdminDashboard';
import MemberLogin from './components/MemberLogin';
import WelcomeModal from './components/WelcomeModal';
import MemberProfile from './components/MemberProfile';
import OrderStatusModal from './components/OrderStatusModal';
import OrderInstructionsModal from './components/OrderInstructionsModal';
import { OrderStatusProvider, useOrderStatus } from './contexts/OrderStatusContext';
import { MemberAuthProvider } from './contexts/MemberAuthContext';
import { useMenu } from './hooks/useMenu';
import { useMemberAuth } from './hooks/useMemberAuth';
import { useOrders } from './hooks/useOrders';
import { useSiteSettings } from './hooks/useSiteSettings';
import Footer from './components/Footer';

const APP_STATE_STORAGE_KEY = 'pachot_app_state';

function MainApp() {
  const { currentMember, logout, loading: authLoading } = useMemberAuth();
  const { menuItems } = useMenu();
  const { fetchOrderById } = useOrders();
  const { siteSettings } = useSiteSettings();
  const navigate = useNavigate();
  const location = useLocation();
  // Check if we're on localhost to allow development even when store is closed in production
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const storeClosed = siteSettings?.store_closed === true && !isLocalhost;
  const navState = location.state as { justLoggedIn?: boolean } | null;

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
  const [showOrderInstructions, setShowOrderInstructions] = React.useState(true);
  const [justLoggedIn, setJustLoggedIn] = React.useState(false);
  const { orderId: pendingOrderId, showOrderStatusModal, clearOrderStatus, closeOrderStatusModal, openOrderStatusModal } = useOrderStatus();

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

  // Show welcome modal only once when member logs in (from login/register redirect)
  React.useEffect(() => {
    if (currentMember && (justLoggedIn || navState?.justLoggedIn)) {
      setShowWelcomeModal(true);
      setJustLoggedIn(false);
      // Clear nav state so we don't show again when returning to tab or using back button
      if (navState?.justLoggedIn) {
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [currentMember, justLoggedIn, navState?.justLoggedIn, navigate, location.pathname]);

  // Check for order in localStorage when app loads (for banner + auto-open modal for pending/processing)
  React.useEffect(() => {
    const checkPendingOrder = async () => {
      if (authLoading) return;
      const storedOrderId = localStorage.getItem('current_order_id');
      if (!storedOrderId) return;
      try {
        const order = await fetchOrderById(storedOrderId);
        if (order && (order.status === 'pending' || order.status === 'processing' || order.status === 'approved' || order.status === 'rejected')) {
          const autoShow = order.status === 'pending' || order.status === 'processing';
          openOrderStatusModal(storedOrderId, autoShow);
        } else if (!order) {
          // Order not found (deleted or invalid) - clear stale ID to stop retries
          clearOrderStatus();
        }
      } catch {
        // ignore
      }
    };
    checkPendingOrder();
  }, [authLoading, fetchOrderById, openOrderStatusModal, clearOrderStatus]);

  const handleMemberClick = () => {
    if (currentMember) {
      setShowMemberProfile(true);
    } else {
      navigate('/member/login');
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

  const handleOrderInstructionsClose = () => setShowOrderInstructions(false);

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

  // Store closed: show a single message, no menu or ordering
  if (storeClosed) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center p-4 sm:p-6" style={{ backgroundColor: '#0d0d0d' }}>
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
          style={{
            backgroundImage: 'url(/logo.png)',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: 0.05
          }}
        />

        <div
          className="relative z-10 w-full max-w-md rounded-[32px] p-6 sm:p-8 flex flex-col items-center justify-center space-y-6 shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, #161922 0%, #0d0d0d 100%)',
            border: '1px solid rgba(255, 105, 180, 0.15)',
          }}
        >
          {/* Logo */}
          <img src="/logo.png" alt="PGCShop Logo" className="h-14 sm:h-16 w-auto object-contain" />

          {/* Closed Status Container */}
          <div className="border border-gray-800/80 px-5 py-3 rounded-xl bg-black/25 text-center w-full max-w-[320px]">
            <p className="text-sm sm:text-base font-semibold text-gray-400">
              Manual Top-Up is currently <span className="text-pink-500 font-extrabold uppercase">CLOSED!</span>
            </p>
          </div>

          {/* Time schedule */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="bg-[#161922]/50 border border-gray-800/50 rounded-full px-4 py-1.5 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_6px_#ff007f]"></span>
              <span className="text-xs sm:text-sm font-extrabold text-gray-300">
                8:00 AM - 10:00 PM Only
              </span>
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-gray-500">
              Open Daily Monday - Sunday
            </span>
          </div>

          {/* Divider */}
          <div className="w-full border-t border-gray-900/60 my-2"></div>

          {/* Want to Top Up Now Section */}
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              Want to Top Up Now?
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-gray-500">
              Visit our official website
            </p>
          </div>

          {/* Gradient Banner Link */}
          <a
            href="https://www.pgcshop.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-2xl p-4 flex items-center justify-between transition-all duration-300 hover:scale-[1.02] shadow-[0_0_15px_rgba(255,0,127,0.15)] group"
            style={{
              background: 'linear-gradient(90deg, #8b008b 0%, #ff007f 50%, #8b008b 100%)'
            }}
          >
            <span className="text-white text-lg sm:text-xl font-black tracking-wider uppercase">
              PGCSHOP.COM
            </span>
            <div className="bg-[#0d0d0d]/80 px-3 py-1.5 rounded-xl border border-[#ff007f]/30 flex items-center gap-1.5 group-hover:border-[#ff007f]/50 transition-colors">
              <span className="w-2 h-2 rounded-full bg-[#ff007f] animate-ping absolute"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff007f] relative"></span>
              <span className="text-[10px] sm:text-xs font-black uppercase text-[#ff007f] tracking-widest ml-1">
                OPEN 24/7
              </span>
            </div>
          </a>
          
          <Footer compact={true} />
        </div>
      </div>
    );
  }

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

      {showOrderInstructions && (
        <OrderInstructionsModal onClose={handleOrderInstructionsClose} />
      )}
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
        onClose={closeOrderStatusModal}
        onSucceededClose={clearOrderStatus}
      />

      <FloatingSupportButton />
      <Footer />
    </div>
  );
}

function MemberLoginPage() {
  const navigate = useNavigate();
  return (
    <MemberLogin
      onBack={() => navigate('/')}
      onLoginSuccess={() => navigate('/', { state: { justLoggedIn: true } })}
    />
  );
}

function App() {
  return (
    <Router>
      <MemberAuthProvider>
        <OrderStatusProvider>
          <Routes>
            <Route path="/" element={<MainApp />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/member/login" element={<MemberLoginPage />} />
          </Routes>
        </OrderStatusProvider>
      </MemberAuthProvider>
    </Router>
  );
}

export default App;
