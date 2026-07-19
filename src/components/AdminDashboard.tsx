import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Edit, Trash2, Save, X, ArrowLeft, TrendingUp, Package, Users, Lock, FolderOpen, CreditCard, Settings, ArrowUpDown, ChevronDown, ChevronUp, ShoppingBag, CheckCircle, Star, Activity, FilePlus, List, FolderTree, Wallet, Cog, Trophy, DollarSign, Clock, Gamepad2, Copy, GripVertical } from 'lucide-react';
import { MenuItem, Variation, CustomField } from '../types';
import { useMenu } from '../hooks/useMenu';
import { useCategories } from '../hooks/useCategories';
import ImageUpload from './ImageUpload';
import CategoryManager from './CategoryManager';
import PaymentMethodManager from './PaymentMethodManager';
import SiteSettingsManager from './SiteSettingsManager';
import OrderManager from './OrderManager';
import MemberManager from './MemberManager';
import { supabase } from '../lib/supabase';
import { useSiteSettings } from '../hooks/useSiteSettings';

const AdminDashboard: React.FC = () => {
  const { siteSettings, updateSiteSetting, refetch: refetchSiteSettings } = useSiteSettings();
  const orderOption = siteSettings?.order_option || 'place_order';
  const storeClosed = siteSettings?.store_closed === true;

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('beracah_admin_auth') === 'true';
  });
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [adminPassword, setAdminPassword] = useState<string>('Diginix@Admin!2025'); // Default fallback
  const { menuItems, loading, addMenuItem, updateMenuItem, updateSortOrderOnly, reorderCategoryItemsLocally, deleteMenuItem, duplicateMenuItem } = useMenu();
  const { categories } = useCategories();
  type AdminView = 'dashboard' | 'items' | 'add' | 'edit' | 'categories' | 'payments' | 'settings' | 'orders' | 'members';
  const [currentView, setCurrentViewState] = useState<AdminView>(() => {
    const saved = localStorage.getItem('beracah_admin_currentView');
    if (saved && saved !== 'add' && saved !== 'edit') return saved as AdminView;
    return 'dashboard';
  });
  const setCurrentView = (view: AdminView) => {
    setCurrentViewState(view);
    if (view !== 'add' && view !== 'edit') {
      localStorage.setItem('beracah_admin_currentView', view);
    }
  };
  const [pendingOrders, setPendingOrders] = useState<number>(0);
  const [lastSeenPendingCount, setLastSeenPendingCount] = useState<number>(0);
  const [ordersTabFilter, setOrdersTabFilter] = useState<'place_order' | 'order_via_messenger'>('place_order');
  const notificationVolumeRef = useRef<number>(0.5);

  // When user opens Orders view, mark current pending count as "seen" so badge clears until new orders arrive
  useEffect(() => {
    if (currentView === 'orders') setLastSeenPendingCount(pendingOrders);
  }, [currentView, pendingOrders]);

  // Fetch admin password from database on mount
  useEffect(() => {
    const fetchAdminPassword = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'admin_password')
          .single();

        if (!error && data?.value) {
          setAdminPassword(data.value);
        }
      } catch (err) {
        console.error('Error fetching admin password:', err);
        // Keep default password on error
      }
    };

    fetchAdminPassword();
  }, []);

  // Fetch notification volume for new-order sound (used when order_option is place_order)
  useEffect(() => {
    const fetchVolume = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'notification_volume')
          .single();
        if (!error && data?.value) {
          const v = parseFloat(data.value);
          if (!isNaN(v) && v >= 0 && v <= 1) {
            notificationVolumeRef.current = v > 0 ? v : 0.7;
            console.log('[Notification] Volume loaded:', notificationVolumeRef.current, v === 0 ? '(was 0, using 0.7)' : '');
          }
        } else {
          console.log('[Notification] Volume: using default 0.5 (fetch failed or no setting)');
        }
      } catch (err) {
        console.error('[Notification] Error fetching volume:', err);
      }
    };
    fetchVolume();
  }, []);

  // Pending orders count: initial fetch + Supabase Realtime + polling fallback
  // Play notification sound when a new pending order arrives
  const audioUnlockedRef = useRef(false);

  // Play notification sound - try even if not unlocked (browser will block but we log it)
  const playNotificationSound = useCallback(() => {
    console.log('🔊 [Sound] Attempting to play, unlocked:', audioUnlockedRef.current);
    try {
      const vol = notificationVolumeRef.current;
      const audio = new Audio('/notifSound.mp3');
      audio.volume = vol > 0 ? vol : 0.7;
      audio.play()
        .then(() => {
          audioUnlockedRef.current = true; // Mark as unlocked if it worked
          console.log('🔊 [Sound] Played successfully!');
        })
        .catch((err) => console.warn('🔊 [Sound] Play blocked:', err.message));
    } catch (err) {
      console.error('🔊 [Sound] Error:', err);
    }
  }, []);

  // Unlock audio on first user click
  const handleFirstInteraction = useCallback(() => {
    if (audioUnlockedRef.current) return;
    console.log('🔊 [Sound] First click - unlocking...');
    try {
      const audio = new Audio('/notifSound.mp3');
      audio.volume = 0.3;
      audio.play().then(() => {
        audioUnlockedRef.current = true;
        console.log('🔊 [Sound] UNLOCKED!');
      }).catch((err) => {
        console.warn('🔊 [Sound] Unlock blocked:', err.message);
      });
    } catch (err) {
      console.error('🔊 [Sound] Unlock error:', err);
    }
  }, []);

  // Test button
  const playTestNotificationSound = useCallback(() => {
    console.log('🔊 [Sound] Test button');
    playNotificationSound();
  }, [playNotificationSound]);

  // Track previous count to detect new orders via polling
  const prevPendingCountRef = useRef<number>(-1);

  useEffect(() => {
    console.log('🔔 [Orders] Setting up real-time subscription...');
    
    const isPlaceOrderPending = (row: { status?: string; order_option?: string | null }) =>
      row.status === 'pending' && (row.order_option ?? 'place_order') === 'place_order';

    const playNewOrderSound = () => {
      console.log('🔔 [Orders] NEW ORDER - playing sound!');
      playNotificationSound();
    };

    const fetchPendingCount = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, order_option')
          .eq('status', 'pending');

        if (error) throw error;
        const count = (data ?? []).filter((o) => (o.order_option ?? 'place_order') === 'place_order').length;
        
        // Play sound if count increased (new order detected via polling)
        if (prevPendingCountRef.current >= 0 && count > prevPendingCountRef.current) {
          console.log('🔔 [Orders] Polling detected NEW order! Previous:', prevPendingCountRef.current, 'Now:', count);
          playNewOrderSound();
        }
        prevPendingCountRef.current = count;
        setPendingOrders(count);
      } catch (err) {
        console.error('Error fetching pending orders count:', err);
      }
    };

    fetchPendingCount();

    // Polling fallback: refresh count every 5s to catch new orders reliably
    const POLL_MS = 5000;
    const pollInterval = setInterval(fetchPendingCount, POLL_MS);
    console.log('🔔 [Orders] Polling every', POLL_MS / 1000, 'seconds');

    let reconnectTimeout: ReturnType<typeof setTimeout>;
    const channelRef = { current: null as ReturnType<typeof supabase.channel> | null };
    const setupRealtime = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      const ch = supabase
        .channel(`admin-pending-orders-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload) => {
            console.log('🔔 [Orders] Real-time event:', payload.eventType, payload.new);
            if (payload.eventType === 'INSERT') {
              const row = payload.new as { status?: string; order_option?: string | null };
              console.log('🔔 [Orders] INSERT - status:', row.status, 'option:', row.order_option);
              if (isPlaceOrderPending(row)) {
                console.log('🔔 [Orders] ✅ Pending order! Incrementing count and playing sound...');
                setPendingOrders((n) => n + 1);
                playNewOrderSound();
              } else {
                console.log('🔔 [Orders] ⏭️ Skipped - not a pending place_order');
              }
            } else if (payload.eventType === 'UPDATE') {
              const oldRow = payload.old as { status?: string; order_option?: string | null };
              const newRow = payload.new as { status?: string; order_option?: string | null };
              const wasPending = isPlaceOrderPending(oldRow);
              const isPending = isPlaceOrderPending(newRow);
              if (wasPending && !isPending) setPendingOrders((n) => Math.max(0, n - 1));
              else if (!wasPending && isPending) setPendingOrders((n) => n + 1);
            } else if (payload.eventType === 'DELETE') {
              const row = payload.old as { status?: string; order_option?: string | null };
              if (isPlaceOrderPending(row)) setPendingOrders((n) => Math.max(0, n - 1));
            }
          }
        )
        .subscribe((status) => {
          console.log('🔔 [Orders] Subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('🔔 [Orders] ✅ Real-time ACTIVE');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn('🔔 [Orders] ⚠️ Disconnected, retrying...');
            reconnectTimeout = setTimeout(setupRealtime, 5000);
          }
        });
      channelRef.current = ch;
    };

    setupRealtime();

    return () => {
      clearInterval(pollInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [playNotificationSound]);

  // Unlock audio on any click/key in the admin (required by browser autoplay policy)
  useEffect(() => {
    console.log('🔊 [Sound] Setting up click listeners for unlock...');
    const unlock = () => {
      handleFirstInteraction();
    };
    document.addEventListener('click', unlock, { capture: true });
    document.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('touchstart', unlock, { capture: true });
    return () => {
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
    };
  }, [handleFirstInteraction]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    customization: false,
    packages: false,
    customFields: false,
    regions: false
  });
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [collapsedRegions, setCollapsedRegions] = useState<Record<string, boolean>>({});
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [draggedPackageCategoryKey, setDraggedPackageCategoryKey] = useState<string | null>(null);
  const [draggedPackageVariationId, setDraggedPackageVariationId] = useState<string | null>(null);
  const touchDropTargetRef = useRef<{ type: 'category' | 'package'; key?: string; variationId?: string } | null>(null);
  const touchDraggingCategoryKeyRef = useRef<string | null>(null);
  const touchDraggingVariationIdRef = useRef<string | null>(null);
  const packageOrderByCategoryRef = useRef<Record<string, Variation[]>>({});
  const [touchDragPreview, setTouchDragPreview] = useState<{ type: 'category' | 'package'; label: string; x: number; y: number } | null>(null);
  const [itemsListTouchDragPreview, setItemsListTouchDragPreview] = useState<{ label: string; x: number; y: number } | null>(null);
  const itemsListDraggedRef = useRef<{ itemId: string; categoryId: string; items: MenuItem[] } | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [priceDiscount, setPriceDiscount] = useState<number | undefined>(undefined);
  const [memberDiscount, setMemberDiscount] = useState<number | undefined>(undefined);
  const [resellerDiscount, setResellerDiscount] = useState<number | undefined>(undefined);
  const [formData, setFormData] = useState<Partial<MenuItem>>({
    name: '',
    basePrice: 0,
    category: 'hot-coffee',
    popular: false,
    available: true,
    variations: [],
    customFields: [],
    badge_text: '',
    badge_color: '#EC4899',
    regions: []
  });

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleAddItem = () => {
    setCurrentView('add');
    const defaultCategory = categories.length > 0 ? categories[0].id : 'dim-sum';
    setPriceDiscount(undefined);
    setMemberDiscount(undefined);
    setResellerDiscount(undefined);
    setFormData({
      name: '',
      basePrice: 0,
      category: defaultCategory,
      popular: false,
      available: true,
      image: '',
      guide_image_url: '',
      guide_text: '',
      variations: [],
      customFields: [],
      badge_text: '',
      badge_color: '#EC4899',
      regions: []
    });
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setFormData(item);
    const savedDiscounts = localStorage.getItem(`amber_discounts_${item.id}`);
    if (savedDiscounts) {
      try {
        const discounts = JSON.parse(savedDiscounts);
        setPriceDiscount(discounts.priceDiscount);
        setMemberDiscount(discounts.memberDiscount);
        setResellerDiscount(discounts.resellerDiscount);
      } catch {
        setPriceDiscount(undefined);
        setMemberDiscount(undefined);
        setResellerDiscount(undefined);
      }
    } else {
      setPriceDiscount(undefined);
      setMemberDiscount(undefined);
      setResellerDiscount(undefined);
    }
    setCurrentView('edit');
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      try {
        setIsProcessing(true);
        await deleteMenuItem(id);
      } catch (error) {
        alert('Failed to delete item. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleReorderItems = useCallback(async (items: MenuItem[], categoryId: string, draggedId: string, dropTargetId: string) => {
    if (draggedId === dropTargetId) return;
    const fromIdx = items.findIndex((i) => i.id === draggedId);
    const toIdx = items.findIndex((i) => i.id === dropTargetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...items];
    const [removed] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, removed);
    reorderCategoryItemsLocally(next);
    try {
      setIsProcessing(true);
      for (let i = 0; i < next.length; i++) {
        await updateSortOrderOnly(next[i].id, i);
      }
    } catch (err) {
      console.error('Reorder failed:', err);
      alert('Failed to reorder. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [updateSortOrderOnly, reorderCategoryItemsLocally]);

  const handleMoveItem = useCallback(async (items: MenuItem[], categoryId: string, itemId: string, direction: 'up' | 'down') => {
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const next = [...items];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    reorderCategoryItemsLocally(next);
    try {
      setIsProcessing(true);
      for (let i = 0; i < next.length; i++) {
        await updateSortOrderOnly(next[i].id, i);
      }
    } catch (err) {
      console.error('Move failed:', err);
      alert('Failed to reorder. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [updateSortOrderOnly, reorderCategoryItemsLocally]);

  const handleReorderPackageCategories = useCallback((draggedKey: string, targetKey: string) => {
    if (!formData.variations || formData.variations.length === 0) return;
    if (draggedKey === targetKey) return;
    const UNNAMED = '__unnamed_category__';
    const grouped: Record<string, { variations: Variation[] }> = {};
    formData.variations.forEach((v) => {
      let key: string;
      if (v.category && v.category.startsWith('__temp_empty_')) key = v.category;
      else if (!v.category || v.category.trim() === '') key = UNNAMED;
      else key = v.category;
      if (!grouped[key]) grouped[key] = { variations: [] };
      grouped[key].variations.push(v);
    });
    const sorted = Object.keys(grouped).sort((a, b) => {
      const sortA = Math.min(...grouped[a].variations.map((v) => (v.sort != null ? v.sort : 999)));
      const sortB = Math.min(...grouped[b].variations.map((v) => (v.sort != null ? v.sort : 999)));
      return sortA - sortB;
    });
    const fromIdx = sorted.indexOf(draggedKey);
    const toIdx = sorted.indexOf(targetKey);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...sorted];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, draggedKey);
    const getKey = (v: Variation) => {
      if (v.category && v.category.startsWith('__temp_empty_')) return v.category;
      if (!v.category || v.category.trim() === '') return UNNAMED;
      return v.category;
    };
    const updatedVariations = formData.variations.map((v) => {
      const key = getKey(v);
      const i = next.indexOf(key);
      return i === -1 ? v : { ...v, sort: i };
    });
    setFormData((prev) => ({ ...prev, variations: updatedVariations }));
  }, [formData.variations]);

  const getTouchDropTarget = useCallback((clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const card = el.closest('[data-droppable]');
    if (!card || !(card instanceof HTMLElement)) return null;
    const type = card.getAttribute('data-droppable');
    if (type === 'category') {
      const key = card.getAttribute('data-drop-key');
      return key != null ? { type: 'category' as const, key } : null;
    }
    if (type === 'package') {
      const variationId = card.getAttribute('data-drop-variation-id');
      return variationId != null ? { type: 'package' as const, variationId } : null;
    }
    return null;
  }, []);

  const getTouchDropTargetGameItem = useCallback((clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY);
    const card = el?.closest('[data-droppable="game-item"]');
    if (!card || !(card instanceof HTMLElement)) return null;
    const itemId = card.getAttribute('data-drop-item-id');
    const categoryId = card.getAttribute('data-drop-category-id');
    if (itemId && categoryId != null) return { itemId, categoryId };
    return null;
  }, []);

  const handleReorderPackagesInCategory = useCallback((categoryVariations: Variation[], draggedId: string, targetId: string) => {
    if (!formData.variations) return;
    if (draggedId === targetId) return;
    const fromIdx = categoryVariations.findIndex((v) => v.id === draggedId);
    const toIdx = categoryVariations.findIndex((v) => v.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...categoryVariations];
    const [removed] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, removed);
    const updatedVariations = formData.variations.map((v) => {
      const i = next.findIndex((n) => n.id === v.id);
      if (i === -1) return v;
      return { ...v, sort_order: i };
    });
    setFormData((prev) => ({ ...prev, variations: updatedVariations }));
  }, [formData.variations]);

  const handleDuplicateItem = async (id: string) => {
    try {
      setIsProcessing(true);
      await duplicateMenuItem(id);
    } catch (error) {
      alert('Failed to duplicate item. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveItem = async () => {
    if (!formData.name) {
      alert('Please fill in all required fields');
      return;
    }

    // Currency packages are required
    if (!formData.variations || formData.variations.length === 0) {
      alert('Please add at least one currency package');
      return;
    }

    // Validate currency packages
    const invalidPackages = formData.variations.filter(v => {
      // Check if name is empty or just whitespace
      if (!v.name || !v.name.trim()) {
        return true;
      }
      // Check if price is valid (must be a number > 0)
      let price: number;
      if (typeof v.price === 'string') {
        price = v.price === '' ? 0 : parseFloat(v.price);
      } else if (v.price === null || v.price === undefined) {
        price = 0;
      } else {
        price = v.price;
      }
      // Price must be a valid number greater than 0
      return !price || price <= 0 || isNaN(price);
    });
    if (invalidPackages.length > 0) {
      alert('Please fill in all currency package names and set valid prices (greater than 0)');
      return;
    }

    // Validate discount decimal if enabled
    if (formData.discountActive && formData.discountPercentage !== undefined) {
      if (formData.discountPercentage < 0 || formData.discountPercentage > 1) {
        alert('Discount must be between 0 and 1 (e.g., 0.10 for 10%)');
        return;
      }
    }

    try {
      // Clean up temporary category identifiers before saving
      const cleanedVariations = formData.variations?.map(v => {
        let cleanedCategory = v.category;
        // Convert temporary empty category identifiers to undefined
        if (cleanedCategory && (cleanedCategory.startsWith('__temp_empty_') || cleanedCategory.startsWith('__empty_'))) {
          cleanedCategory = undefined;
        }
        return { ...v, category: cleanedCategory };
      });
      // Sort by sort_order and assign explicit 0,1,2,... so the first package is never skipped on the customer side
      const sortedVariations = [...(cleanedVariations || [])].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
        .map((v, index) => ({ ...v, sort_order: index }));
      
      // Set basePrice to 0 since we don't use it anymore
      const itemData = {
        ...formData,
        basePrice: 0,
        variations: sortedVariations
      };

      if (editingItem) {
        await updateMenuItem(editingItem.id, itemData);
        const discounts = { priceDiscount, memberDiscount, resellerDiscount };
        localStorage.setItem(`amber_discounts_${editingItem.id}`, JSON.stringify(discounts));
      } else {
        const newItem = await addMenuItem(itemData as Omit<MenuItem, 'id'>);
        if (newItem?.id) {
          const discounts = { priceDiscount, memberDiscount, resellerDiscount };
          localStorage.setItem(`amber_discounts_${newItem.id}`, JSON.stringify(discounts));
        }
      }
      setCurrentView('items');
      setEditingItem(null);
    } catch (error) {
      alert('Failed to save item');
    }
  };

  const handleCancel = () => {
    setCurrentView(currentView === 'add' || currentView === 'edit' ? 'items' : 'dashboard');
    setEditingItem(null);
    setSelectedItems([]);
  };

  const handleBulkRemove = async () => {
    if (selectedItems.length === 0) {
      alert('Please select items to delete');
      return;
    }

    const itemNames = selectedItems.map(id => {
      const item = menuItems.find(i => i.id === id);
      return item ? item.name : 'Unknown Item';
    }).slice(0, 5); // Show first 5 items
    
    const displayNames = itemNames.join(', ');
    const moreItems = selectedItems.length > 5 ? ` and ${selectedItems.length - 5} more items` : '';
    
    if (confirm(`Are you sure you want to delete ${selectedItems.length} item(s)?\n\nItems to delete: ${displayNames}${moreItems}\n\nThis action cannot be undone.`)) {
      try {
        setIsProcessing(true);
        // Delete items one by one
        for (const itemId of selectedItems) {
          await deleteMenuItem(itemId);
        }
        setSelectedItems([]);
        setShowBulkActions(false);
        alert(`Successfully deleted ${selectedItems.length} item(s).`);
      } catch (error) {
        alert('Failed to delete some items. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    }
  };
  const handleBulkCategoryChange = async (newCategoryId: string) => {
    if (selectedItems.length === 0) {
      alert('Please select items to update');
      return;
    }

    const categoryName = categories.find(cat => cat.id === newCategoryId)?.name;
    if (confirm(`Are you sure you want to change the category of ${selectedItems.length} item(s) to "${categoryName}"?`)) {
      try {
        setIsProcessing(true);
        // Update category for each selected item
        for (const itemId of selectedItems) {
          const item = menuItems.find(i => i.id === itemId);
          if (item) {
            await updateMenuItem(itemId, { ...item, category: newCategoryId });
          }
        }
        setSelectedItems([]);
        setShowBulkActions(false);
        alert(`Successfully updated category for ${selectedItems.length} item(s)`);
      } catch (error) {
        alert('Failed to update some items');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === menuItems.length) {
      setSelectedItems([]);
      setShowBulkActions(false);
    } else {
      setSelectedItems(menuItems.map(item => item.id));
      setShowBulkActions(true);
    }
  };

  // Update bulk actions visibility when selection changes
  React.useEffect(() => {
    setShowBulkActions(selectedItems.length > 0);
  }, [selectedItems]);

  const updateVariation = (id: string, field: keyof Variation, value: any) => {
    const updatedVariations = (formData.variations || []).map(v => {
      if (v.id === id) {
        return { ...v, [field]: value };
      }
      return v;
    });
    setFormData({ ...formData, variations: updatedVariations });
  };

  const removeVariation = (id: string) => {
    const updatedVariations = (formData.variations || []).filter(v => v.id !== id);
    setFormData({ ...formData, variations: updatedVariations });
  };

  const sortVariationsByPrice = (regionName?: string) => {
    if (!formData.variations || formData.variations.length === 0) return;
    
    // Filter variations for this region
    const regionVars = formData.variations.filter(v => 
      (!v.region && !regionName) || (v.region === regionName)
    );
    // Filter other variations
    const otherVars = formData.variations.filter(v => 
      !((!v.region && !regionName) || (v.region === regionName))
    );

    // Sort variations by price (lowest to highest) and update sort_order
    const sortedRegionVars = [...regionVars]
      .sort((a, b) => (a.price || 0) - (b.price || 0))
      .map((variation, index) => ({
        ...variation,
        sort_order: index
      }));
    
    setFormData({ ...formData, variations: [...otherVars, ...sortedRegionVars] });
  };

  const addCategoryForRegion = (regionName?: string) => {
    const targetRegionName = regionName || undefined;
    
    // Filter variations in this region
    const regionVars = formData.variations?.filter(v => 
      (!v.region && !targetRegionName) || (v.region === targetRegionName)
    ) || [];

    const existingCategories = new Set<string>();
    regionVars.forEach(v => {
      const cat = v.category || 'Uncategorized';
      existingCategories.add(cat);
    });
    
    const categoryName = `Category ${existingCategories.size + 1}`;
    
    // Get the highest category sort value in this region
    let maxCategorySort = 0;
    regionVars.forEach(v => {
      if (v.sort !== null && v.sort !== undefined && v.sort < 999) {
        maxCategorySort = Math.max(maxCategorySort, v.sort);
      }
    });
    
    const newVariation: Variation = {
      id: `var-${Date.now()}-${Math.random()}`,
      name: '',
      price: undefined,
      description: '',
      sort_order: 0,
      category: categoryName,
      sort: maxCategorySort + 1,
      region: targetRegionName
    };
    
    setFormData({
      ...formData,
      variations: [...(formData.variations || []), newVariation]
    });
    
    setCollapsedCategories(prev => ({ ...prev, [categoryName]: false }));
  };

  // Custom Fields Management
  const addCustomField = () => {
    const newField: CustomField = {
      label: '',
      key: '',
      required: false,
      placeholder: ''
    };
    setFormData({
      ...formData,
      customFields: [...(formData.customFields || []), newField]
    });
  };

  const updateCustomField = (index: number, field: keyof CustomField, value: string | boolean) => {
    const updatedFields = [...(formData.customFields || [])];
    updatedFields[index] = { ...updatedFields[index], [field]: value };
    // Auto-generate key from label if key is empty
    if (field === 'label' && !updatedFields[index].key) {
      updatedFields[index].key = value.toString().toLowerCase().replace(/\s+/g, '_');
    }
    setFormData({ ...formData, customFields: updatedFields });
  };

  const removeCustomField = (index: number) => {
    const updatedFields = formData.customFields?.filter((_, i) => i !== index) || [];
    setFormData({ ...formData, customFields: updatedFields });
  };


  // Dashboard Stats
  const totalItems = menuItems.length;
  const popularItems = menuItems.filter(item => item.popular).length;
  const availableItems = pendingOrders;
  const doneOrders = 'Online';
  const categoryCounts = categories.map(cat => ({
    ...cat,
    count: menuItems.filter(item => item.category === cat.id).length
  }));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Fetch latest password from database before checking
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('id', 'admin_password')
        .single();

      const currentPassword = error ? adminPassword : (data?.value || adminPassword);

      if (password === currentPassword) {
      setIsAuthenticated(true);
      localStorage.setItem('beracah_admin_auth', 'true');
      setLoginError('');
        setPassword('');
        if (data?.value) {
          setAdminPassword(data.value);
        }
    } else {
      setLoginError('Invalid password');
      }
    } catch (err) {
      // Fallback to stored password on error
      if (password === adminPassword) {
        setIsAuthenticated(true);
        localStorage.setItem('beracah_admin_auth', 'true');
        setLoginError('');
        setPassword('');
      } else {
        setLoginError('Invalid password');
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('beracah_admin_auth');
    setPassword('');
    setCurrentView('dashboard');
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" onClick={() => handleFirstInteraction()}>
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-black">Admin Access</h1>
            <p className="text-gray-600 mt-2">Enter password to access the admin dashboard</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label className="block text-xs font-medium text-black mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-xs text-black"
                placeholder="Enter admin password"
                required
              />
              {loginError && (
                <p className="text-red-500 text-xs mt-2">{loginError}</p>
              )}
            </div>
            
            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Form View (Add/Edit)
  if (currentView === 'add' || currentView === 'edit') {
    return (
      <React.Fragment>
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-40 bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleCancel}
                  className="text-gray-600 hover:text-black transition-colors duration-200"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-black">
                  {currentView === 'add' ? 'Add New Item' : 'Edit Item'}
                </h1>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancel}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center text-xs"
                  aria-label="Cancel"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  onClick={handleSaveItem}
                  className="px-3 py-1.5 md:px-4 md:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2 text-xs"
                >
                  <Save className="h-4 w-4" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-8">
            {/* Item Customization Section */}
            <div className="mb-8 border-b border-gray-200 pb-8">
              <button
                onClick={() => toggleSection('customization')}
                className="w-full flex items-center justify-between text-left mb-4 hover:opacity-80 transition-opacity"
              >
                <h3 className="text-xs font-semibold text-black">Item Customization</h3>
                {collapsedSections.customization ? (
                  <ChevronDown className="h-5 w-5 text-gray-600" />
                ) : (
                  <ChevronUp className="h-5 w-5 text-gray-600" />
                )}
              </button>
              
              {!collapsedSections.customization && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <label className="block text-xs font-medium text-black mb-2">Item Name (Game Name) *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-xs text-black"
                        placeholder="Enter game name (e.g., Wild Rift, Mobile Legends)"
                />
                        </div>
                        <div className="w-24 sm:w-32 flex-shrink-0">
                          <label className="block text-xs font-medium text-black mb-2">Sort</label>
                          <input
                            type="number"
                            value={formData.sort_order !== undefined ? formData.sort_order : ''}
                            onChange={(e) => setFormData({ ...formData, sort_order: e.target.value === '' ? undefined : parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-xs text-black"
                            placeholder="Sort"
                            min="0"
                            step="1"
                          />
                        </div>
                      </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-2">Category *</label>
                <select
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-xs text-black"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.popular || false}
                    onChange={(e) => setFormData({ ...formData, popular: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-xs font-medium text-black">Mark as Popular</span>
                </label>
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.available ?? true}
                    onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-xs font-medium text-black">Available for Order</span>
                </label>
              </div>
            </div>

                  {/* Description Field */}
                  <div>
                    <label className="block text-xs font-medium text-black mb-2">Description</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none text-xs text-black"
                      placeholder="Enter game description (this will be displayed below the game title in the modal)"
                      rows={4}
                    />
                    <p className="text-xs text-gray-500 mt-1">This description will be shown below the game title when customers tap on the game item</p>
                  </div>

                  {/* Custom Subtitle Field */}
                  <div>
                    <label className="block text-xs font-medium text-black mb-2">Custom Text Below Title</label>
                    <input
                      type="text"
                      value={formData.subtitle || ''}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-xs text-black"
                      placeholder="Enter custom text to display below the game title (optional)"
                    />
                    <p className="text-xs text-gray-500 mt-1">This text will appear below the game title on the customer side. Leave empty to show no text.</p>
                  </div>

                  {/* Badge Text and Color Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-black mb-2">Badge Overlay Text (e.g. PROMO, SALE)</label>
                      <input
                        type="text"
                        value={formData.badge_text || ''}
                        onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-xs text-black"
                        placeholder="e.g. SALE"
                        maxLength={10}
                      />
                      <p className="text-xs text-gray-500 mt-1">Overlay badge on top-left of game icon.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-black mb-2">Badge Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData.badge_color || '#EC4899'}
                          onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                          className="h-10 w-10 border border-gray-300 rounded focus:ring-2 focus:ring-black"
                        />
                        <input
                          type="text"
                          value={formData.badge_color || '#EC4899'}
                          onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black text-xs text-black"
                          placeholder="#EC4899"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Discount Pricing Section - trish-devion style */}
                  <div>
                    <h4 className="text-xs font-playfair font-medium text-black mb-4">Discount</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-black mb-2">Price</label>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          value={priceDiscount ?? ''}
                          onChange={(e) => {
                            const discount = e.target.value !== '' ? Number(e.target.value) : undefined;
                            setPriceDiscount(discount);
                            if (editingItem) {
                              const saved = localStorage.getItem(`amber_discounts_${editingItem.id}`);
                              const d = saved ? JSON.parse(saved) : {};
                              d.priceDiscount = discount;
                              localStorage.setItem(`amber_discounts_${editingItem.id}`, JSON.stringify(d));
                            }
                            if (discount !== undefined && formData.variations) {
                              const updated = formData.variations.map(v => {
                                const base = typeof v.price === 'number' ? v.price : (parseFloat(String(v.price)) || 0);
                                return { ...v, price: base * (1 - discount) };
                              });
                              setFormData({ ...formData, variations: updated });
                            }
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-xs text-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0.10"
                        />
                        <p className="text-xs text-gray-500 mt-1">Applies discount to all Price fields</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-2">Member</label>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          value={memberDiscount ?? ''}
                          onChange={(e) => {
                            const discount = e.target.value !== '' ? Number(e.target.value) : undefined;
                            setMemberDiscount(discount);
                            if (editingItem) {
                              const saved = localStorage.getItem(`amber_discounts_${editingItem.id}`);
                              const d = saved ? JSON.parse(saved) : {};
                              d.memberDiscount = discount;
                              localStorage.setItem(`amber_discounts_${editingItem.id}`, JSON.stringify(d));
                            }
                            if (discount !== undefined && formData.variations) {
                              const updated = formData.variations.map(v => {
                                const base = typeof v.price === 'number' ? v.price : (parseFloat(String(v.price)) || 0);
                                return { ...v, member_price: base * (1 - discount) };
                              });
                              setFormData({ ...formData, variations: updated });
                            }
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-xs text-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0.10"
                        />
                        <p className="text-xs text-gray-500 mt-1">Calculates discounted member price from original price</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-black mb-2">VIP</label>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          value={resellerDiscount ?? ''}
                          onChange={(e) => {
                            const discount = e.target.value !== '' ? Number(e.target.value) : undefined;
                            setResellerDiscount(discount);
                            if (editingItem) {
                              const saved = localStorage.getItem(`amber_discounts_${editingItem.id}`);
                              const d = saved ? JSON.parse(saved) : {};
                              d.resellerDiscount = discount;
                              localStorage.setItem(`amber_discounts_${editingItem.id}`, JSON.stringify(d));
                            }
                            if (discount !== undefined && formData.variations) {
                              const updated = formData.variations.map(v => {
                                const base = typeof v.price === 'number' ? v.price : (parseFloat(String(v.price)) || 0);
                                return { ...v, reseller_price: base * (1 - discount) };
                              });
                              setFormData({ ...formData, variations: updated });
                            }
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-xs text-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0.10"
                        />
                        <p className="text-xs text-gray-500 mt-1">Calculates discounted VIP price from original price</p>
                      </div>
                    </div>
                  </div>

                  {/* Game Icon & Guide Image Upload */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <ImageUpload
                        label="Game Icon upload"
                        currentImage={formData.image}
                        onImageChange={(imageUrl) => setFormData({ ...formData, image: imageUrl })}
                      />
                    </div>
                    <div>
                      <ImageUpload
                        label="Guide Image upload"
                        currentImage={formData.guide_image_url}
                        onImageChange={(imageUrl) => setFormData({ ...formData, guide_image_url: imageUrl || '' })}
                      />
                      <p className="text-xs text-gray-500 mt-1">This image will be displayed when a user clicks the Guide button next to Player Details in the order modal.</p>
                      
                      <div className="mt-4">
                        <label className="block text-xs font-medium text-black mb-1.5">Guide Instruction Text</label>
                        <textarea
                          value={formData.guide_text || ''}
                          onChange={(e) => setFormData({ ...formData, guide_text: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-xs text-black"
                          placeholder="Enter guide instructions (e.g. step-by-step detail of where to find the ID/Server inside the game)"
                          rows={3}
                        />
                        <p className="text-xs text-gray-500 mt-1">This text will be shown below the guide image inside the customer's ID guide popup modal.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Regions Section */}
            <div className="mb-8 border-b border-gray-200 pb-8">
              <button
                onClick={() => toggleSection('regions')}
                className="w-full flex items-center justify-between text-left mb-4 hover:opacity-80 transition-opacity"
                type="button"
              >
                <div className="flex-1">
                  <h3 className="text-xs font-semibold text-black">Regions</h3>
                  <p className="text-xs text-gray-500 mt-1">Manage game regions and region-specific guides (e.g., Singapore, Indo)</p>
                </div>
                {collapsedSections.regions ? (
                  <ChevronDown className="h-5 w-5 text-gray-600 ml-4 flex-shrink-0" />
                ) : (
                  <ChevronUp className="h-5 w-5 text-gray-600 ml-4 flex-shrink-0" />
                )}
              </button>

              {!collapsedSections.regions && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        const newRegion = {
                          id: `region-${Date.now()}-${Math.random()}`,
                          name: '',
                          guide_image_url: '',
                          guide_text: ''
                        };
                        setFormData({
                          ...formData,
                          regions: [...(formData.regions || []), newRegion]
                        });
                      }}
                      className="flex items-center space-x-2 px-3 py-2 bg-cream-100 text-black rounded-lg hover:bg-cream-200 transition-colors duration-200 text-xs font-bold uppercase tracking-wider"
                      type="button"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Region</span>
                    </button>
                  </div>

                  {(formData.regions && formData.regions.length > 0) ? (
                    <div className="space-y-4">
                      {formData.regions.map((region, regionIdx) => (
                        <div key={region.id} className="p-4 bg-gray-50 rounded-lg space-y-4 border border-gray-200">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Region Name *</label>
                              <input
                                type="text"
                                value={region.name}
                                onChange={(e) => {
                                  const updated = [...(formData.regions || [])];
                                  updated[regionIdx] = { ...updated[regionIdx], name: e.target.value };
                                  setFormData({ ...formData, regions: updated });
                                }}
                                placeholder="e.g. Singapore, Indonesia"
                                className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-black"
                                required
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (formData.regions || []).filter((_, idx) => idx !== regionIdx);
                                const deletedRegionName = region.name;
                                const updatedVariations = (formData.variations || []).map(v => {
                                  if (v.region === deletedRegionName) {
                                    return { ...v, region: undefined };
                                  }
                                  return v;
                                });
                                setFormData({
                                  ...formData,
                                  regions: updated,
                                  variations: updatedVariations
                                });
                              }}
                              className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors self-end"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Region-Specific Guide */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200/60">
                            <div>
                              <ImageUpload
                                label="Region Guide Image"
                                currentImage={region.guide_image_url}
                                onImageChange={(imageUrl) => {
                                  const updated = [...(formData.regions || [])];
                                  updated[regionIdx] = { ...updated[regionIdx], guide_image_url: imageUrl || '' };
                                  setFormData({ ...formData, regions: updated });
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Region Guide Instruction Text</label>
                              <textarea
                                value={region.guide_text || ''}
                                onChange={(e) => {
                                  const updated = [...(formData.regions || [])];
                                  updated[regionIdx] = { ...updated[regionIdx], guide_text: e.target.value };
                                  setFormData({ ...formData, regions: updated });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded text-xs text-black"
                                placeholder="Region-specific guide instructions"
                                rows={3}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      <p className="text-xs text-gray-500">No specific regions configured. This game will have a single global flow.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* In-Game Currency Packages Section */}
            <div className="mb-8 border-b border-gray-200 pb-8">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => toggleSection('packages')}
                  className="flex-1 flex items-center justify-between text-left hover:opacity-80 transition-opacity"
                >
                  <>
                    <div className="flex-1">
                      <h3 className="text-xs font-semibold text-black">Packages</h3>
                      <p className="text-xs text-gray-500 mt-1">Add currency packages that will be shown when customers click on this item</p>
                    </div>
                    {collapsedSections.packages ? (
                      <ChevronDown className="h-5 w-5 text-gray-600 ml-4 flex-shrink-0" />
                    ) : (
                      <ChevronUp className="h-5 w-5 text-gray-600 ml-4 flex-shrink-0" />
                    )}
                  </>
                </button>
              </div>

              {!collapsedSections.packages && (
                <div className="space-y-6">
                  {(() => {
                    const configuredRegions = formData.regions?.map(r => r.name) || [];
                    const variationRegions = Array.from(new Set(
                      (formData.variations || [])
                        .map(v => v.region)
                        .filter((r): r is string => !!r)
                    ));
                    const allRegions = Array.from(new Set([...configuredRegions, ...variationRegions]));
                    const adminRegionsList = ['Global', ...allRegions];
                    return (
                      <div className="space-y-6">
                        {adminRegionsList.map((regionName) => {
                          const targetRegionName = regionName === 'Global' ? undefined : regionName;
                          
                          // Filter variations that belong to this region
                          const regionVariations = (formData.variations || []).filter(v => 
                            (!v.region && !targetRegionName) || (v.region === targetRegionName)
                          );

                          // Skip rendering empty Global section if other regions exist and Global has no variations
                          if (regionName === 'Global' && formData.regions && formData.regions.length > 0 && regionVariations.length === 0) {
                            return null;
                          }

                          // Group variations in this region by category
                          const groupedByCategory: Record<string, { variations: Variation[], categorySort: number, originalCategory: string | undefined, isUnnamed: boolean }> = {};
                          const UNNAMED_CATEGORY_KEY = `__unnamed_category_${regionName}__`;
                          
                          regionVariations.forEach((variation) => {
                            let categoryKey: string;
                            let isUnnamed = false;
                            
                            if (variation.category && variation.category.startsWith('__temp_empty_')) {
                              categoryKey = variation.category;
                            } else if (!variation.category || variation.category.trim() === '') {
                              categoryKey = UNNAMED_CATEGORY_KEY;
                              isUnnamed = true;
                            } else {
                              categoryKey = variation.category;
                            }
                            
                            const categorySort = variation.sort !== null && variation.sort !== undefined ? variation.sort : 999;
                            
                            if (!groupedByCategory[categoryKey]) {
                              groupedByCategory[categoryKey] = { 
                                variations: [], 
                                categorySort: 999,
                                originalCategory: variation.category,
                                isUnnamed: isUnnamed
                              };
                            }
                            groupedByCategory[categoryKey].variations.push(variation);
                            if (categorySort < groupedByCategory[categoryKey].categorySort) {
                              groupedByCategory[categoryKey].categorySort = categorySort;
                            }
                          });

                          const sortedCategories = Object.keys(groupedByCategory).sort((a, b) => {
                            return groupedByCategory[a].categorySort - groupedByCategory[b].categorySort;
                          });

                          const regObj = formData.regions?.find(r => r.name === regionName);
                          const isRegionCollapsed = collapsedRegions[regionName] ?? false;

                          return (
                            <div key={regionName} className={`border border-gray-200 rounded-xl p-5 bg-gray-50/50 shadow-sm transition-all duration-200 ${isRegionCollapsed ? '' : 'space-y-4'}`}>
                              {/* Region Section Header */}
                              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isRegionCollapsed ? '' : 'pb-3 border-b border-gray-200'}`}>
                                <button
                                  type="button"
                                  onClick={() => setCollapsedRegions(prev => ({ ...prev, [regionName]: !isRegionCollapsed }))}
                                  className="flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity flex-1 min-w-0"
                                >
                                  {isRegionCollapsed ? (
                                    <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                                  ) : (
                                    <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                                  )}
                                  {regObj?.guide_image_url && (
                                    <img
                                      src={regObj.guide_image_url}
                                      alt=""
                                      className="w-7 h-4.5 object-cover rounded border border-gray-300 flex-shrink-0"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-black text-black uppercase tracking-wider truncate">
                                      {regionName === 'Global' ? 'Global / All Regions' : `${regionName} Region`}
                                    </h4>
                                    {regObj?.guide_text && !isRegionCollapsed && (
                                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{regObj.guide_text}</p>
                                    )}
                                  </div>
                                  <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                                    {regionVariations.length} packages
                                  </span>
                                </button>

                                {/* Controls specific to this region */}
                                {!isRegionCollapsed && (
                                  <div className="flex items-center gap-2">
                                    {regionVariations.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => sortVariationsByPrice(targetRegionName)}
                                        className="flex items-center justify-center space-x-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors duration-200 text-[10px] font-bold"
                                        title="Sort packages in this region by price"
                                      >
                                        <ArrowUpDown className="h-3.5 w-3.5" />
                                        <span>Sort by Price</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => addCategoryForRegion(targetRegionName)}
                                      className="flex items-center justify-center space-x-1.5 px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors duration-200 text-[10px] font-bold"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      <span>Add Category</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Categories and Packages List for this Region */}
                              {!isRegionCollapsed && (
                                <>
                                  {regionVariations.length > 0 ? (
                                    <div className="space-y-4">
                                      {sortedCategories.map((category) => {
                                        const categoryData = groupedByCategory[category];
                                        const categoryVariations = categoryData.variations;
                                        const originalCategory = categoryData.originalCategory;
                                        const isUnnamed = categoryData.isUnnamed;
                                        const actualCategoryName = categoryVariations[0]?.category;
                                        
                                        let displayCategoryName = '';
                                        if (isUnnamed || category.startsWith('__unnamed_category_')) {
                                          displayCategoryName = (actualCategoryName && actualCategoryName.trim() !== '' && !actualCategoryName.startsWith('__temp_empty_') && !actualCategoryName.startsWith('__empty_')) 
                                            ? actualCategoryName 
                                            : 'Unnamed Category';
                                        } else if (category.startsWith('__temp_empty_') || category.startsWith('__empty_')) {
                                          displayCategoryName = '';
                                        } else if (actualCategoryName && actualCategoryName.trim() !== '' && !actualCategoryName.startsWith('__temp_empty_') && !actualCategoryName.startsWith('__empty_')) {
                                          displayCategoryName = actualCategoryName;
                                        } else if (originalCategory && originalCategory.trim() !== '' && !originalCategory.startsWith('__temp_empty_') && !originalCategory.startsWith('__empty_')) {
                                          displayCategoryName = originalCategory;
                                        } else {
                                          displayCategoryName = category;
                                        }

                                        const isCategoryCollapsed = collapsedCategories[category] ?? false;
                                        const stableKey = categoryVariations[0]?.id || `category-${category}`;

                                        return (
                                          <div
                                            key={stableKey}
                                            className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
                                          >
                                            {/* Category Header */}
                                            <div className="flex flex-row items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setCollapsedCategories(prev => ({
                                                    ...prev,
                                                    [category]: !prev[category]
                                                  }));
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded transition-colors duration-200 flex-shrink-0"
                                                aria-label={isCategoryCollapsed ? "Expand category" : "Collapse category"}
                                              >
                                                {isCategoryCollapsed ? (
                                                  <ChevronDown className="h-4 w-4 text-gray-600" />
                                                ) : (
                                                  <ChevronUp className="h-4 w-4 text-gray-600" />
                                                )}
                                              </button>
                                              
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap hidden sm:block">Category Name</label>
                                                  <input
                                                    type="text"
                                                    value={displayCategoryName}
                                                    onChange={(e) => {
                                                      const newCategoryName = e.target.value;
                                                      const categoryVariationIds = new Set(categoryVariations.map(v => v.id));
                                                      const updatedVariations = formData.variations!.map(v => {
                                                        if (categoryVariationIds.has(v.id)) {
                                                          if (newCategoryName.trim() === '') {
                                                            const tempCategoryId = `__temp_empty_${categoryVariations[0]?.id || 'default'}__`;
                                                            return { ...v, category: tempCategoryId };
                                                          } else {
                                                            return { ...v, category: newCategoryName };
                                                          }
                                                        }
                                                        return v;
                                                      });
                                                      setFormData({ ...formData, variations: updatedVariations });
                                                    }}
                                                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs font-semibold text-black"
                                                    placeholder="Category name"
                                                  />
                                                </div>
                                              </div>
                                              
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setCategoryToDelete(category);
                                                }}
                                                className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200 flex-shrink-0"
                                                title="Delete category"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </button>
                                            </div>

                                            {/* Packages in Category */}
                                            {!isCategoryCollapsed && (
                                              <div className="space-y-3">
                                                {[...categoryVariations]
                                                  .sort((a, b) => (a.price || 0) - (b.price || 0))
                                                  .map((variation) => (
                                                    <div key={variation.id} className="p-3 bg-gray-50 rounded-lg space-y-3 border border-gray-200">
                                                      {/* Product Info Row */}
                                                      <div className="flex flex-row items-center gap-2">
                                                        <input
                                                          type="text"
                                                          value={variation.name || ''}
                                                          onChange={(e) => updateVariation(variation.id, 'name', e.target.value)}
                                                          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs text-black"
                                                          placeholder="Product name"
                                                        />
                                                        <button
                                                          type="button"
                                                          onClick={() => removeVariation(variation.id)}
                                                          className="p-2 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors duration-200 flex-shrink-0"
                                                          aria-label="Remove package"
                                                        >
                                                          <Trash2 className="h-4 w-4" />
                                                        </button>
                                                      </div>

                                                      {/* Pricing Row */}
                                                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                                        <div>
                                                          <label className="block text-xs font-medium text-gray-700 mb-1">Price</label>
                                                          <input
                                                            type="number"
                                                            value={variation.price !== undefined && variation.price !== null && variation.price !== 0 ? variation.price : ''}
                                                            onChange={(e) => {
                                                              const value = e.target.value === '' ? undefined : Number(e.target.value);
                                                              updateVariation(variation.id, 'price', value);
                                                            }}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs text-black"
                                                            placeholder="0"
                                                            min="0"
                                                            step="0.01"
                                                          />
                                                        </div>
                                                        <div>
                                                          <label className="block text-xs font-medium text-gray-700 mb-1">Member</label>
                                                          <input
                                                            type="number"
                                                            value={variation.member_price !== undefined && variation.member_price !== null ? variation.member_price : ''}
                                                            onChange={(e) => {
                                                              const value = e.target.value === '' ? undefined : Number(e.target.value);
                                                              updateVariation(variation.id, 'member_price', value);
                                                            }}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs text-black"
                                                            placeholder="0"
                                                            min="0"
                                                            step="0.01"
                                                          />
                                                        </div>
                                                        <div>
                                                          <label className="block text-xs font-medium text-gray-700 mb-1">VIP</label>
                                                          <input
                                                            type="number"
                                                            value={variation.reseller_price !== undefined && variation.reseller_price !== null ? variation.reseller_price : ''}
                                                            onChange={(e) => {
                                                              const value = e.target.value === '' ? undefined : Number(e.target.value);
                                                              updateVariation(variation.id, 'reseller_price', value);
                                                            }}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs text-black"
                                                            placeholder="0"
                                                            min="0"
                                                            step="0.01"
                                                          />
                                                        </div>
                                                      </div>

                                                      {/* Region Assignment Dropdown */}
                                                      {formData.regions && formData.regions.length > 0 && (
                                                        <div className="mb-2">
                                                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Region Assignment</label>
                                                          <select
                                                            value={variation.region || ''}
                                                            onChange={(e) => {
                                                              const val = e.target.value || null;
                                                              updateVariation(variation.id, 'region', val);
                                                            }}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs text-black"
                                                          >
                                                            <option value="">Global / All Regions</option>
                                                            {formData.regions.map((r) => (
                                                              <option key={r.id} value={r.name}>
                                                                {r.name}
                                                              </option>
                                                            ))}
                                                          </select>
                                                        </div>
                                                      )}

                                                      {/* Description */}
                                                      <textarea
                                                        value={variation.description || ''}
                                                        onChange={(e) => updateVariation(variation.id, 'description', e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs resize-y text-black mb-2"
                                                        placeholder="Package description (optional)"
                                                        rows={2}
                                                      />

                                                      {/* Badge */}
                                                      <div className="flex flex-wrap items-center gap-4 pt-1">
                                                        <label className="flex items-center gap-2 cursor-pointer group">
                                                          <div className="relative flex items-center">
                                                            <input
                                                              type="checkbox"
                                                              checked={!!variation.badge_text}
                                                              onChange={(e) => {
                                                                const isChecked = e.target.checked;
                                                                updateVariation(variation.id, 'badge_text', isChecked ? 'PROMO' : null);
                                                                if (isChecked && !variation.badge_color) {
                                                                  updateVariation(variation.id, 'badge_color', '#EC4899');
                                                                }
                                                              }}
                                                              className="sr-only peer"
                                                            />
                                                            <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-green-600"></div>
                                                          </div>
                                                          <span className="text-[10px] font-medium text-gray-600 group-hover:text-gray-800 transition-colors">Badge</span>
                                                        </label>

                                                        {variation.badge_text !== null && variation.badge_text !== undefined && (
                                                          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-1 duration-200">
                                                            <input
                                                              type="text"
                                                              value={variation.badge_text || ''}
                                                              onChange={(e) => updateVariation(variation.id, 'badge_text', e.target.value)}
                                                              className="w-24 px-2 py-1 border border-gray-300 rounded text-[10px] text-black focus:ring-1 focus:ring-green-500 focus:border-transparent"
                                                              placeholder="Label"
                                                            />
                                                            <div className="flex items-center gap-1.5">
                                                              <input
                                                                type="color"
                                                                value={variation.badge_color || '#EC4899'}
                                                                onChange={(e) => updateVariation(variation.id, 'badge_color', e.target.value)}
                                                                className="h-5 w-5 border-0 p-0 bg-transparent cursor-pointer rounded-sm overflow-hidden"
                                                              />
                                                              <span className="text-[9px] text-gray-500 font-mono uppercase">{variation.badge_color || '#EC4899'}</span>
                                                            </div>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  ))}

                                                {/* Add Package to Category Button */}
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const newVariation: Variation = {
                                                      id: `var-${Date.now()}-${Math.random()}`,
                                                      name: '',
                                                      price: undefined,
                                                      member_price: undefined,
                                                      reseller_price: undefined,
                                                      credits_amount: undefined,
                                                      description: '',
                                                      sort_order: categoryVariations.length,
                                                      category: category,
                                                      region: targetRegionName
                                                    };
                                                    setFormData({
                                                      ...formData,
                                                      variations: [...(formData.variations || []), newVariation]
                                                    });
                                                  }}
                                                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-xs border-2 border-dashed border-gray-300 font-medium"
                                                >
                                                  <Plus className="h-4 w-4" />
                                                  <span>Add Package to {displayCategoryName || 'Category'}</span>
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-center py-6 bg-white rounded-lg border-2 border-dashed border-gray-200">
                                      <p className="text-xs text-gray-500">No currency packages configured for this region yet.</p>
                                      <button
                                        type="button"
                                        onClick={() => addCategoryForRegion(targetRegionName)}
                                        className="mt-2 inline-flex items-center space-x-1 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors duration-200 text-[10px] font-bold"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        <span>Create Category & Package</span>
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Custom Fields Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => toggleSection('customFields')}
                  className="flex-1 flex items-center justify-between text-left hover:opacity-80 transition-opacity"
                >
                  <div className="flex-1">
                    <h3 className="text-xs font-semibold text-black">Customer Information Fields</h3>
                    <p className="text-xs text-gray-500 mt-1">Define custom fields that will appear in the customer information section during checkout for this game</p>
                  </div>
                  {collapsedSections.customFields ? (
                    <ChevronDown className="h-5 w-5 text-gray-600 ml-4 flex-shrink-0" />
                  ) : (
                    <ChevronUp className="h-5 w-5 text-gray-600 ml-4 flex-shrink-0" />
                  )}
                </button>
              </div>

              {!collapsedSections.customFields && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      onClick={addCustomField}
                  className="flex items-center space-x-2 px-3 py-2 bg-cream-100 text-black rounded-lg hover:bg-cream-200 transition-colors duration-200"
                >
                  <Plus className="h-4 w-4" />
                      <span>Add Field</span>
                </button>
              </div>

                  {formData.customFields && formData.customFields.length > 0 ? (
                    formData.customFields.map((customField, index) => (
                      <div key={index} className="mb-3 p-4 bg-gray-50 rounded-lg space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-black mb-1">Field Label *</label>
                  <input
                    type="text"
                            value={customField.label || ''}
                            onChange={(e) => updateCustomField(index, 'label', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs text-black"
                            placeholder="e.g., ID with tag, UID, Server"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-black mb-1">Placeholder Text</label>
                  <input
                            type="text"
                            value={customField.placeholder || ''}
                            onChange={(e) => updateCustomField(index, 'placeholder', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs text-black"
                            placeholder="e.g., ID with tag (If Riot ID)"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={customField.required || false}
                              onChange={(e) => updateCustomField(index, 'required', e.target.checked)}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-xs font-medium text-black">Required Field</span>
                          </label>
                  <button
                            onClick={() => removeCustomField(index)}
                    className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
            </div>
                    ))
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <p className="text-gray-500">No custom fields added yet</p>
                      <p className="text-xs text-gray-400 mt-1">Click "Add Field" to create custom customer information fields</p>
          </div>
                  )}
        </div>
              )}
      </div>

          </div>
        </div>
      </div>
      
      {/* Delete Category Confirmation Dialog */}
      {categoryToDelete && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" 
          onClick={() => setCategoryToDelete(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div 
            className="bg-white rounded-lg p-4 md:p-6 max-w-md w-full mx-4 shadow-xl" 
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xs font-semibold text-gray-900 mb-2">Delete Category</h3>
            <p className="text-xs text-gray-600 mb-6">
              Are you sure you want to delete this category? All packages in this category will be moved to "Unnamed Category".
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setCategoryToDelete(null)}
                className="px-3 py-1.5 md:px-4 md:py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (categoryToDelete) {
                    // Find all variations that belong to this category
                    // The categoryToDelete is the key from groupedByCategory
                    const updatedVariations = formData.variations!.map(v => {
                      const vCategory = v.category || '';
                      
                      // Match variations that belong to this category
                      // Handle different category key types:
                      // 1. Direct match
                      // 2. Unnamed category (undefined/null/empty)
                      // 3. Temporary empty category identifiers
                      if (categoryToDelete === '__unnamed_category__') {
                        // Deleting unnamed category - move to unnamed (no change needed, but handle edge case)
                        if (!vCategory || vCategory.trim() === '' || vCategory === '__unnamed_category__') {
                          return { ...v, category: undefined, sort: null };
                        }
                      } else if (vCategory === categoryToDelete || 
                                 (categoryToDelete.startsWith('__temp_empty_') && vCategory === categoryToDelete)) {
                        // Move to "Unnamed Category" by setting category to undefined
                        return { ...v, category: undefined, sort: null };
                      }
                      return v;
                    });
                    
                    setFormData({ ...formData, variations: updatedVariations });
                    setCategoryToDelete(null);
                  }
                }}
                className="px-3 py-1.5 md:px-4 md:py-2 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors duration-200"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Touch drag preview - follows finger when dragging on mobile */}
      {touchDragPreview && (
        <div
          className="fixed z-[9999] pointer-events-none touch-none"
          style={{
            left: touchDragPreview.x,
            top: touchDragPreview.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="px-4 py-2.5 rounded-lg shadow-lg border-2 border-gray-200 bg-white text-gray-900 text-sm font-medium whitespace-nowrap max-w-[200px] truncate">
            {touchDragPreview.label}
          </div>
        </div>
      )}
      </React.Fragment>
    );
  }

  // Items List View
  if (currentView === 'items') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-40 bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="text-gray-600 hover:text-black transition-colors duration-200"
                  aria-label="Back to dashboard"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-black">Manage Game Items</h1>
              </div>
              <div className="flex items-center space-x-2 md:space-x-3">
                {showBulkActions && (
                  <div className="hidden md:flex items-center space-x-2">
                    <span className="text-xs text-gray-600">
                      {selectedItems.length} item(s) selected
                    </span>
                    <button
                      onClick={() => setShowBulkActions(!showBulkActions)}
                      className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-xs"
                    >
                      <span>Bulk Actions</span>
                    </button>
                  </div>
                )}
                <button
                  onClick={handleAddItem}
                  className="flex items-center space-x-1 md:space-x-2 bg-green-600 text-white px-2 py-1.5 md:px-3 md:py-1.5 lg:px-4 lg:py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-xs lg:text-xs"
                >
                  <Plus className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Add New Item</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
          {/* Bulk Actions Panel */}
          {showBulkActions && selectedItems.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-3 md:p-4 lg:p-6 mb-4 md:mb-6 border-l-4 border-blue-500">
              <div className="flex flex-col gap-3 md:gap-4">
                <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xs lg:text-xs font-medium text-black">Bulk Actions</h3>
                    <p className="text-xs text-gray-600">{selectedItems.length} item(s) selected</p>
                  </div>
                  <button
                    onClick={() => setShowBulkActions(false)}
                    className="md:hidden p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="flex flex-col gap-2 md:gap-3">
                  {/* Change Category */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-xs font-medium text-gray-700 whitespace-nowrap">Change Category:</label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleBulkCategoryChange(e.target.value);
                          e.target.value = ''; // Reset selection
                        }
                      }}
                      className="flex-1 px-2 py-1.5 md:px-3 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs text-black"
                      disabled={isProcessing}
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                  {/* Remove Items */}
                  <button
                    onClick={handleBulkRemove}
                    disabled={isProcessing}
                      className="flex-1 flex items-center justify-center space-x-2 bg-red-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                  >
                      <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                    <span>{isProcessing ? 'Removing...' : 'Remove Selected'}</span>
                  </button>
                  
                  {/* Clear Selection */}
                  <button
                    onClick={() => {
                      setSelectedItems([]);
                      setShowBulkActions(false);
                    }}
                      className="flex-1 flex items-center justify-center space-x-2 bg-gray-500 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200 text-xs"
                  >
                      <X className="h-3 w-3 md:h-4 md:w-4" />
                    <span>Clear Selection</span>
                  </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Bulk Actions Bar */}
            {menuItems.length > 0 && (
              <div className="bg-gray-50 border-b border-gray-200 px-3 md:px-4 lg:px-6 py-2 md:py-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                  <div className="flex items-center space-x-2 md:space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedItems.length === menuItems.length && menuItems.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-4 h-4 md:w-5 md:h-5"
                      />
                      <span className="text-xs font-medium text-gray-700">
                        Select All ({menuItems.length} items)
                      </span>
                    </label>
                  </div>
                  {selectedItems.length > 0 && (
                    <div className="flex items-center justify-between sm:justify-end space-x-3">
                      <span className="text-xs text-gray-600">
                        {selectedItems.length} item(s) selected
                      </span>
                      <button
                        onClick={() => {
                          if (!showBulkActions) {
                            setShowBulkActions(true);
                          } else {
                            setSelectedItems([]);
                            setShowBulkActions(false);
                          }
                        }}
                        className="md:hidden text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
                      >
                        {showBulkActions ? 'Hide' : 'Actions'}
                      </button>
                      <button
                        onClick={() => setSelectedItems([])}
                        className="hidden md:block text-xs text-gray-500 hover:text-gray-700 transition-colors duration-200"
                      >
                        Clear Selection
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Desktop Table View - Grouped by Category */}
            <div className="hidden md:block overflow-x-auto">
              {(() => {
                // Group menu items by category
                const groupedByCategory = categories.reduce((acc, category) => {
                  const categoryItems = menuItems
                    .filter(item => item.category === category.id)
                    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                  if (categoryItems.length > 0) {
                    acc[category.id] = {
                      category,
                      items: categoryItems
                    };
                  }
                  return acc;
                }, {} as Record<string, { category: typeof categories[0], items: MenuItem[] }>);

                // Items without category
                const uncategorizedItems = menuItems
                  .filter(item => !categories.find(cat => cat.id === item.category))
                  .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

                return (
                  <div className="space-y-6">
                    {/* Grouped by Category */}
                    {Object.values(groupedByCategory).map(({ category, items }) => {
                      const isCollapsed = collapsedCategories[category.id] || false;
                      return (
                      <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div 
                          className="bg-gray-100 px-6 py-3 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors"
                          onClick={() => setCollapsedCategories(prev => ({ ...prev, [category.id]: !prev[category.id] }))}
                        >
                          <h3 className="text-xs font-semibold text-gray-900">{category.name}</h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCollapsedCategories(prev => ({ ...prev, [category.id]: !prev[category.id] }));
                            }}
                            className="p-1 hover:bg-gray-300 rounded transition-colors"
                          >
                            {isCollapsed ? (
                              <ChevronDown className="h-5 w-5 text-gray-600" />
                            ) : (
                              <ChevronUp className="h-5 w-5 text-gray-600" />
                            )}
                          </button>
                        </div>
                        {!isCollapsed && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900">Select</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900">Sort</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900">Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900">Packages</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900">Status</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                            {items.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50 ${draggedItemId === item.id ? 'opacity-50' : ''}`}
                      draggable
                      onDragStart={(e) => {
                        setDraggedItemId(item.id);
                        setDraggedCategoryId(category.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', item.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedCategoryId === category.id) e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedCategoryId !== category.id) return;
                        const targetId = item.id;
                        if (draggedItemId && draggedCategoryId === category.id) {
                          handleReorderItems(items, category.id, draggedItemId, targetId);
                        }
                        setDraggedItemId(null);
                        setDraggedCategoryId(null);
                      }}
                      onDragEnd={() => {
                        setDraggedItemId(null);
                        setDraggedCategoryId(null);
                      }}
                      data-item-id={item.id}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 w-10">
                        <span className="inline-flex cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600" title="Drag to reorder">
                          <GripVertical className="h-5 w-5" />
                        </span>
                      </td>
                                <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{item.name}</div>
                                </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                                  {item.variations?.length || 0} package{item.variations?.length !== 1 ? 's' : ''}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col space-y-1">
                                    {item.popular && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">
                                        Popular
                                      </span>
                                    )}
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      item.available 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {item.available ? 'Available' : 'Unavailable'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => handleEditItem(item)}
                                      disabled={isProcessing}
                                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors duration-200"
                                      title="Edit"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDuplicateItem(item.id)}
                                      disabled={isProcessing}
                                      className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                                      title="Duplicate Game Item"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      disabled={isProcessing}
                                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        )}
                      </div>
                      );
                    })}
                    
                    {/* Un categorized Items */}
                    {uncategorizedItems.length > 0 && (() => {
                      const isCollapsed = collapsedCategories['__uncategorized__'] || false;
                      return (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div 
                          className="bg-gray-100 px-6 py-3 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors"
                          onClick={() => setCollapsedCategories(prev => ({ ...prev, '__uncategorized__': !prev['__uncategorized__'] }))}
                        >
                          <h3 className="text-xs font-semibold text-gray-900">Uncategorized</h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCollapsedCategories(prev => ({ ...prev, '__uncategorized__': !prev['__uncategorized__'] }));
                            }}
                            className="p-1 hover:bg-gray-300 rounded transition-colors"
                          >
                            {isCollapsed ? (
                              <ChevronDown className="h-5 w-5 text-gray-600" />
                            ) : (
                              <ChevronUp className="h-5 w-5 text-gray-600" />
                            )}
                          </button>
                        </div>
                        {!isCollapsed && (
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900">Select</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900">Sort</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900">Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900">Packages</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900">Status</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {uncategorizedItems.map((item) => (
                              <tr
                                key={item.id}
                                className={`hover:bg-gray-50 ${draggedItemId === item.id ? 'opacity-50' : ''}`}
                                draggable
                                onDragStart={(e) => {
                                  setDraggedItemId(item.id);
                                  setDraggedCategoryId('__uncategorized__');
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.dataTransfer.setData('text/plain', item.id);
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  if (draggedCategoryId === '__uncategorized__') e.dataTransfer.dropEffect = 'move';
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (draggedCategoryId !== '__uncategorized__') return;
                                  const targetId = item.id;
                                  if (draggedItemId && draggedCategoryId === '__uncategorized__') {
                                    handleReorderItems(uncategorizedItems, '__uncategorized__', draggedItemId, targetId);
                                  }
                                  setDraggedItemId(null);
                                  setDraggedCategoryId(null);
                                }}
                                onDragEnd={() => {
                                  setDraggedItemId(null);
                                  setDraggedCategoryId(null);
                                }}
                                data-item-id={item.id}
                              >
                                <td className="px-6 py-4">
                                  <input
                                    type="checkbox"
                                    checked={selectedItems.includes(item.id)}
                                    onChange={() => handleSelectItem(item.id)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-6 py-4 w-10">
                                  <span className="inline-flex cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600" title="Drag to reorder">
                                    <GripVertical className="h-5 w-5" />
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-medium text-gray-900">{item.name}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                                  {item.variations?.length || 0} package{item.variations?.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-1">
                          {item.popular && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">
                              Popular
                            </span>
                          )}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.available 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.available ? 'Available' : 'Unavailable'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditItem(item)}
                            disabled={isProcessing}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors duration-200"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicateItem(item.id)}
                            disabled={isProcessing}
                            className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                            title="Duplicate Game Item"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={isProcessing}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                        )}
                      </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>

            {/* Mobile Card View - Grouped by Category */}
            <div className="md:hidden">
              {(() => {
                // Group menu items by category
                const groupedByCategory = categories.reduce((acc, category) => {
                  const categoryItems = menuItems
                    .filter(item => item.category === category.id)
                    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                  if (categoryItems.length > 0) {
                    acc[category.id] = {
                      category,
                      items: categoryItems
                    };
                  }
                  return acc;
                }, {} as Record<string, { category: typeof categories[0], items: MenuItem[] }>);

                // Items without category
                const uncategorizedItems = menuItems
                  .filter(item => !categories.find(cat => cat.id === item.category))
                  .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

                return (
                  <div className="space-y-4">
                    {/* Grouped by Category */}
                    {Object.values(groupedByCategory).map(({ category, items }) => {
                      const isCollapsed = collapsedCategories[category.id] || false;
                      return (
                      <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div 
                          className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors"
                          onClick={() => setCollapsedCategories(prev => ({ ...prev, [category.id]: !prev[category.id] }))}
                        >
                          <h3 className="text-xs font-semibold text-gray-900">{category.name}</h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCollapsedCategories(prev => ({ ...prev, [category.id]: !prev[category.id] }));
                            }}
                            className="p-1 hover:bg-gray-300 rounded transition-colors"
                          >
                            {isCollapsed ? (
                              <ChevronDown className="h-4 w-4 text-gray-600" />
                            ) : (
                              <ChevronUp className="h-4 w-4 text-gray-600" />
                            )}
                          </button>
                        </div>
                        {!isCollapsed && items.map((item) => (
                <div
                  key={item.id}
                  data-droppable="game-item"
                  data-drop-item-id={item.id}
                  data-drop-category-id={category.id}
                  className={`p-3 md:p-4 border-b border-gray-200 last:border-b-0 ${selectedItems.includes(item.id) ? 'bg-blue-50 border-blue-200' : ''} ${draggedItemId === item.id ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2 md:mb-3">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-4 h-4 md:w-5 md:h-5"
                      />
                      <span className="text-xs text-gray-600">Select</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <span
                        role="button"
                        tabIndex={0}
                        draggable
                        onDragStart={(e) => {
                          setDraggedItemId(item.id);
                          setDraggedCategoryId(category.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', item.id);
                        }}
                        onDragEnd={() => { setDraggedItemId(null); setDraggedCategoryId(null); }}
                        onTouchStart={(e) => {
                          if (e.changedTouches.length === 0) return;
                          const touch = e.changedTouches[0];
                          setDraggedItemId(item.id);
                          setDraggedCategoryId(category.id);
                          itemsListDraggedRef.current = { itemId: item.id, categoryId: category.id, items };
                          setItemsListTouchDragPreview({ label: item.name, x: touch.clientX, y: touch.clientY });
                          const onTouchMove = (ev: TouchEvent) => {
                            ev.preventDefault();
                            const t = ev.changedTouches[0] || ev.touches[ev.touches.length - 1];
                            if (t) setItemsListTouchDragPreview(prev => prev ? { ...prev, x: t.clientX, y: t.clientY } : null);
                          };
                          const onTouchEnd = (ev: TouchEvent) => {
                            const t = ev.changedTouches[0];
                            if (t) {
                              const target = getTouchDropTargetGameItem(t.clientX, t.clientY);
                              const ref = itemsListDraggedRef.current;
                              if (target && ref && target.categoryId === ref.categoryId && target.itemId !== ref.itemId) {
                                handleReorderItems(ref.items, ref.categoryId, ref.itemId, target.itemId);
                              }
                            }
                            document.removeEventListener('touchmove', onTouchMove, { capture: true });
                            document.removeEventListener('touchend', onTouchEnd, { capture: true });
                            document.removeEventListener('touchcancel', onTouchEnd, { capture: true });
                            setDraggedItemId(null);
                            setDraggedCategoryId(null);
                            setItemsListTouchDragPreview(null);
                            itemsListDraggedRef.current = null;
                          };
                          document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
                          document.addEventListener('touchend', onTouchEnd, { capture: true });
                          document.addEventListener('touchcancel', onTouchEnd, { capture: true });
                        }}
                        className="inline-flex cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0 p-1 touch-manipulation"
                        title="Drag to reorder"
                      >
                        <GripVertical className="h-5 w-5" />
                      </span>
                      <button
                        onClick={() => handleEditItem(item)}
                        disabled={isProcessing}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors duration-200"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicateItem(item.id)}
                        disabled={isProcessing}
                        className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                        title="Duplicate Game Item"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={isProcessing}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-start justify-between mb-2 md:mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-medium text-gray-900 truncate">{item.name}</h3>
                      <div className="mt-1 text-xs space-y-1">
                    <div>
                      <span className="text-gray-500">Category:</span>
                      <span className="ml-1 text-gray-900">
                        {categories.find(cat => cat.id === item.category)?.name}
                      </span>
                    </div>
                    <div>
                          <span className="text-gray-500">Packages:</span>
                      <span className="ml-1 text-gray-900">{item.variations?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                    </div>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center space-x-2">
                      {item.popular && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">
                          Popular
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.available 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.available ? 'Available' : 'Unavailable'}
                      </span>
                  </div>
                  </div>
                </div>
              ))}
                      </div>
                      );
                    })}
                    
                    {/* Uncategorized Items */}
                    {uncategorizedItems.length > 0 && (() => {
                      const isCollapsed = collapsedCategories['__uncategorized__'] || false;
                      return (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div 
                          className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors"
                          onClick={() => setCollapsedCategories(prev => ({ ...prev, '__uncategorized__': !prev['__uncategorized__'] }))}
                        >
                          <h3 className="text-xs font-semibold text-gray-900">Uncategorized</h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCollapsedCategories(prev => ({ ...prev, '__uncategorized__': !prev['__uncategorized__'] }));
                            }}
                            className="p-1 hover:bg-gray-300 rounded transition-colors"
                          >
                            {isCollapsed ? (
                              <ChevronDown className="h-4 w-4 text-gray-600" />
                            ) : (
                              <ChevronUp className="h-4 w-4 text-gray-600" />
                            )}
                          </button>
                        </div>
                        {!isCollapsed && uncategorizedItems.map((item) => (
                          <div
                            key={item.id}
                            data-droppable="game-item"
                            data-drop-item-id={item.id}
                            data-drop-category-id="__uncategorized__"
                            className={`p-4 border-b border-gray-200 last:border-b-0 ${selectedItems.includes(item.id) ? 'bg-blue-50' : ''} ${draggedItemId === item.id ? 'opacity-50' : ''}`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <label className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={selectedItems.includes(item.id)}
                                  onChange={() => handleSelectItem(item.id)}
                                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span className="text-xs text-gray-600">Select</span>
                              </label>
                              <div className="flex items-center space-x-2">
                                <span
                                  role="button"
                                  tabIndex={0}
                                  draggable
                                  onDragStart={(e) => {
                                    setDraggedItemId(item.id);
                                    setDraggedCategoryId('__uncategorized__');
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', item.id);
                                  }}
                                  onDragEnd={() => { setDraggedItemId(null); setDraggedCategoryId(null); }}
                                  onTouchStart={(e) => {
                                    if (e.changedTouches.length === 0) return;
                                    const touch = e.changedTouches[0];
                                    setDraggedItemId(item.id);
                                    setDraggedCategoryId('__uncategorized__');
                                    itemsListDraggedRef.current = { itemId: item.id, categoryId: '__uncategorized__', items: uncategorizedItems };
                                    setItemsListTouchDragPreview({ label: item.name, x: touch.clientX, y: touch.clientY });
                                    const onTouchMove = (ev: TouchEvent) => {
                                      ev.preventDefault();
                                      const t = ev.changedTouches[0] || ev.touches[ev.touches.length - 1];
                                      if (t) setItemsListTouchDragPreview(prev => prev ? { ...prev, x: t.clientX, y: t.clientY } : null);
                                    };
                                    const onTouchEnd = (ev: TouchEvent) => {
                                      const t = ev.changedTouches[0];
                                      if (t) {
                                        const target = getTouchDropTargetGameItem(t.clientX, t.clientY);
                                        const ref = itemsListDraggedRef.current;
                                        if (target && ref && target.categoryId === ref.categoryId && target.itemId !== ref.itemId) {
                                          handleReorderItems(ref.items, ref.categoryId, ref.itemId, target.itemId);
                                        }
                                      }
                                      document.removeEventListener('touchmove', onTouchMove, { capture: true });
                                      document.removeEventListener('touchend', onTouchEnd, { capture: true });
                                      document.removeEventListener('touchcancel', onTouchEnd, { capture: true });
                                      setDraggedItemId(null);
                                      setDraggedCategoryId(null);
                                      setItemsListTouchDragPreview(null);
                                      itemsListDraggedRef.current = null;
                                    };
                                    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
                                    document.addEventListener('touchend', onTouchEnd, { capture: true });
                                    document.addEventListener('touchcancel', onTouchEnd, { capture: true });
                                  }}
                                  className="inline-flex cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0 p-1 touch-manipulation"
                                  title="Drag to reorder"
                                >
                                  <GripVertical className="h-5 w-5" />
                                </span>
                                <button
                                  onClick={() => handleEditItem(item)}
                                  disabled={isProcessing}
                                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors duration-200"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDuplicateItem(item.id)}
                                  disabled={isProcessing}
                                  className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                                  title="Duplicate Game Item"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  disabled={isProcessing}
                                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
                                <div className="mt-1 text-xs space-y-1">
                                  <div>
                                    <span className="text-gray-500">Category:</span>
                                    <span className="ml-1 text-gray-900">
                                      {categories.find(cat => cat.id === item.category)?.name}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Packages:</span>
                                    <span className="ml-1 text-gray-900">{item.variations?.length || 0}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center space-x-2">
                      {item.popular && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">
                          Popular
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.available 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        {/* Touch drag preview for mobile - follows finger when reordering game items */}
        {itemsListTouchDragPreview && (
          <div
            className="fixed z-[9999] pointer-events-none touch-none"
            style={{
              left: itemsListTouchDragPreview.x,
              top: itemsListTouchDragPreview.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="px-4 py-2.5 rounded-lg shadow-lg border-2 border-gray-200 bg-white text-gray-900 text-sm font-medium whitespace-nowrap max-w-[200px] truncate">
              {itemsListTouchDragPreview.label}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Categories View
  if (currentView === 'categories') {
    return <CategoryManager onBack={() => setCurrentView('dashboard')} />;
  }

  // Members View
  if (currentView === 'members') {
    return <MemberManager onBack={() => setCurrentView('dashboard')} />;
  }

  // Payment Methods View
  if (currentView === 'payments') {
    return <PaymentMethodManager onBack={() => setCurrentView('dashboard')} />;
  }

  // Site Settings View
  if (currentView === 'settings') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-40 bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="text-gray-600 hover:text-black transition-colors duration-200"
                  aria-label="Back to dashboard"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-black">Site Settings</h1>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <SiteSettingsManager onTestNotificationSound={playTestNotificationSound} />
        </div>
      </div>
    );
  }

  // Orders View
  if (currentView === 'orders') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-40 bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="text-gray-600 hover:text-black transition-colors duration-200"
                  aria-label="Back to dashboard"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-black">
                  {ordersTabFilter === 'order_via_messenger' ? 'Order via Messenger' : 'Orders'}
                </h1>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <OrderManager onOrderFilterChange={setOrdersTabFilter} />
        </div>
      </div>
    );
  }


  // Dashboard View
  return (
    <div className="min-h-screen bg-gray-50" onClick={() => handleFirstInteraction()}>
      <div className="sticky top-0 z-40 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-black">Admin</h1>
              <button
                onClick={async () => {
                  try {
                    await updateSiteSetting('store_closed', storeClosed ? 'false' : 'true');
                    await refetchSiteSettings();
                  } catch (e) {
                    console.error('Failed to toggle store closed:', e);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors duration-200 ${
                  storeClosed
                    ? 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200'
                    : 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200'
                }`}
                title={storeClosed ? 'Click to open customer page' : 'Click to close customer page'}
              >
                Customer page: {storeClosed ? 'Closed' : 'Open'}
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/"
                className="text-gray-600 hover:text-black transition-colors duration-200"
              >
                View Website
              </a>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-black transition-colors duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center">
              <div className="mb-2 md:mb-0">
                <Gamepad2 className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
              </div>
              <div className="md:ml-4">
                <p className="text-xs font-medium text-gray-600">Total Games</p>
                <p className="text-xs font-semibold text-gray-900">{totalItems}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center">
              <div className="mb-2 md:mb-0">
                  <Clock className="h-6 w-6 md:h-8 md:w-8 text-emerald-600" />
              </div>
              <div className="md:ml-4">
                <p className="text-xs font-medium text-gray-600">Pending Orders</p>
                <p className="text-xs font-semibold text-gray-900">{availableItems}</p>
                {orderOption !== 'place_order' && (
                  <p className="text-[10px] text-amber-600 mt-0.5">Enable &quot;Place Order&quot; in Site Settings for sound & badge</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center">
              <div className="mb-2 md:mb-0">
                  <Star className="h-6 w-6 md:h-8 md:w-8 text-amber-500" />
              </div>
              <div className="md:ml-4">
                <p className="text-xs font-medium text-gray-600">Popular Items</p>
                <p className="text-xs font-semibold text-gray-900">{popularItems}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center">
              <div className="mb-2 md:mb-0">
                  <Activity className="h-6 w-6 md:h-8 md:w-8 text-indigo-600" />
              </div>
              <div className="md:ml-4">
                <p className="text-xs font-medium text-gray-600">Active</p>
                <p className="text-xs font-semibold text-gray-900">Online</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="space-y-3">
              <button
                onClick={handleAddItem}
                className="w-full flex items-center space-x-3 p-2 md:p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <FilePlus className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                <span className="text-xs font-medium text-gray-900">Add New Game Item</span>
              </button>
              <button
                onClick={() => setCurrentView('items')}
                className="w-full flex items-center space-x-3 p-2 md:p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <List className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                <span className="text-xs font-medium text-gray-900">Manage Game Items</span>
              </button>
              <button
                onClick={() => setCurrentView('categories')}
                className="w-full flex items-center space-x-3 p-2 md:p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <FolderTree className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                <span className="text-xs font-medium text-gray-900">Manage Categories</span>
              </button>
              <button
                onClick={() => setCurrentView('members')}
                className="w-full flex items-center space-x-3 p-2 md:p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <Users className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                <span className="text-xs font-medium text-gray-900">Manage Members</span>
              </button>
              <button
                onClick={() => setCurrentView('payments')}
                className="w-full flex items-center space-x-3 p-2 md:p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <Wallet className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                <span className="text-xs font-medium text-gray-900">Payment Methods</span>
              </button>
              <button
                onClick={() => setCurrentView('orders')}
                className="w-full flex items-center space-x-3 p-2 md:p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200 relative"
              >
                <ShoppingBag className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                <span className="text-xs font-medium text-gray-900">Orders</span>
                {orderOption === 'place_order' && (() => {
                  const unread = Math.max(0, pendingOrders - lastSeenPendingCount);
                  return unread > 0 ? (
                    <span className="ml-auto flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  ) : null;
                })()}
              </button>
              <button
                onClick={() => setCurrentView('settings')}
                className="w-full flex items-center space-x-3 p-2 md:p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <Cog className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                <span className="text-xs font-medium text-gray-900">Site Settings</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <h3 className="text-xs font-playfair font-medium text-black mb-4">Categories Overview</h3>
            <div className="space-y-3">
              {categoryCounts.map((category) => (
                <div key={category.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">{category.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">{category.count} items</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;