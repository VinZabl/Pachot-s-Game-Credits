import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Upload, HelpCircle, Copy, Download, Plus, Trash2, MessageCircle, Check, Receipt, ArrowLeft, ChevronUp, ChevronDown, Clock, ShoppingCart } from 'lucide-react';
import { MenuItem, Variation, CartItem, Member } from '../types';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { useImageUpload } from '../hooks/useImageUpload';
import { useOrders } from '../hooks/useOrders';
import { useOrderStatus } from '../contexts/OrderStatusContext';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { supabase } from '../lib/supabase';

interface GameItemOrderModalProps {
  item: MenuItem;
  isOpen: boolean;
  onClose: () => void;
  onOrderPlaced?: () => void;
  currentMember?: Member | null;
}

const GameItemOrderModal: React.FC<GameItemOrderModalProps> = ({
  item,
  isOpen,
  onClose,
  onOrderPlaced,
  currentMember,
}) => {
  const { paymentMethods } = usePaymentMethods();
  const { uploadImage, uploading: uploadingReceipt } = useImageUpload();
  const { createOrder } = useOrders();
  const { setOrderPlaced, openOrderStatusModal } = useOrderStatus();
  const { siteSettings } = useSiteSettings();
  const orderOption = siteSettings?.order_option || 'place_order';

  // Navigation page state: 'region_selection' | 'details' | 'order_details' | 'payment' | 'submitted'
  const [activePage, setActivePage] = useState<'region_selection' | 'details' | 'order_details' | 'payment' | 'submitted'>(() => {
    return (item.regions && item.regions.length > 0) ? 'region_selection' : 'details';
  });
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Player accounts data: array of custom fields
  const [accounts, setAccounts] = useState<Record<string, string>[]>([{}]);

  // Selections state: maps account index to Record<variationId, quantity>
  const [selections, setSelections] = useState<Record<number, Record<string, number>>>({ 0: {} });

  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showIdHelp, setShowIdHelp] = useState(false);
  const [copiedAccountName, setCopiedAccountName] = useState(false);
  const [copiedAccountNumber, setCopiedAccountNumber] = useState(false);
  const [copiedOrderMessage, setCopiedOrderMessage] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState<string | null>(null);
  const [showQrFullscreen, setShowQrFullscreen] = useState(false);
  const [showGuideFullscreen, setShowGuideFullscreen] = useState(false);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('');
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [activeSelectingAccountIdx, setActiveSelectingAccountIdx] = useState<number | null>(null);
  const [hasCopiedForm, setHasCopiedForm] = useState(false);

  const isMessengerBrowser = useMemo(
    () => /FBAN|FBAV/i.test(navigator.userAgent) || /FB_IAB/i.test(navigator.userAgent),
    []
  );

  const hasCustomFields = item.customFields && item.customFields.length > 0;
  const firstFieldLabel = hasCustomFields ? item.customFields![0].label : 'Account';

  // Filter variations by selected region
  const filteredVariations = useMemo(() => {
    if (!item.variations) return [];
    if (!item.regions || item.regions.length === 0 || !selectedRegion) {
      return item.variations;
    }
    return item.variations.filter((v) => !v.region || v.region === selectedRegion);
  }, [item.variations, item.regions, selectedRegion]);

  const categories = useMemo(() => {
    if (filteredVariations.length === 0) return [];
    const cats = new Set<string>();
    filteredVariations.forEach((v) => {
      if (v.category) cats.add(v.category.trim());
    });
    const list = Array.from(cats);
    return list.length > 0 ? ['ALL', ...list] : [];
  }, [filteredVariations]);

  // Set default category tab
  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryTab) {
      setSelectedCategoryTab(categories[0]);
    }
  }, [categories, selectedCategoryTab]);

  // Reset form copy state when selections, accounts, payment, or page changes
  useEffect(() => {
    setHasCopiedForm(false);
  }, [selections, accounts, paymentMethodId, activePage]);

  // Auto-select GCash by default
  useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethodId) {
      const gcashMethod = paymentMethods.find((m) => m.name.toLowerCase().includes('gcash'));
      if (gcashMethod) {
        setPaymentMethodId(gcashMethod.id);
      } else {
        setPaymentMethodId(paymentMethods[0].id);
      }
    }
  }, [paymentMethods, paymentMethodId]);

  // Initialize and Reset modal states on open or item changes
  useEffect(() => {
    if (isOpen) {
      if (item.regions && item.regions.length > 0) {
        setActivePage('region_selection');
        setSelectedRegion(null);
      } else {
        setActivePage('details');
        setSelectedRegion(null);
      }
    } else {
      setSelectedRegion(null);
    }
  }, [isOpen, item]);

  // Show guide modal automatically on entering details page if guide image exists
  useEffect(() => {
    if (isOpen && activePage === 'details') {
      if (item.regions && item.regions.length > 0 && !selectedRegion) {
        return;
      }
      if (item.guide_image_url) {
        setShowGuideFullscreen(true);
      }
    } else if (!isOpen) {
      setShowGuideFullscreen(false);
    }
  }, [isOpen, activePage, item.guide_image_url, selectedRegion]);

  const selectedPaymentMethod = paymentMethods.find((m) => m.id === paymentMethodId);

  const getDiscountedPrice = (basePrice: number, variation?: Variation): number => {
    if (currentMember && variation) {
      const isReseller = currentMember.user_type === 'reseller';
      if (isReseller && variation.reseller_price !== undefined) return variation.reseller_price;
      if (!isReseller && currentMember.user_type === 'end_user' && variation.member_price !== undefined) return variation.member_price;
    }
    if (item.isOnDiscount && item.discountPercentage !== undefined) {
      return basePrice * (1 - item.discountPercentage);
    }
    return basePrice;
  };



  // Calculate total price of all selections across all accounts
  const totalPrice = useMemo(() => {
    let sum = 0;
    Object.entries(selections).forEach(([accIdxStr, vMap]) => {
      const accIdx = parseInt(accIdxStr, 10);
      if (!accounts[accIdx]) return;
      Object.entries(vMap).forEach(([vId, qty]) => {
        const v = item.variations?.find((x) => x.id === vId);
        if (v) {
          sum += getDiscountedPrice(v.price, v) * qty;
        }
      });
    });
    return sum;
  }, [selections, accounts, item.variations, currentMember]);

  // Check if player details form is filled
  const isDetailsValid = useMemo(() => {
    if (!hasCustomFields) return true;
    return accounts.every((acc) => {
      return item.customFields!.every((f) => !f.required || !!acc[f.key]?.trim());
    });
  }, [accounts, hasCustomFields, item.customFields]);

  // Check if at least one product is selected
  const isProductsSelected = useMemo(() => {
    return Object.values(selections).some((vMap) => {
      return Object.values(vMap).some((qty) => qty > 0);
    });
  }, [selections]);

  // Form validity for submission
  const isFormValid = useMemo(() => {
    if (!paymentMethodId) return false;
    if (orderOption === 'place_order' && !receiptImageUrl) return false;
    return isDetailsValid && isProductsSelected;
  }, [paymentMethodId, receiptImageUrl, isDetailsValid, isProductsSelected, orderOption]);

  const handleCopyAccountName = async (accountName: string) => {
    try {
      await navigator.clipboard.writeText(accountName);
      setCopiedAccountName(true);
      setTimeout(() => setCopiedAccountName(false), 2000);
    } catch (err) {
      console.error('Failed to copy account name:', err);
    }
  };

  const handleCopyAccountNumber = async (accountNumber: string) => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopiedAccountNumber(true);
      setTimeout(() => setCopiedAccountNumber(false), 2000);
    } catch (err) {
      console.error('Failed to copy account number:', err);
    }
  };

  const addAccount = () => {
    const nextIdx = accounts.length;
    setSelections((prev) => ({ ...prev, [nextIdx]: {} }));
    setAccounts((prev) => [...prev, {}]);
  };

  const removeAccount = (idx: number) => {
    setAccounts((prev) => prev.filter((_, i) => i !== idx));
    setSelections((prev) => {
      const next = { ...prev };
      delete next[idx];
      // Re-key remaining
      const rekeyed: Record<number, Record<string, number>> = {};
      Object.keys(next).forEach((k) => {
        const numericKey = parseInt(k, 10);
        if (numericKey > idx) {
          rekeyed[numericKey - 1] = next[numericKey];
        } else if (numericKey < idx) {
          rekeyed[numericKey] = next[numericKey];
        }
      });
      return rekeyed;
    });
  };

  const updateAccountField = (accIdx: number, key: string, value: string) => {
    setAccounts((prev) => {
      const next = [...prev];
      next[accIdx] = { ...next[accIdx], [key]: value };
      return next;
    });
  };

  const handleProductToggle = (accIdx: number, variationId: string, checked: boolean) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (!next[accIdx]) next[accIdx] = {};
      if (checked) {
        next[accIdx][variationId] = 1;
      } else {
        delete next[accIdx][variationId];
      }
      return next;
    });
  };

  const handleQuantityChange = (accIdx: number, variationId: string, delta: number) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (!next[accIdx]) next[accIdx] = {};
      const currentQty = next[accIdx][variationId] || 0;
      const nextQty = Math.max(1, currentQty + delta);
      next[accIdx][variationId] = nextQty;
      return next;
    });
  };

  const handleReceiptUpload = async (file: File) => {
    try {
      setReceiptError(null);
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setReceiptPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      const url = await uploadImage(file, 'payment-receipts');
      setReceiptImageUrl(url);
    } catch (err) {
      console.error('Error uploading receipt:', err);
      setReceiptError(err instanceof Error ? err.message : 'Failed to upload');
      setReceiptFile(null);
      setReceiptPreview(null);
    }
  };

  const handleReceiptRemove = () => {
    setReceiptFile(null);
    setReceiptImageUrl(null);
    setReceiptPreview(null);
    setReceiptError(null);
  };

  const getPhilippineDate = () => {
    const now = new Date();
    const ph = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    return {
      dateString: `${ph.getFullYear()}-${String(ph.getMonth() + 1).padStart(2, '0')}-${String(ph.getDate()).padStart(2, '0')}`,
      dayOfMonth: ph.getDate(),
    };
  };

  const generateInvoiceNumber = async (forceNew: boolean): Promise<string> => {
    const { dateString: todayStr, dayOfMonth } = getPhilippineDate();
    if (!forceNew && generatedInvoiceNumber) return generatedInvoiceNumber;
    try {
      const countSettingId = 'invoice_count';
      const dateSettingId = 'invoice_count_date';
      const { data: dateData } = await supabase.from('site_settings').select('value').eq('id', dateSettingId).maybeSingle();
      const { data: countData } = await supabase.from('site_settings').select('value').eq('id', countSettingId).maybeSingle();
      let currentCount = 0;
      const lastDate = dateData?.value || null;
      if (lastDate !== todayStr) {
        await supabase.from('site_settings').upsert({ id: countSettingId, value: '0', type: 'number', description: 'Invoice count' }, { onConflict: 'id' });
        await supabase.from('site_settings').upsert({ id: dateSettingId, value: todayStr, type: 'text', description: 'Invoice date' }, { onConflict: 'id' });
      } else {
        currentCount = countData?.value ? parseInt(countData.value, 10) : 0;
      }
      if (forceNew) currentCount += 1;
      else if (currentCount === 0) currentCount = 1;
      const invoiceNumber = `PGC1M${dayOfMonth}D${currentCount}`;
      await supabase.from('site_settings').upsert({ id: countSettingId, value: currentCount.toString(), type: 'number', description: 'Invoice count' }, { onConflict: 'id' });
      setGeneratedInvoiceNumber(invoiceNumber);
      return invoiceNumber;
    } catch {
      return `PGC1M${getPhilippineDate().dayOfMonth}D1`;
    }
  };

  const buildOrderMessage = (): string => {
    const lines: string[] = [];
    let grandTotal = 0;
    accounts.forEach((acc, accIdx) => {
      lines.push(`GAME: ${item.name}`);
      if (selectedRegion) {
        lines.push(`REGION: ${selectedRegion.toUpperCase()}`);
      }
      
      if (hasCustomFields && item.customFields) {
        const ids: string[] = [];
        item.customFields.forEach((f) => {
          const v = acc[f.key];
          if (v) ids.push(v);
        });
        lines.push(`PLAYER ID: ${ids.join(' ')}`);
      }

      const accSelections = selections[accIdx] || {};
      const orderNames: string[] = [];
      let userTotal = 0;
      Object.entries(accSelections).forEach(([vId, qty]) => {
        const v = item.variations?.find((x) => x.id === vId);
        if (v) {
          const price = getDiscountedPrice(v.price, v);
          userTotal += price * qty;
          orderNames.push(`${v.name} (₱${price.toFixed(0)}) ${qty}x`);
        }
      });
      grandTotal += userTotal;
      lines.push(`ORDER:\n${orderNames.join('\n')}`);
      
      const paymentName = selectedPaymentMethod?.name || 'GCASH';
      lines.push(`PAYMENT: ${paymentName.replace(/ payment/i, '').toUpperCase()}`);
      
      if (accIdx < accounts.length - 1) {
        lines.push('---------------------------');
      }
    });
    
    lines.push(`\nTOTAL: ₱${grandTotal.toFixed(0)}`);
    return lines.join('\n');
  };

  const saveOrderAndGetMessage = async (): Promise<string> => {
    if (!selectedPaymentMethod) throw new Error('Please select a payment method');
    
    const invoiceNumber = savedOrderId && generatedInvoiceNumber
      ? generatedInvoiceNumber
      : await generateInvoiceNumber(true);

    const orderItems: CartItem[] = [];
    const multipleAccountsData: { game: string; package: string; fields: Record<string, string> }[] = [];

    accounts.forEach((acc, accIdx) => {
      const accSelections = selections[accIdx] || {};
      const fields: Record<string, string> = {};
      if (hasCustomFields && item.customFields) {
        item.customFields.forEach((f) => {
          const v = acc[f.key];
          if (v) fields[f.label] = v;
        });
      }

      Object.entries(accSelections).forEach(([vId, qty]) => {
        const v = item.variations?.find((x) => x.id === vId);
        if (!v) return;
        const unitP = getDiscountedPrice(v.price, v);
        
        multipleAccountsData.push({ 
          game: item.name, 
          package: v.name, 
          region: selectedRegion || undefined,
          fields 
        });

        for (let q = 0; q < qty; q++) {
          orderItems.push({
            ...item,
            id: `${item.id}:::CART:::${Date.now()}-${accIdx}-${vId}-${q}-${Math.random().toString(36).slice(2)}`,
            quantity: 1,
            selectedVariation: v,
            totalPrice: unitP,
          });
        }
      });
    });

    if (!savedOrderId) {
      const newOrder = await createOrder({
        order_items: orderItems,
        customer_info: multipleAccountsData,
        payment_method_id: selectedPaymentMethod.id,
        receipt_url: receiptImageUrl || '',
        total_price: totalPrice,
        member_id: currentMember?.id,
        order_option: 'order_via_messenger',
        invoice_number: invoiceNumber,
      });
      if (newOrder) setSavedOrderId(newOrder.id);
    }
    return buildOrderMessage();
  };

  const handleCopyOrderMessage = async () => {
    try {
      setIsPlacingOrder(true);
      setReceiptError(null);
      const message = await saveOrderAndGetMessage();
      const didCopy = await navigator.clipboard.writeText(message).then(() => true).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = message;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      });
      if (didCopy) {
        setCopiedOrderMessage(true);
        setHasCopiedForm(true);
        setTimeout(() => setCopiedOrderMessage(false), 2000);
      }
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : 'Failed to prepare order');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleCopySubmittedOrderDetails = async () => {
    try {
      const message = buildOrderMessage();
      const didCopy = await navigator.clipboard.writeText(message).then(() => true).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = message;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      });
      if (didCopy) {
        setCopiedOrderMessage(true);
        setTimeout(() => setCopiedOrderMessage(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy order details:', err);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedPaymentMethod || !receiptImageUrl) return;

    try {
      setIsPlacingOrder(true);
      setReceiptError(null);

      const orderItems: CartItem[] = [];
      const multipleAccountsData: { game: string; package: string; fields: Record<string, string> }[] = [];

      accounts.forEach((acc, accIdx) => {
        const accSelections = selections[accIdx] || {};
        const fields: Record<string, string> = {};
        if (hasCustomFields && item.customFields) {
          item.customFields.forEach((f) => {
            const v = acc[f.key];
            if (v) fields[f.label] = v;
          });
        }

        Object.entries(accSelections).forEach(([vId, qty]) => {
          const v = item.variations?.find((x) => x.id === vId);
          if (!v) return;
          const unitP = getDiscountedPrice(v.price, v);

          multipleAccountsData.push({ game: item.name, package: v.name, fields });

          for (let q = 0; q < qty; q++) {
            orderItems.push({
              ...item,
              id: `${item.id}:::CART:::${Date.now()}-${accIdx}-${vId}-${q}-${Math.random().toString(36).slice(2)}`,
              quantity: 1,
              selectedVariation: v,
              totalPrice: unitP,
            });
          }
        });
      });

      const invoiceNumber = await generateInvoiceNumber(true);

      const newOrder = await createOrder({
        order_items: orderItems,
        customer_info: multipleAccountsData,
        payment_method_id: selectedPaymentMethod.id,
        receipt_url: receiptImageUrl,
        total_price: totalPrice,
        member_id: currentMember?.id,
        order_option: 'place_order',
        invoice_number: invoiceNumber,
      });

      if (newOrder) {
        setOrderPlaced(newOrder.id);
        onOrderPlaced?.();
        handleClose();
      }
    } catch (err) {
      console.error('Error placing order:', err);
      setReceiptError('Failed to place order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleOpenMessenger = async () => {
    try {
      setIsPlacingOrder(true);
      setReceiptError(null);
      const message = await saveOrderAndGetMessage();
      const supportUrl = siteSettings?.footer_support_url || '';
      const m = supportUrl.match(/m\.me\/([^/?]+)/);
      const pageId = m ? m[1] : 'pachotsgamecredits';
      const messengerUrl = `https://m.me/${pageId}?text=${encodeURIComponent(message)}`;
      window.open(messengerUrl, '_blank');
      setActivePage('submitted');
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : 'Failed to open Messenger');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleBuyAgain = () => {
    setAccounts([{}]);
    setSelections({ 0: {} });
    setPaymentMethodId(null);
    setSavedOrderId(null);
    setGeneratedInvoiceNumber(null);
    handleReceiptRemove();
    setActivePage('details');
  };

  const handleClose = () => {
    onClose();
    setAccounts([{}]);
    setSelections({ 0: {} });
    setPaymentMethodId(null);
    setSavedOrderId(null);
    setGeneratedInvoiceNumber(null);
    handleReceiptRemove();
    setActivePage('details');
  };

  if (!isOpen) return null;

  // Determine active step circle representation (1, 2, 3)
  const getStepNumberState = (step: number) => {
    if (step === 1) {
      return activePage === 'details' ? 'active' : 'done';
    }
    if (step === 2) {
      if (activePage === 'details') return 'pending';
      return activePage === 'order_details' ? 'active' : 'done';
    }
    if (step === 3) {
      if (activePage === 'details' || activePage === 'order_details') return 'pending';
      return 'active';
    }
    return 'pending';
  };

  const PROGRESS_STEPS = [
    { num: 1, label: 'Details' },
    { num: 2, label: 'Order Details' },
    { num: 3, label: 'Payment' },
  ];

  return (
    <>
      <div
        id="game-item-order-modal"
        className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4"
        onClick={handleClose}
      >
        <div
          className="flex flex-col rounded-2xl w-full max-w-lg md:max-w-2xl max-h-[95vh] overflow-hidden shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, #161922 0%, #0d0d0d 100%)',
            border: '1px solid rgba(255, 105, 180, 0.25)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative flex-shrink-0 p-4 sm:p-5 flex flex-col gap-3 border-b border-gray-900">
            <div className="flex items-center justify-between">
              {((activePage !== 'region_selection' && activePage !== 'submitted' && (activePage !== 'details' || (item.regions && item.regions.length > 0))) || activeSelectingAccountIdx !== null) && (
                <button
                  onClick={() => {
                    if (activeSelectingAccountIdx !== null) {
                      setActiveSelectingAccountIdx(null);
                    } else if (activePage === 'details') {
                      if (item.regions && item.regions.length > 0) {
                        setActivePage('region_selection');
                      }
                    } else if (activePage === 'order_details') {
                      setActivePage('details');
                    } else if (activePage === 'payment') {
                      setActivePage('order_details');
                    }
                  }}
                  className="p-1 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
               <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
                 <h2 className="text-base sm:text-lg font-black text-pink-500 uppercase tracking-wide">
                   {activePage === 'submitted' ? '' : item.name.replace(/^[🟢\s]+/, '').trim()}
                 </h2>
                 {activePage === 'details' && item.subtitle && (
                    <span className="text-[10px] sm:text-[11px] text-pink-400/90 font-bold uppercase tracking-widest mt-0.5">
                      {item.subtitle}
                    </span>
                 )}
                 {activePage === 'details' && activeSelectingAccountIdx === null && item.description && (
                   <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1 leading-relaxed font-semibold max-w-xs sm:max-w-md">
                     {item.description}
                   </p>
                 )}
               </div>
              <button
                onClick={handleClose}
                className="p-1.5 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {activePage !== 'submitted' && activePage !== 'region_selection' && (
              <>
                {/* Processing Time Banner */}
                {activePage === 'details' && (
                  <div className="flex items-center justify-center gap-1.5 py-1 px-4 bg-gray-900/40 border border-gray-800/80 rounded-full text-[10px] sm:text-xs text-gray-400 max-w-xs mx-auto">
                    <Clock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span>Processing Time : 10m - 1hr</span>
                  </div>
                )}

                {/* Steps Progress Header */}
                <div className="flex items-center justify-between max-w-xs w-full mx-auto mt-2">
                  {PROGRESS_STEPS.map((step, idx) => {
                    const state = getStepNumberState(step.num);
                    const isLast = idx === PROGRESS_STEPS.length - 1;
                    return (
                      <React.Fragment key={step.num}>
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                            style={{
                              background: state === 'done'
                                ? '#ff007f'
                                : state === 'active'
                                ? 'transparent'
                                : 'transparent',
                              border: state === 'done'
                                ? '2px solid #ff007f'
                                : state === 'active'
                                ? '2px solid #ff007f'
                                : '2px solid rgba(255,255,255,0.12)',
                              color: state === 'done'
                                ? '#0d0d0d'
                                : state === 'active'
                                ? '#ff007f'
                                : 'rgba(255,255,255,0.25)',
                              boxShadow: state === 'active' ? '0 0 10px rgba(255,0,127,0.3)' : 'none',
                            }}
                          >
                            {state === 'done' ? <Check className="w-3.5 h-3.5 stroke-[3px]" /> : step.num}
                          </div>
                          <span
                            className="text-[9px] font-bold tracking-widest uppercase transition-colors duration-300"
                            style={{
                              color: state === 'done' || state === 'active'
                                ? '#ff007f'
                                : 'rgba(255,255,255,0.25)',
                            }}
                          >
                            {step.label}
                          </span>
                        </div>
                        {!isLast && (
                          <div
                            className="flex-1 h-0.5 mx-1 mb-4 transition-all duration-300"
                            style={{
                              background: state === 'done'
                                ? '#ff007f'
                                : 'rgba(255,255,255,0.08)',
                            }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* PAGE 0: REGION SELECTION */}
            {activePage === 'region_selection' && (
              <div className="flex-1 flex flex-col justify-center items-center p-5 space-y-6 overflow-y-auto">
                <div className="text-center space-y-2">
                  <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-white">
                    Select Your Region
                  </h3>
                  <p className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">
                    Please select your region to view the correct items, prices, and guide.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full max-w-sm sm:max-w-md">
                  {item.regions
                    ?.filter((region) => {
                      return item.variations?.some((v) => v.region === region.name);
                    })
                    .map((region) => (
                    <button
                      key={region.id}
                      onClick={() => {
                        setSelectedRegion(region.name);
                        setActivePage('details');
                      }}
                      className="w-full py-3 px-4 rounded-xl border border-gray-800 bg-[#0d0d0d] hover:border-pink-500/50 hover:bg-[#2c1524]/10 text-white font-extrabold uppercase tracking-widest text-xs sm:text-sm transition-all shadow-[0_0_8px_rgba(0,0,0,0.4)] flex items-center gap-2.5 group"
                    >
                      {region.guide_image_url && (
                        <img
                          src={region.guide_image_url}
                          alt=""
                          className="w-8 h-5 object-cover rounded border border-gray-800/80 flex-shrink-0"
                        />
                      )}
                      <div className="flex flex-col text-left min-w-0">
                        <span className="font-extrabold text-xs sm:text-sm text-white truncate">{region.name}</span>
                        {region.guide_text && (
                          <span className="text-[9px] sm:text-[10px] text-gray-400 font-medium normal-case tracking-normal mt-0.5 truncate">
                            {region.guide_text}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PAGE 1: PLAYER DETAILS & PRODUCT SELECTION */}
            {activePage === 'details' && (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {activeSelectingAccountIdx === null ? (
                  /* RENDER PLAYER DETAILS FORM LIST */
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
                    <div className="bg-[#161922]/90 border border-gray-800/80 rounded-xl p-4 sm:p-5 shadow-lg relative">
                      {/* Card Title Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#ff007f] shadow-[0_0_6px_#ff007f]"></span>
                          <h3 className="text-xs sm:text-sm font-extrabold tracking-widest uppercase text-white">
                            Player Details
                          </h3>
                        </div>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.guide_image_url) {
                                setShowGuideFullscreen(true);
                              } else {
                                  setShowIdHelp(!showIdHelp);
                              }
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-pink-500/30 rounded-lg text-[9px] font-bold text-pink-400 bg-pink-500/5 hover:bg-pink-500/10 hover:border-pink-500/50 transition-all cursor-pointer shadow-[0_0_8px_rgba(255,0,127,0.05)]"
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                            <span>Guide</span>
                          </button>
                        </div>
                      </div>

                      {/* Input Fields */}
                      <div className="space-y-4">
                        {accounts.map((acc, accIdx) => {
                          const accSelections = selections[accIdx] || {};
                          const selectedVariations = Object.entries(accSelections)
                            .map(([vId, qty]) => {
                              const v = item.variations?.find((x) => x.id === vId);
                              return v ? { variation: v, quantity: qty } : null;
                            })
                            .filter(Boolean) as Array<{ variation: Variation; quantity: number }>;

                          return (
                            <div key={accIdx} className="space-y-3 p-3.5 bg-black/30 border border-gray-900 rounded-lg relative">
                              {accounts.length > 1 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">
                                    {firstFieldLabel} #{accIdx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeAccount(accIdx)}
                                    className="p-1 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}

                              <div className="space-y-3">
                                {item.customFields?.map((field) => (
                                  <div key={field.key} className="space-y-1">
                                    <input
                                      type="text"
                                      placeholder={`Enter ${field.label}`}
                                      value={acc[field.key] || ''}
                                      onChange={(e) => updateAccountField(accIdx, field.key, e.target.value)}
                                      className="w-full bg-[#0d0d0d] border border-gray-800/80 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/60 focus:ring-1 focus:ring-pink-500/40 transition-all duration-200"
                                    />
                                  </div>
                                ))}
                              </div>

                              {/* Selected Products list below user ID */}
                              {selectedVariations.length > 0 && (
                                <div className="space-y-2 mt-3 p-2.5 bg-[#161922]/50 rounded-xl border border-gray-800/40">
                                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Selected Items:</p>
                                  <div className="space-y-1.5">
                                    {selectedVariations.map(({ variation, quantity }) => {
                                      const price = getDiscountedPrice(variation.price, variation);
                                      return (
                                        <div key={variation.id} className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-lg border border-gray-900">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-white truncate">{variation.name}</p>
                                            <p className="text-[10px] font-semibold text-[#ff007f]">{quantity}x — ₱{(price * quantity).toFixed(0)}</p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelections((prev) => {
                                                const next = { ...prev };
                                                if (next[accIdx]) {
                                                  const nextAcc = { ...next[accIdx] };
                                                  delete nextAcc[variation.id];
                                                  next[accIdx] = nextAcc;
                                                }
                                                return next;
                                              });
                                            }}
                                            className="p-1 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Select Product button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSelectingAccountIdx(accIdx);
                                }}
                                className={`w-full py-2.5 rounded-xl border border-[#ff007f]/30 hover:border-[#ff007f]/50 hover:bg-pink-500/5 text-[#ff007f] text-xs font-extrabold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 mt-2 ${
                                  selectedVariations.length === 0
                                    ? 'animate-pulse bg-[#ff007f]/10 shadow-[0_0_12px_rgba(255,0,127,0.2)] border-[#ff007f]/60'
                                    : ''
                                }`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                {selectedVariations.length > 0 ? 'Edit Products' : 'Select Product'}
                              </button>
                            </div>
                          );
                        })}

                        {showIdHelp && (
                          <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed bg-black/40 p-3 rounded-lg border border-gray-900">
                            To find your ID, tap your game avatar. Your User ID and Zone ID will be displayed on your profile. (e.g. ID: 12345678, Zone: 1234).
                          </p>
                        )}
                      </div>

                      {/* Add New Order Helper */}
                      <p className="text-[10px] sm:text-xs text-gray-400 italic text-center mt-4">
                        I-click ang <span className="font-bold text-white">"ADD NEW USER"</span> kung nais mong mag-top up ng ibang User ID.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* RENDER PRODUCTS SELECTION FOR activeSelectingAccountIdx */
                  <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    {/* Header (Non-scrollable Choose Products text & categories) */}
                    <div className="flex-shrink-0 p-4 sm:p-5 pb-2 border-b border-gray-900/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#ff007f] shadow-[0_0_6px_#ff007f]"></span>
                          <h3 className="text-xs sm:text-sm font-extrabold tracking-widest uppercase text-white">
                            Choose Products
                          </h3>
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-900/50 px-2.5 py-1 rounded-md border border-gray-800/40">
                          {firstFieldLabel} #{activeSelectingAccountIdx + 1}
                        </span>
                      </div>

                      {/* Category Tabs */}
                      {categories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pb-2">
                          {categories.map((catName) => (
                            <button
                              key={catName}
                              type="button"
                              onClick={() => setSelectedCategoryTab(catName)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 flex-shrink-0 ${
                                selectedCategoryTab === catName
                                  ? 'text-pink-500 border-pink-500 shadow-[0_0_8px_rgba(255,0,127,0.15)] bg-transparent'
                                  : 'text-gray-400 border-gray-800/80 hover:text-white bg-transparent'
                              }`}
                            >
                              {catName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Game Items Grid (Only Scrollable Area) */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 min-h-0">
                      <div className="space-y-3">
                        {(() => {
                          const accIdx = activeSelectingAccountIdx;
                          const accSelections = selections[accIdx] || {};
                          const renderVariations = (filteredVariations || []).filter(
                            (v) => selectedCategoryTab === 'ALL' || !v.category || v.category.trim() === selectedCategoryTab
                          );

                          if (renderVariations.length === 0) {
                            return (
                              <p className="text-center text-xs text-gray-500 py-8">No variations found in this category.</p>
                            );
                          }

                          const groups: Record<string, typeof renderVariations> = {};
                          if (selectedCategoryTab === 'ALL') {
                            renderVariations.forEach((v) => {
                              const cat = v.category?.trim() || 'Other';
                              if (!groups[cat]) groups[cat] = [];
                              groups[cat].push(v);
                            });
                          } else {
                            groups[''] = renderVariations;
                          }

                          return (
                            <div className="space-y-6">
                              {Object.entries(groups).map(([catName, vars]) => (
                                <div key={catName} className="space-y-3">
                                  {catName && (
                                    <div className="flex items-center gap-1.5 border-b border-gray-900 pb-1.5 px-1 mt-4 first:mt-0">
                                      <span className="text-[10px] font-extrabold text-pink-500 uppercase tracking-widest">
                                        {catName}
                                      </span>
                                    </div>
                                  )}
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {vars.map((v) => {
                                      const price = getDiscountedPrice(v.price, v);
                                      const isChecked = !!accSelections[v.id];
                                      const qty = accSelections[v.id] || 0;

                                      return (
                                        <div
                                          key={v.id}
                                          onClick={() => handleProductToggle(accIdx, v.id, !isChecked)}
                                          className={`relative rounded-xl border p-3 flex items-center gap-3 transition-all duration-200 bg-[#0d0d0d] cursor-pointer ${
                                            isChecked
                                              ? 'border-pink-500 bg-[#2c1524]/20'
                                              : 'border-gray-800/80 hover:border-pink-500/50'
                                          }`}
                                        >
                                          {/* Checkbox wrapper */}
                                          <div className="flex items-center justify-center w-5 h-5 rounded border border-gray-800 bg-transparent relative flex-shrink-0">
                                            {isChecked && (
                                              <div className="absolute inset-0 bg-[#ff007f] rounded flex items-center justify-center">
                                                <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />
                                              </div>
                                            )}
                                          </div>

                                          {/* Product info */}
                                          <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-xs sm:text-sm text-white truncate">
                                              {v.name}
                                            </p>
                                            {v.description && (
                                              <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed whitespace-pre-line">
                                                {v.description}
                                              </p>
                                            )}
                                            <p className="text-red-500 font-bold text-xs sm:text-sm mt-0.5">
                                              ₱{price.toFixed(0)}
                                            </p>
                                          </div>

                                          {/* Variation Badge */}
                                          {v.badge_text && !isChecked && (
                                            <div
                                              className="px-2 py-0.5 rounded border text-[7px] font-black uppercase tracking-widest flex-shrink-0"
                                              style={{
                                                borderColor: v.badge_color || '#ff007f',
                                                color: v.badge_color || '#ff007f',
                                                backgroundColor: 'rgba(255, 0, 127, 0.05)'
                                              }}
                                            >
                                              {v.badge_text}
                                            </div>
                                          )}

                                          {/* Quantity adjusters */}
                                          {isChecked && (
                                            <div 
                                              className="flex items-center gap-0 rounded-lg overflow-hidden border border-gray-800 bg-[#161922]/50 flex-shrink-0"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <button
                                                type="button"
                                                onClick={() => handleQuantityChange(accIdx, v.id, -1)}
                                                className="w-7 h-7 flex items-center justify-center bg-gray-900/60 hover:bg-pink-500/10 text-gray-400 hover:text-pink-500 font-bold text-sm border-r border-gray-800 transition-colors"
                                              >
                                                −
                                              </button>
                                              <span className="w-7 text-center text-xs font-black text-white">
                                                {qty}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => handleQuantityChange(accIdx, v.id, 1)}
                                                className="w-7 h-7 flex items-center justify-center bg-gray-900/60 hover:bg-pink-500/10 text-gray-400 hover:text-pink-500 font-bold text-sm border-l border-gray-800 transition-colors"
                                              >
                                                +
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PAGE 3: ORDER DETAILS */}
            {activePage === 'order_details' && (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
                  <div className="bg-[#161922]/90 border border-gray-800/80 rounded-xl p-4 sm:p-5 shadow-lg">
                    {/* Card Title */}
                    <h3 className="text-xs sm:text-sm font-extrabold tracking-widest uppercase text-[#ff007f] mb-4 pb-2 border-b border-pink-500/20">
                      Order Details
                    </h3>

                    {/* Summary Rows */}
                    <div className="space-y-5">
                      {accounts.map((acc, accIdx) => {
                        const accSelections = selections[accIdx] || {};
                        const selectedVariationsList = Object.entries(accSelections)
                          .map(([vId, qty]) => {
                            const v = item.variations?.find((x) => x.id === vId);
                            if (!v) return null;
                            const price = getDiscountedPrice(v.price, v);
                            return { name: v.name, qty, price };
                          })
                          .filter(Boolean) as Array<{ name: string; qty: number; price: number }>;

                        if (selectedVariationsList.length === 0) return null;

                        const ids: string[] = [];
                        if (hasCustomFields && item.customFields) {
                          item.customFields.forEach((f) => {
                            const v = acc[f.key];
                            if (v) ids.push(v);
                          });
                        }

                        const userTotal = selectedVariationsList.reduce((accSum, curr) => accSum + curr.price * curr.qty, 0);

                        return (
                          <div
                            key={accIdx}
                            className={`space-y-2 text-xs sm:text-sm font-medium ${
                              accIdx > 0 ? 'pt-4 border-t border-gray-800/60' : ''
                            }`}
                          >
                            {selectedRegion && (
                              <div className="grid grid-cols-3 gap-2">
                                <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs">Region:</span>
                                <span className="text-white col-span-2 font-semibold">{selectedRegion}</span>
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                              <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs">Player ID:</span>
                              <span className="text-white col-span-2 font-semibold">{ids.join(' ')}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs">Order:</span>
                              <div className="text-white col-span-2 flex flex-col gap-1">
                                {selectedVariationsList.map((sv, sIdx) => (
                                  <div key={sIdx} className="flex justify-between items-center">
                                    <span>{sv.name} {sv.qty}x</span>
                                    <span className="text-pink-400 font-bold">₱{(sv.price * sv.qty).toFixed(0)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-900/60">
                              <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs">TOTAL:</span>
                              <span className="text-pink-500 font-extrabold col-span-2 text-right">₱{userTotal.toFixed(0)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Overall Total */}
                    <div className="mt-5 pt-4 border-t border-pink-500/30 flex justify-between items-center">
                      <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-white">TOTAL:</span>
                      <span className="text-base sm:text-lg font-black text-pink-500">₱{totalPrice.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PAGE 4: PAYMENT DETAILS */}
            {activePage === 'payment' && (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
                  <div className="bg-[#161922]/90 border border-gray-800/80 rounded-xl p-4 sm:p-5 shadow-lg">
                     {/* Title Header */}
                     <div className="flex items-center justify-between mb-4">
                       <h3 className="text-xs sm:text-sm font-extrabold tracking-widest uppercase text-[#ff007f]">
                         Payment Details
                       </h3>
                     </div>

                    {/* Payment Icons Selector */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
                      {paymentMethods.map((method) => {
                        const isSelected = paymentMethodId === method.id;
                        return (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setPaymentMethodId(method.id)}
                            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg border flex items-center justify-center p-1.5 transition-all flex-shrink-0 ${
                              isSelected
                                ? 'border-pink-500 bg-[#2c1524]/20'
                                : 'border-gray-800 bg-transparent hover:border-pink-500/50'
                            }`}
                          >
                            {method.icon_url ? (
                              <img
                                src={method.icon_url}
                                alt={method.name}
                                className="w-full h-full object-contain rounded"
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-white uppercase truncate">{method.name}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Payment QR and Credentials details */}
                    {selectedPaymentMethod && (
                      <div className="space-y-4">
                        <div className="flex flex-row items-center gap-4 bg-black/30 p-4 border border-gray-900 rounded-xl">
                          {/* QR Code image wrapper */}
                          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                            {selectedPaymentMethod.qr_code_url ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setShowQrFullscreen(true)}
                                  className="w-28 h-28 rounded-xl flex items-center justify-center hover:opacity-95 transition-opacity bg-transparent p-0"
                                >
                                  <img
                                    src={selectedPaymentMethod.qr_code_url}
                                    alt="Scan QR"
                                    className="w-full h-full object-contain rounded-xl"
                                  />
                                </button>
                                <span className="text-[9px] font-extrabold tracking-wider uppercase text-pink-500/80">
                                  tap to view
                                </span>
                              </>
                            ) : (
                              <div className="w-28 h-28 bg-[#161922] border border-gray-800 rounded-xl flex items-center justify-center">
                                <span className="text-[10px] text-gray-500">No QR Code</span>
                              </div>
                            )}
                          </div>

                          {/* Copyable Fields */}
                          <div className="flex-1 w-full space-y-2 text-xs sm:text-sm font-semibold">
                            <p className="text-white text-xs sm:text-sm font-extrabold uppercase tracking-widest mb-2">
                              {selectedPaymentMethod.name.replace(/ payment/i, '')} Details
                            </p>

                            {selectedPaymentMethod.account_number && (
                              <div className="flex flex-col gap-1 text-left">
                                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider pl-1">Number:</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyAccountNumber(selectedPaymentMethod.account_number)}
                                  className="flex items-center justify-between w-full bg-[#0d0d0d] border border-gray-800 rounded-xl px-3.5 py-2.5 text-gray-300 hover:text-white"
                                >
                                  <span className="line-clamp-2 whitespace-normal break-words font-bold text-xs sm:text-sm text-white flex-1 text-left">
                                    {selectedPaymentMethod.account_number}
                                  </span>
                                  <Copy className="h-3.5 w-3.5 text-pink-500 flex-shrink-0 ml-2" />
                                </button>
                              </div>
                            )}

                            {selectedPaymentMethod.account_name && (
                              <div className="flex flex-col gap-1 text-left">
                                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider pl-1">Name:</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyAccountName(selectedPaymentMethod.account_name)}
                                  className="flex items-center justify-between w-full bg-[#0d0d0d] border border-gray-800 rounded-xl px-3.5 py-2.5 text-gray-300 hover:text-white"
                                >
                                  <span className="line-clamp-2 whitespace-normal break-words font-bold text-xs sm:text-sm text-white flex-1 text-left">
                                    {selectedPaymentMethod.account_name}
                                  </span>
                                  <Copy className="h-3.5 w-3.5 text-pink-500 flex-shrink-0 ml-2" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Row: Upload Receipt (left) and Total Payment (right) */}
                        {orderOption === 'place_order' ? (
                          <div className="grid grid-cols-2 gap-3 items-stretch">
                            {/* Left: Upload Receipt */}
                            <div className="bg-[#161922]/50 border border-gray-800/80 rounded-xl p-3 flex flex-col justify-center min-h-[90px]">
                              {!receiptPreview ? (
                                <label className="block border-2 border-dashed border-gray-800 rounded-lg p-2.5 text-center cursor-pointer hover:border-pink-500/50 hover:bg-white/5 transition-colors h-full flex flex-col items-center justify-center">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleReceiptUpload(f);
                                    }}
                                    className="hidden"
                                    disabled={uploadingReceipt}
                                  />
                                  {uploadingReceipt ? (
                                    <div className="text-[10px] sm:text-xs text-gray-500 animate-pulse">Uploading...</div>
                                  ) : (
                                    <div className="text-[10px] sm:text-xs text-gray-400 font-medium">Upload Receipt</div>
                                  )}
                                </label>
                              ) : (
                                <div className="flex items-center justify-between gap-2 p-2 bg-[#0d0d0d] border border-gray-800 rounded-lg h-full">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <img src={receiptPreview} alt="Receipt" className="w-8 h-8 object-cover rounded" />
                                    <span className="text-[9px] text-gray-300 truncate max-w-[50px]">{receiptFile?.name}</span>
                                  </div>
                                  <button type="button" onClick={handleReceiptRemove} className="p-1 hover:bg-red-500/10 text-red-500 rounded flex-shrink-0">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Right: Total Payment */}
                            <div className="flex flex-col justify-center items-center bg-[#2c1524]/20 border border-[#ff007f]/30 rounded-xl p-3 min-h-[90px] text-center">
                              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-pink-500">
                                Total Payment
                              </span>
                              <span className="text-lg sm:text-xl font-black text-pink-500 mt-1">
                                ₱{totalPrice.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          /* Non place_order (messenger) just displays total payment full width */
                          <div className="flex items-center justify-between bg-[#2c1524]/20 border border-[#ff007f]/30 rounded-xl px-5 py-4">
                            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-pink-500">
                              Total Payment
                            </span>
                            <span className="text-xl sm:text-2xl font-black text-pink-500">
                              ₱{totalPrice.toFixed(0)}
                            </span>
                          </div>
                        )}

                        {/* Policy & Guide Text */}
                        <div className="flex flex-col gap-4 mt-4">
                          <p className="text-[10px] sm:text-xs text-red-500 font-bold leading-relaxed text-center">
                            No Receipt, Fake Receipts, No Top-Up Policy.
                          </p>

                          <div className="border-t border-gray-800/60 pt-4 space-y-2">
                            <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#ff007f] flex items-center gap-1.5 text-left">
                              <span>⚠️ Reminder - Wag kalimutan !</span>
                            </h4>
                            
                            {orderOption === 'place_order' ? (
                              <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed text-left">
                                Bayad muna bago magsubmit. Pagkatapos magbayad, i-upload ang resibo (Receipt Proof) sa section sa itaas at pindutin ang Submit Order. Salamat! 🙏
                              </p>
                            ) : (
                              <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed text-left">
                                Bayad muna bago magsubmit. Pagkatapos magbayad, i-copy ang form, pindutin ang Submit Order, at i-send sa aming FB Page ang automated form kasama ang resibo. Salamat! 🙏
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* PAGE 5: ORDER SUBMITTED SUCCESS PAGE */}
            {activePage === 'submitted' && (
              <div className="flex-1 flex flex-col justify-between p-4 sm:p-5 space-y-6 overflow-y-auto min-h-0">
                <div className="space-y-6">
                  {/* Header Title */}
                  <div className="flex items-center justify-center gap-2 text-[#ff007f]">
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider">
                      ORDER SUBMITTED
                    </h2>
                    <Check className="w-6 h-6 stroke-[3px]" />
                  </div>

                  {/* Summary Card Details */}
                  <div className="bg-[#161922]/90 border border-gray-800/80 rounded-xl p-4 sm:p-5 shadow-lg space-y-4 text-xs sm:text-sm font-medium">
                    {accounts.map((acc, accIdx) => {
                      const accSelections = selections[accIdx] || {};
                      const selectedVariationsList = Object.entries(accSelections)
                        .map(([vId, qty]) => {
                          const v = item.variations?.find((x) => x.id === vId);
                          return v ? { name: v.name, qty } : null;
                        })
                        .filter(Boolean);

                      if (selectedVariationsList.length === 0) return null;

                      const ids: string[] = [];
                      if (hasCustomFields && item.customFields) {
                        item.customFields.forEach((f) => {
                          const v = acc[f.key];
                          if (v) ids.push(v);
                        });
                      }

                      return (
                        <div key={accIdx} className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs">GAME:</span>
                            <span className="text-white col-span-2">{item.name.replace(/^[🟢\s]+/, '').trim()}</span>
                          </div>
                          {selectedRegion && (
                            <div className="grid grid-cols-3 gap-2">
                              <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs">REGION:</span>
                              <span className="text-white col-span-2">{selectedRegion}</span>
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs">ORDER:</span>
                            <div className="text-white col-span-2 flex flex-col gap-0.5 font-bold">
                              {selectedVariationsList.map((sv, sIdx) => (
                                <span key={sIdx}>{sv?.name} {sv?.qty}x</span>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs">PLAYER ID:</span>
                            <span className="text-white col-span-2 font-semibold">{ids.join(' ')}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs">PAYMENT:</span>
                            <span className="text-white col-span-2 uppercase font-bold text-pink-400">
                              {selectedPaymentMethod?.name.replace(/ payment/i, '') || 'GCASH'}
                            </span>
                          </div>
                          {(() => {
                            const userSubtotal = Object.entries(accSelections).reduce((sum, [vId, qty]) => {
                              const v = item.variations?.find((x) => x.id === vId);
                              return v ? sum + getDiscountedPrice(v.price, v) * qty : sum;
                            }, 0);
                            return (
                              <div className="grid grid-cols-3 gap-2">
                                <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs">TOTAL:</span>
                                <span className="text-pink-500 font-bold col-span-2">₱{userSubtotal.toFixed(0)}</span>
                              </div>
                            );
                          })()}
                          {accIdx < accounts.length - 1 && (
                            <div className="border-t border-gray-900 my-4"></div>
                          )}
                        </div>
                      );
                    })}

                    {/* Overall Total */}
                    <div className="mt-4 pt-3 border-t border-pink-500/30 flex justify-between items-center">
                      <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-white">TOTAL:</span>
                      <span className="text-base sm:text-lg font-black text-pink-500">₱{totalPrice.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Copy Order Details Button */}
                  <button
                    type="button"
                    onClick={handleCopySubmittedOrderDetails}
                    className="w-full py-3 rounded-xl bg-[#2c1524]/20 border border-pink-500/30 hover:border-pink-500/60 hover:bg-[#2c1524]/30 text-white transition-all text-xs sm:text-sm font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 mt-4"
                  >
                    <Copy className="h-4 w-4 text-pink-500" />
                    {copiedOrderMessage ? 'Order Details Copied!' : 'Copy Order Details'}
                  </button>

                  {/* Horizontal Divider Line */}
                  <div className="border-t-2 border-[#ff007f]/40 my-2"></div>

                  {/* Banner processing time */}
                  <div className="bg-[#161922]/90 border border-gray-800/80 rounded-xl p-3 flex items-center justify-center gap-2 max-w-sm mx-auto">
                    <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-gray-400">
                      Processing Time : 10 mins to few hours
                    </span>
                  </div>

                  {/* Helper Text */}
                  <p className="text-center text-xs sm:text-sm font-bold text-pink-500/90 leading-relaxed px-4">
                    Please wait. Your order is being processed by our team
                  </p>

                  {/* Having trouble support button */}
                  {siteSettings?.footer_support_url && (
                    <div className="max-w-sm mx-auto w-full pt-1">
                      <a
                        href={siteSettings.footer_support_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-xl bg-gray-900/50 hover:bg-gray-900/70 border border-pink-500/30 hover:border-pink-500/50 transition-all duration-200 group w-full"
                      >
                        <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-pink-500 group-hover:scale-110 transition-transform duration-200 flex-shrink-0" />
                        <span className="text-xs font-semibold text-white group-hover:text-pink-500 transition-colors duration-200 text-center">
                          Order Not Yet Received? Contact Customer Service
                        </span>
                      </a>
                    </div>
                  )}
                </div>

                {/* BUY AGAIN button */}
                <div className="pt-4 pb-2">
                  <button
                    type="button"
                    onClick={handleBuyAgain}
                    className="w-full py-3.5 rounded-xl border border-[#ff007f]/30 hover:bg-pink-500/10 text-pink-500 hover:text-pink-400 font-extrabold uppercase tracking-widest text-xs sm:text-sm transition-all shadow-[0_0_8px_rgba(255,0,127,0.1)] flex items-center justify-center gap-2 bg-transparent"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    BUY AGAIN
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* FIXED FOOTER AREA FOR NAVIGATION AND ACTIONS */}
          {activePage !== 'submitted' && (
            <div className="flex-shrink-0 p-4 sm:p-5 border-t border-gray-900 bg-[#0d0d0d]/80 backdrop-blur-md space-y-3">
            {/* PAGE 1 ACTIONS */}
            {activePage === 'details' && activeSelectingAccountIdx !== null && (
              <button
                type="button"
                onClick={() => setActiveSelectingAccountIdx(null)}
                className="w-full py-3.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-extrabold uppercase tracking-widest text-xs sm:text-sm shadow-[0_0_12px_rgba(255,0,127,0.25)] transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="h-4 w-4 stroke-[3px]" />
                Done
              </button>
            )}

            {activePage === 'details' && activeSelectingAccountIdx === null && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={addAccount}
                  className="w-full py-3.5 rounded-xl border border-dashed border-pink-500/40 text-pink-500 hover:bg-pink-500/5 text-xs sm:text-sm font-extrabold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Add New User
                </button>

                <button
                  type="button"
                  onClick={() => isDetailsValid && isProductsSelected && setActivePage('order_details')}
                  disabled={!isDetailsValid || !isProductsSelected}
                  className={`w-full py-3.5 rounded-xl text-xs sm:text-sm font-extrabold uppercase tracking-widest transition-all ${
                    isDetailsValid && isProductsSelected
                      ? 'bg-pink-500 hover:bg-pink-600 text-white shadow-[0_0_12px_rgba(255,0,127,0.25)]'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Proceed
                </button>
              </div>
            )}

            {/* PAGE 3 ACTIONS */}
            {activePage === 'order_details' && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setActivePage('details')}
                  className="w-full py-3.5 rounded-xl border border-gray-855 text-gray-300 hover:bg-white/5 text-xs sm:text-sm font-extrabold uppercase tracking-widest transition-colors text-center"
                >
                  Add more
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActivePage('payment');
                    setShowInstructionsModal(true);
                  }}
                  className="w-full py-3.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white shadow-[0_0_12px_rgba(255,0,127,0.2)] text-xs sm:text-sm font-extrabold uppercase tracking-widest transition-all text-center"
                >
                  Proceed
                </button>
              </div>
            )}

            {/* PAGE 4 ACTIONS */}
            {activePage === 'payment' && (
              <div className="space-y-3">
                {/* Buttons in one row */}
                <div className={orderOption === 'place_order' ? "w-full" : "grid grid-cols-2 gap-3"}>
                  {/* Copy Order Form Button */}
                  {orderOption !== 'place_order' && (
                    <button
                      type="button"
                      onClick={handleCopyOrderMessage}
                      disabled={!isFormValid || isPlacingOrder}
                      className={`w-full py-3.5 rounded-xl text-[10px] sm:text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        isFormValid && !isPlacingOrder
                          ? 'bg-pink-500 hover:bg-pink-600 text-white shadow-[0_0_12px_rgba(255,0,127,0.25)]'
                          : 'bg-gray-850 border border-gray-800 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Copy className="h-4 w-4" />
                      {copiedOrderMessage ? 'Copied!' : 'Copy Form'}
                    </button>
                  )}

                  {/* Submit button */}
                  {orderOption === 'place_order' ? (
                    <button
                      type="button"
                      onClick={handlePlaceOrder}
                      disabled={!isFormValid || isPlacingOrder}
                      className={`w-full py-3.5 rounded-xl text-[10px] sm:text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        isFormValid && !isPlacingOrder
                          ? 'bg-pink-500 hover:bg-pink-600 text-white shadow-[0_0_12px_rgba(255,0,127,0.25)]'
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {isPlacingOrder ? 'Submitting...' : 'Submit Order'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenMessenger}
                      disabled={!isFormValid || isPlacingOrder || !hasCopiedForm}
                      className={`w-full py-3.5 rounded-xl text-[10px] sm:text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        isFormValid && !isPlacingOrder && hasCopiedForm
                          ? 'bg-pink-500 hover:bg-pink-600 text-white shadow-[0_0_12px_rgba(255,0,127,0.25)]'
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <MessageCircle className="h-4 w-4 fill-current" />
                      {isPlacingOrder ? 'Opening...' : 'Submit Order'}
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-gray-500 font-bold tracking-wider text-center pt-1">
                  Visit our official website : <a href="https://www.pgcshop.com" target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:text-pink-400 transition-colors font-semibold ml-0.5">www.pgcshop.com</a>
                </p>
              </div>
            )}
          </div>
          )}

          {/* Inner overlay instructions modal */}
          {showInstructionsModal && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
              <div
                className="w-full max-w-sm rounded-2xl p-5 border border-pink-500/35 space-y-4 shadow-2xl"
                style={{ background: 'linear-gradient(180deg, #161922 0%, #0d0d0d 100%)' }}
              >
                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#ff007f] text-center pb-2 border-b border-gray-800">
                  ⚠️ Reminder - Wag kalimutan !
                </h3>
                
                {orderOption === 'place_order' ? (
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed text-left">
                    Bayad muna bago magsubmit. Pagkatapos magbayad, i-upload ang resibo (Receipt Proof) sa section sa itaas at pindutin ang Submit Order. Salamat! 🙏
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed text-left">
                    Bayad muna bago magsubmit. Pagkatapos magbayad, i-copy ang form, pindutin ang Submit Order, at i-send sa aming FB Page ang automated form kasama ang resibo. Salamat! 🙏
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setShowInstructionsModal(false)}
                  className="w-full py-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-extrabold uppercase tracking-widest text-xs sm:text-sm shadow-[0_0_12px_rgba(255,0,127,0.25)] transition-all mt-2"
                >
                  I understand
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen QR Viewer Modal */}
      {showQrFullscreen && selectedPaymentMethod?.qr_code_url && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 p-4"
          onClick={() => setShowQrFullscreen(false)}
        >
          <div className="bg-white p-3 rounded-2xl max-w-sm w-full aspect-square flex items-center justify-center shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowQrFullscreen(false)}
              className="absolute -top-12 right-0 p-2 text-white hover:opacity-85"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedPaymentMethod.qr_code_url}
              alt="Scan to Pay"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="mt-4 text-xs font-bold text-white tracking-widest uppercase">
            {selectedPaymentMethod.name.replace(/ payment/i, '')} QR Code — Scan to Pay
          </p>
        </div>
      )}

      {/* Fullscreen Guide Image Viewer Modal */}
      {showGuideFullscreen && item.guide_image_url && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          onClick={() => setShowGuideFullscreen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 border border-pink-500/35 space-y-4 shadow-2xl overflow-y-auto max-h-[95vh] relative animate-fade-in"
            style={{ background: 'linear-gradient(180deg, #161922 0%, #0d0d0d 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#ff007f] text-center pb-2 border-b border-gray-800">
              {item.name.replace(/^[🟢\s]+/, '').trim()} Guide
            </h3>
            
            <div className="flex flex-col items-center gap-4 w-full">
              <img
                src={item.guide_image_url}
                alt="Guide Image"
                className="w-full h-auto object-contain rounded-xl border border-gray-800 shadow-md"
              />
              
              {item.guide_text && (
                <p className="text-[11px] sm:text-xs text-gray-300 whitespace-pre-line leading-relaxed text-left w-full">
                  {item.guide_text}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideFullscreen(false)}
              className="w-full py-3.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-extrabold uppercase tracking-widest text-xs sm:text-sm shadow-[0_0_12px_rgba(255,0,127,0.25)] transition-all mt-2"
            >
              I UNDERSTAND
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default GameItemOrderModal;
