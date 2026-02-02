import React from 'react';
import { MenuItem, OrderStatus, Member } from '../types';
import { useCategories } from '../hooks/useCategories';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { useOrders } from '../hooks/useOrders';
import MenuItemCard from './MenuItemCard';
import Hero from './Hero';

// Preload images for better performance
const preloadImages = (items: MenuItem[]) => {
  items.forEach(item => {
    if (item.image) {
      const img = new Image();
      img.src = item.image;
    }
  });
};

interface MenuProps {
  menuItems: MenuItem[];
  selectedCategory: string;
  searchQuery?: string;
  currentMember?: Member | null;
}

const Menu: React.FC<MenuProps> = ({ menuItems, selectedCategory, searchQuery = '', currentMember }) => {
  const { categories } = useCategories();
  const { siteSettings } = useSiteSettings();
  const { fetchOrderById } = useOrders();
  const menuItemsSafe = Array.isArray(menuItems) ? menuItems : [];
  const [activeCategory, setActiveCategory] = React.useState(selectedCategory === 'popular' ? 'popular' : 'hot-coffee');
  const [processingOrderId, setProcessingOrderId] = React.useState<string | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = React.useState(false);

  // Track current order status to know when to clear banner
  const [currentOrderStatus, setCurrentOrderStatus] = React.useState<OrderStatus | null>(null);

  // Handle modal close - clear approved/rejected orders from banner and localStorage
  const handleModalClose = React.useCallback(async () => {
    setIsOrderModalOpen(false);
    // If we already know the order is approved or rejected, clear immediately
    if (processingOrderId && (currentOrderStatus === 'approved' || currentOrderStatus === 'rejected')) {
      localStorage.removeItem('current_order_id');
      setProcessingOrderId(null);
      setCurrentOrderStatus(null);
      return;
    }
    
    // Otherwise, check the current order status
    if (processingOrderId) {
      const order = await fetchOrderById(processingOrderId);
      if (order) {
        setCurrentOrderStatus(order.status);
        if (order.status === 'approved' || order.status === 'rejected') {
          localStorage.removeItem('current_order_id');
          setProcessingOrderId(null);
          setCurrentOrderStatus(null);
        }
      }
    }
  }, [processingOrderId, currentOrderStatus, fetchOrderById]);

  // Preload images when menu items change
  React.useEffect(() => {
    if (menuItemsSafe.length > 0) {
      // Preload images for visible category first
      let visibleItems: MenuItem[];
      if (selectedCategory === 'popular') {
        visibleItems = menuItemsSafe.filter(item => Boolean(item.popular) === true);
      } else if (selectedCategory === 'all') {
        visibleItems = menuItemsSafe;
      } else {
        visibleItems = menuItemsSafe.filter(item => item.category === activeCategory);
      }
      preloadImages(visibleItems);
      
      // Then preload other images after a short delay
      setTimeout(() => {
        const otherItems = menuItemsSafe.filter(item => {
          if (selectedCategory === 'popular') {
            return item.popular !== true;
          } else if (selectedCategory === 'all') {
            return false; // Already loaded all
          } else {
            return item.category !== activeCategory;
          }
        });
        preloadImages(otherItems);
      }, 1000);
    }
  }, [menuItemsSafe, activeCategory, selectedCategory]);

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
    const element = document.getElementById(categoryId);
    if (element) {
      const combinedBarHeight = 100; // Header + search + category nav (one sticky bar)
      const offset = combinedBarHeight + 16; // Extra padding
      const elementPosition = element.offsetTop - offset;
      
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      });
    }
  };

  React.useEffect(() => {
    // If selectedCategory is 'popular', set activeCategory to 'popular'
    if (selectedCategory === 'popular') {
      setActiveCategory('popular');
      return;
    }
    
    const list = Array.isArray(categories) ? categories : [];
    if (list.length > 0) {
      // Set default to dim-sum if it exists, otherwise first category
      const defaultCategory = list.find(cat => cat.id === 'dim-sum') || list[0];
      if (defaultCategory && !list.find(cat => cat.id === activeCategory) && selectedCategory !== 'popular') {
        setActiveCategory(defaultCategory.id);
      }
    }
  }, [categories, activeCategory, selectedCategory]);

  // Check for processing order on mount and when component becomes visible
  React.useEffect(() => {
    const checkProcessingOrder = async () => {
      const storedOrderId = localStorage.getItem('current_order_id');
      if (storedOrderId) {
        const order = await fetchOrderById(storedOrderId);
        if (order && (order.status === 'pending' || order.status === 'processing' || order.status === 'approved' || order.status === 'rejected')) {
          // Show banner for all order statuses (pending, processing, approved, rejected)
          // Banner will be cleared when user closes the modal
          setProcessingOrderId(storedOrderId);
          setCurrentOrderStatus(order.status);
          
          // Auto-open modal if order is pending or processing
          if (order.status === 'pending' || order.status === 'processing') {
            setIsOrderModalOpen(true);
          }
        } else {
          // Order not found, clear it
          localStorage.removeItem('current_order_id');
          setProcessingOrderId(null);
          setCurrentOrderStatus(null);
        }
      } else {
        setProcessingOrderId(null);
        setCurrentOrderStatus(null);
      }
    };

    checkProcessingOrder();
    // Poll every 5 seconds to check order status
    const interval = setInterval(checkProcessingOrder, 5000);
    return () => clearInterval(interval);
  }, [fetchOrderById]);

  React.useEffect(() => {
    // Only handle scroll if not showing popular category
    if (selectedCategory === 'popular') {
      return;
    }

    const list = Array.isArray(categories) ? categories : [];
    const handleScroll = () => {
      const sections = list.map(cat => document.getElementById(cat.id)).filter(Boolean);
      const scrollPosition = window.scrollY + 200;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition && list[i]) {
          setActiveCategory(list[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [categories, selectedCategory]);

  // Get hero images for slideshow (only show on "All" category) – must run before any early return (hooks order)
  const heroImages = React.useMemo(() => {
    if (!siteSettings || selectedCategory !== 'all') return [];
    return [
      siteSettings.hero_image_1,
      siteSettings.hero_image_2,
      siteSettings.hero_image_3,
      siteSettings.hero_image_4,
      siteSettings.hero_image_5,
    ].filter((img): img is string => typeof img === 'string' && img.trim() !== '');
  }, [siteSettings, selectedCategory]);

  // Helper function to render menu items
  const renderMenuItems = (items: MenuItem[]) => {
    return items.map((item) => (
      <MenuItemCard key={item.id} item={item} currentMember={currentMember} />
    ));
  };

  // Order Status Banner Component
  const OrderStatusBanner = () => {
    // Don't show banner if order is approved or rejected and user closed the modal
    if (!processingOrderId) return null;
    
    // Determine banner text based on order status
    const [bannerText, setBannerText] = React.useState('Your order is being processed');
    
    React.useEffect(() => {
      if (currentOrderStatus) {
        if (currentOrderStatus === 'approved') {
          setBannerText('Your order has been accepted');
        } else if (currentOrderStatus === 'rejected') {
          setBannerText('Your order was rejected');
        } else {
          setBannerText('Your order is being processed');
        }
      } else {
        // Fallback: fetch if we don't have status yet
        const fetchOrderStatus = async () => {
          if (processingOrderId) {
            const order = await fetchOrderById(processingOrderId);
            if (order) {
              setCurrentOrderStatus(order.status);
              if (order.status === 'approved') {
                setBannerText('Your order has been accepted');
              } else if (order.status === 'rejected') {
                setBannerText('Your order was rejected');
              } else {
                setBannerText('Your order is being processed');
              }
            }
          }
        };
        fetchOrderStatus();
      }
    }, [processingOrderId, currentOrderStatus, fetchOrderById]);
    
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="rounded-xl mb-4 flex items-stretch overflow-hidden">
          {/* Left Section - Information Area */}
          <div className="flex-1 p-3 sm:p-4 flex items-center" style={{ backgroundColor: 'rgba(26, 26, 26, 0.9)' }}>
            <p className="font-semibold text-white text-sm sm:text-base whitespace-nowrap">{bannerText}</p>
          </div>
          {/* Right Section - Action Button */}
          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="px-4 sm:px-6 py-3 sm:py-4 text-white font-semibold hover:opacity-90 transition-all duration-200 flex items-center justify-center whitespace-nowrap"
            style={{ backgroundColor: '#FF69B4' }}
          >
            View
          </button>
        </div>
      </div>
    );
  };

  // If there's a search query, show search results
  if (searchQuery.trim() !== '') {
    if (menuItemsSafe.length === 0) {
      return (
        <>
          <OrderStatusBanner />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
            <section className="mb-6 md:mb-8">
              <div className="flex items-center mb-3 md:mb-4">
                <h3 className="text-3xl font-medium text-white">Search Results</h3>
              </div>
              <p className="text-gray-400">No games found matching "{searchQuery}"</p>
            </section>
          </main>
          <OrderStatusModal
            orderId={processingOrderId}
            isOpen={isOrderModalOpen}
            onClose={handleModalClose}
            onSucceededClose={() => {
              localStorage.removeItem('current_order_id');
              setProcessingOrderId(null);
              setCurrentOrderStatus(null);
              setIsOrderModalOpen(false);
            }}
          />
        </>
      );
    }

    return (
      <>
        <OrderStatusBanner />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <section className="mb-16">
            <div className="flex items-center mb-8">
              <h3 className="text-3xl font-medium text-white">
                Search Results for "{searchQuery}"
              </h3>
              <span className="ml-4 text-sm text-gray-400">({menuItems.length} {menuItems.length === 1 ? 'game' : 'games'})</span>
            </div>
            
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2 md:gap-2.5">
              {renderMenuItems(menuItems)}
            </div>
          </section>
        </main>
        <OrderStatusModal
          orderId={processingOrderId}
          isOpen={isOrderModalOpen}
          onClose={handleModalClose}
          onSucceededClose={() => {
            localStorage.removeItem('current_order_id');
            setProcessingOrderId(null);
            setCurrentOrderStatus(null);
            setIsOrderModalOpen(false);
          }}
        />
      </>
    );
  }

  // If showing popular items, display them in a single section
  // Note: menuItems prop is already filtered by App.tsx when selectedCategory === 'popular'
  if (selectedCategory === 'popular') {
    if (menuItemsSafe.length === 0) {
      return (
        <>
          <OrderStatusBanner />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
            <section id="popular" className="mb-6 md:mb-8">
              <div className="flex items-center mb-3 md:mb-4">
                <h3 className="text-3xl font-medium text-white">Popular</h3>
              </div>
              <p className="text-gray-400">No popular items available at the moment.</p>
            </section>
          </main>
          <OrderStatusModal
            orderId={processingOrderId}
            isOpen={isOrderModalOpen}
            onClose={handleModalClose}
            onSucceededClose={() => {
              localStorage.removeItem('current_order_id');
              setProcessingOrderId(null);
              setCurrentOrderStatus(null);
              setIsOrderModalOpen(false);
            }}
          />
        </>
      );
    }

    return (
      <>
        <OrderStatusBanner />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
          <section id="popular" className="mb-6 md:mb-8">
            <div className="flex items-center mb-3 md:mb-4">
              <h3 className="text-3xl font-medium text-white">Popular</h3>
            </div>
            
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2 md:gap-2.5">
              {renderMenuItems(menuItems)}
            </div>
          </section>
        </main>
        <OrderStatusModal
          orderId={processingOrderId}
          isOpen={isOrderModalOpen}
          onClose={handleModalClose}
          onSucceededClose={() => {
            localStorage.removeItem('current_order_id');
            setProcessingOrderId(null);
            setCurrentOrderStatus(null);
            setIsOrderModalOpen(false);
          }}
        />
      </>
    );
  }

  // Otherwise, display items grouped by category
  // If viewing "All", also show Popular section at the top (only when not searching)
  const popularItems = menuItemsSafe.filter(item => Boolean(item?.popular) === true);
  const showPopularSection = selectedCategory === 'all' && popularItems.length > 0 && searchQuery.trim() === '';

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 md:pt-5 pb-4 md:pb-6">
        {/* Welcome message for logged-in members */}
        {/* Welcome back card - Mobile only */}
        {currentMember && (
          <div className="mb-4 md:hidden flex justify-center">
            <div className="glass-card rounded-lg px-3 py-2 inline-block">
              <div className="flex items-center justify-center">
                <p className="text-sm text-cafe-text">
                  <span className="text-cafe-textMuted">Welcome back,</span> <span className="font-semibold ml-2">{currentMember.username}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Hero Slideshow - Only show on "All" category */}
        {selectedCategory === 'all' && heroImages.length > 0 && (
          <Hero images={heroImages} />
        )}
        
        {/* Show Popular section when viewing "All" */}
        {showPopularSection && (
          <section id="popular" className="mb-8 md:mb-12">
            <div className="flex items-center mb-3 md:mb-4">
              <h3 className="text-3xl font-medium text-white">Popular</h3>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-3">
              {renderMenuItems(popularItems)}
            </div>
          </section>
        )}

        {/* Regular category sections */}
        {(Array.isArray(categories) ? categories : []).map((category) => {
          const categoryItems = menuItemsSafe.filter(item => item.category === category.id);
          
          if (categoryItems.length === 0) return null;
          
          return (
            <section key={category.id} id={category.id} className="mb-8 md:mb-12">
            <div className="flex items-center mb-3 md:mb-4">
              <h3 className="text-3xl font-medium text-white">{category.name}</h3>
            </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-3">
                {renderMenuItems(categoryItems)}
              </div>
            </section>
          );
        })}
      </main>

      {/* Order Status Modal */}
      <OrderStatusModal
        orderId={processingOrderId}
        isOpen={isOrderModalOpen}
        onClose={handleModalClose}
        onSucceededClose={() => {
          localStorage.removeItem('current_order_id');
          setProcessingOrderId(null);
          setCurrentOrderStatus(null);
          setIsOrderModalOpen(false);
        }}
      />
    </>
  );
};

export default Menu;