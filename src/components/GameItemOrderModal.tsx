import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Upload, HelpCircle, Copy, Download, Plus, Trash2, MessageCircle, Check, Receipt, ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react';
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
  const { setOrderPlaced } = useOrderStatus();
  const { siteSettings } = useSiteSettings();
  const orderOption = siteSettings?.order_option || 'place_order';

  const [selectedVariation, setSelectedVariation] = useState<Variation | undefined>(undefined);
  const [accounts, setAccounts] = useState<Record<string, string>[]>([{}]);
  const [quantity, setQuantity] = useState(1);
  const [userSelections, setUserSelections] = useState<Record<number, { variation: Variation; quantity: number }>>({});
  const [activeUserIdx, setActiveUserIdx] = useState<number | null>(null);
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
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(true);
  const section2Ref = useRef<HTMLDivElement>(null);
  const packageGridRef = useRef<HTMLDivElement>(null);
  const quantityApplyToRef = useRef<HTMLDivElement>(null);
  const paymentSectionRef = useRef<HTMLDivElement>(null);
  const paymentDetailsRef = useRef<HTMLDivElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);

  const isMessengerBrowser = useMemo(
    () => /FBAN|FBAV/i.test(navigator.userAgent) || /FB_IAB/i.test(navigator.userAgent),
    []
  );

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

  const handleDownloadQRCode = async (qrCodeUrl: string, paymentMethodName: string) => {
    if (isMessengerBrowser) return;
    try {
      const response = await fetch(qrCodeUrl, { mode: 'cors', cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-code-${paymentMethodName.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error('Download failed:', err);
      try {
        const link = document.createElement('a');
        link.href = qrCodeUrl;
        link.download = `qr-code-${paymentMethodName.toLowerCase().replace(/\s+/g, '-')}.png`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => document.body.removeChild(link), 100);
      } catch (fallbackErr) {
        console.error('Fallback download failed:', fallbackErr);
      }
    }
  };

  const hasCustomFields = item.customFields && item.customFields.length > 0;
  const selectedPaymentMethod = paymentMethods.find((m) => m.id === paymentMethodId);

  // Set activeUserIdx to first unassigned when in multi-account mode (Option B: "Selecting for" flow)
  useEffect(() => {
    if (accounts.length <= 1) {
      setActiveUserIdx(null);
      return;
    }
    const firstUnassigned = accounts.findIndex((_, idx) => !userSelections[idx]);
    if (firstUnassigned >= 0) {
      setActiveUserIdx(firstUnassigned);
    } else {
      setActiveUserIdx(null); // All assigned
    }
  }, [accounts.length, userSelections]);

  // When user selects a package (single account only): scroll to payment
  useEffect(() => {
    if (!selectedVariation || accounts.length > 1) return;
    setTimeout(() => {
      quantityApplyToRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [selectedVariation, accounts.length]);

  // Auto-scroll to payment details when payment method is selected
  useEffect(() => {
    if (paymentMethodId && paymentDetailsRef.current) {
      setTimeout(() => {
        paymentDetailsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    }
  }, [paymentMethodId]);

  // Auto-select GCash by default
  useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethodId) {
      const gcashMethod = paymentMethods.find((m) => m.name.toLowerCase().includes('gcash'));
      if (gcashMethod) {
        setPaymentMethodId(gcashMethod.id);
      }
    }
  }, [paymentMethods, paymentMethodId]);

  const getDiscountedPrice = (basePrice: number, variation?: Variation): number => {
    if (currentMember && variation) {
      const isReseller = currentMember.user_type === 'reseller';
      if (isReseller && variation.reseller_price !== undefined) return variation.reseller_price;
      if (!isReseller && currentMember.user_type === 'end_user' && variation.member_price !== undefined) return variation.member_price;
    }
    if (item.isOnDiscount && item.discountPercentage !== undefined) {
      // discountPercentage is stored as decimal 0-1 (e.g. 0.10 = 10% off)
      return basePrice * (1 - item.discountPercentage);
    }
    return basePrice;
  };

  const unitPrice = useMemo(() => {
    if (!selectedVariation) return 0;
    return getDiscountedPrice(selectedVariation.price, selectedVariation);
  }, [selectedVariation, item.isOnDiscount, item.discountPercentage, currentMember]);

  const totalPrice = useMemo(() => {
    if (accounts.length === 1) {
      if (!selectedVariation) return 0;
      const up = getDiscountedPrice(selectedVariation.price, selectedVariation);
      return up * quantity;
    }
    return Object.entries(userSelections).reduce((sum, [, sel]) => {
      const up = getDiscountedPrice(sel.variation.price, sel.variation);
      return sum + up * sel.quantity;
    }, 0);
  }, [accounts.length, selectedVariation, quantity, userSelections, item.isOnDiscount, item.discountPercentage, currentMember]);

  const isFormValid = useMemo(() => {
    if (!paymentMethodId) return false;
    if (orderOption === 'place_order' && !receiptImageUrl) return false;
    if (accounts.length === 1) {
      if (!selectedVariation) return false;
      const acc = accounts[0];
      if (hasCustomFields && item.customFields) {
        if (!item.customFields.every((f) => !f.required || !!acc[f.key]?.trim())) return false;
      }
      return true;
    }
    const selectionEntries = Object.entries(userSelections);
    if (selectionEntries.length === 0) return false;
    return selectionEntries.every(([accIdxStr, sel]) => {
      const accIdx = parseInt(accIdxStr, 10);
      const acc = accounts[accIdx];
      if (!sel.variation) return false;
      if (hasCustomFields && item.customFields) {
        if (!acc) return false;
        return item.customFields.every((f) => !f.required || !!acc[f.key]?.trim());
      }
      return true;
    });
  }, [selectedVariation, paymentMethodId, receiptImageUrl, hasCustomFields, item.customFields, accounts, userSelections]);

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

  const handlePlaceOrder = async () => {
    if (!selectedPaymentMethod || !receiptImageUrl) return;

    try {
      setIsPlacingOrder(true);
      setReceiptError(null);

      const customerInfo: Record<string, string | unknown> = {};
      customerInfo['Payment Method'] = selectedPaymentMethod.name;

      const orderItems: CartItem[] = [];
      const multipleAccountsData: { game: string; package: string; fields: Record<string, string> }[] = [];

      if (accounts.length === 1) {
        const acc = accounts[0];
        const variation = selectedVariation!;
        const unitP = getDiscountedPrice(variation.price, variation);
        const fields: Record<string, string> = {};
        if (hasCustomFields && item.customFields) {
          item.customFields.forEach((field) => {
            const val = acc[field.key];
            if (val) fields[field.label] = val;
          });
        }
        if (Object.keys(fields).length > 0) {
          multipleAccountsData.push({ game: item.name, package: variation.name, fields });
        }
        for (let q = 0; q < quantity; q++) {
          orderItems.push({
            ...item,
            id: `${item.id}:::CART:::${Date.now()}-0-${q}-${Math.random().toString(36).slice(2)}`,
            quantity: 1,
            selectedVariation: variation,
            totalPrice: unitP,
          });
        }
      } else {
        for (const [accIdxStr, sel] of Object.entries(userSelections)) {
          const accIdx = parseInt(accIdxStr, 10);
          const acc = accounts[accIdx];
          if (!acc || !sel.variation) continue;
          const unitP = getDiscountedPrice(sel.variation.price, sel.variation);
          const fields: Record<string, string> = {};
          if (hasCustomFields && item.customFields) {
            item.customFields.forEach((field) => {
              const val = acc?.[field.key];
              if (val) fields[field.label] = val;
            });
          }
          if (Object.keys(fields).length > 0) {
            multipleAccountsData.push({ game: item.name, package: sel.variation.name, fields });
          }
          for (let q = 0; q < sel.quantity; q++) {
            orderItems.push({
              ...item,
              id: `${item.id}:::CART:::${Date.now()}-${accIdx}-${q}-${Math.random().toString(36).slice(2)}`,
              quantity: 1,
              selectedVariation: sel.variation,
              totalPrice: unitP,
            });
          }
        }
      }

      if (multipleAccountsData.length > 0) {
        customerInfo['Multiple Accounts'] = multipleAccountsData;
      }

      const customerInfoForOrder = multipleAccountsData.length > 0
        ? multipleAccountsData
        : Object.fromEntries(Object.entries(customerInfo).filter(([, v]) => typeof v === 'string')) as Record<string, string>;

      const invoiceNumber = await generateInvoiceNumber(true);

      const newOrder = await createOrder({
        order_items: orderItems,
        customer_info: customerInfoForOrder,
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

  const handleClose = () => {
    onClose();
    setSelectedVariation(undefined);
    setAccounts([{}]);
    setQuantity(1);
    setUserSelections({});
    setActiveUserIdx(null);
    setPaymentMethodId(null);
    setSavedOrderId(null);
    setGeneratedInvoiceNumber(null);
    handleReceiptRemove();
  };

  // Philippine timezone helper for invoice number
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
    const lines: string[] = [`GAME: ${item.name}`];
    if (accounts.length === 1 && accounts[0]) {
      const acc = accounts[0];
      if (hasCustomFields && item.customFields) {
        item.customFields.forEach((f) => {
          const v = acc[f.key];
          if (v) lines.push(`${f.label}: ${v}`);
        });
      }
      if (selectedVariation) {
        lines.push(`ORDER: ${selectedVariation.name} x${quantity} - ₱${totalPrice}`);
      }
    } else {
      Object.entries(userSelections).forEach(([idxStr, sel]) => {
        const acc = accounts[parseInt(idxStr, 10)];
        if (!acc) return;
        if (hasCustomFields && item.customFields) {
          item.customFields.forEach((f) => {
            const v = acc?.[f.key];
            if (v) lines.push(`${f.label}: ${v}`);
          });
        }
        lines.push(`ORDER: ${sel.variation.name} x${sel.quantity} - ₱${getDiscountedPrice(sel.variation.price, sel.variation) * sel.quantity}`);
      });
    }
    lines.push(`PAYMENT: ${selectedPaymentMethod?.name || ''}${selectedPaymentMethod?.account_name ? ` - ${selectedPaymentMethod.account_name}` : ''}`);
    lines.push(`TOTAL: ₱${totalPrice}`, '', 'PAYMENT RECEIPT:');
    if (receiptImageUrl) lines.push(receiptImageUrl);
    return lines.join('\n');
  };

  const saveOrderAndGetMessage = async (): Promise<string> => {
    if (!selectedPaymentMethod) throw new Error('Please select a payment method');
    if (orderOption === 'place_order' && !receiptImageUrl) throw new Error('Please upload receipt');
    const invoiceNumber = savedOrderId && generatedInvoiceNumber
      ? generatedInvoiceNumber
      : await generateInvoiceNumber(true);
    const customerInfo: Record<string, string | unknown> = { 'Payment Method': selectedPaymentMethod.name };
    const orderItems: CartItem[] = [];
    const multipleAccountsData: { game: string; package: string; fields: Record<string, string> }[] = [];
    if (accounts.length === 1) {
      const acc = accounts[0];
      const variation = selectedVariation!;
      const unitP = getDiscountedPrice(variation.price, variation);
      const fields: Record<string, string> = {};
      if (hasCustomFields && item.customFields) {
        item.customFields.forEach((f) => { const v = acc[f.key]; if (v) fields[f.label] = v; });
      }
      if (Object.keys(fields).length > 0) multipleAccountsData.push({ game: item.name, package: variation.name, fields });
      for (let q = 0; q < quantity; q++) {
        orderItems.push({
          ...item,
          id: `${item.id}:::CART:::${Date.now()}-0-${q}-${Math.random().toString(36).slice(2)}`,
          quantity: 1,
          selectedVariation: variation,
          totalPrice: unitP,
        });
      }
    } else {
      for (const [accIdxStr, sel] of Object.entries(userSelections)) {
        const accIdx = parseInt(accIdxStr, 10);
        const acc = accounts[accIdx];
        if (!acc || !sel.variation) continue;
        const unitP = getDiscountedPrice(sel.variation.price, sel.variation);
        const fields: Record<string, string> = {};
        if (hasCustomFields && item.customFields) {
          item.customFields.forEach((f) => { const v = acc?.[f.key]; if (v) fields[f.label] = v; });
        }
        if (Object.keys(fields).length > 0) multipleAccountsData.push({ game: item.name, package: sel.variation.name, fields });
        for (let q = 0; q < sel.quantity; q++) {
          orderItems.push({
            ...item,
            id: `${item.id}:::CART:::${Date.now()}-${accIdx}-${q}-${Math.random().toString(36).slice(2)}`,
            quantity: 1,
            selectedVariation: sel.variation,
            totalPrice: unitP,
          });
        }
      }
    }
    if (multipleAccountsData.length > 0) customerInfo['Multiple Accounts'] = multipleAccountsData;
    const customerInfoForOrder = multipleAccountsData.length > 0
      ? multipleAccountsData
      : Object.fromEntries(Object.entries(customerInfo).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
    if (!savedOrderId) {
      const newOrder = await createOrder({
        order_items: orderItems,
        customer_info: customerInfoForOrder,
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
        setTimeout(() => setCopiedOrderMessage(false), 2000);
      }
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : 'Failed to prepare order');
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
      handleClose();
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : 'Failed to open Messenger');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const firstFieldLabel = hasCustomFields && item.customFields?.[0] ? item.customFields[0].label : 'User ID';

  const addAccount = () => setAccounts((prev) => [...prev, {}]);

  const removeAccount = (idx: number) => {
    if (accounts.length <= 1) return;
    setAccounts((prev) => prev.filter((_, i) => i !== idx));
    setUserSelections((prev) => {
      const next: Record<number, { variation: Variation; quantity: number }> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = parseInt(k, 10);
        if (i < idx) next[i] = v;
        else if (i > idx) next[i - 1] = v;
      });
      return next;
    });
  };

  // Option B: Assign package directly to user (from package click)
  const assignPackageToUser = (accIdx: number, variation: Variation, qty: number = 1) => {
    const hasAnotherUnassigned = accounts.some((_, idx) => idx !== accIdx && !userSelections[idx]);
    setUserSelections((prev) => ({ ...prev, [accIdx]: { variation, quantity: qty } }));
    // activeUserIdx is updated by useEffect when userSelections changes
    setTimeout(() => {
      if (hasAnotherUnassigned) {
        // Scroll to top of Section 2 so "Select package for User ID #X" banner is visible
        section2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (quantityApplyToRef.current) {
        quantityApplyToRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  const handleChangePackageFor = (accIdx: number) => {
    setActiveUserIdx(accIdx);
    setTimeout(() => {
      section2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const updateUserQuantity = (accIdx: number, newQty: number) => {
    const clamped = Math.max(1, Math.min(99, newQty));
    setUserSelections((prev) => {
      const sel = prev[accIdx];
      if (!sel) return prev;
      return { ...prev, [accIdx]: { ...sel, quantity: clamped } };
    });
  };

  const updateAccountField = (accIdx: number, key: string, value: string) => {
    setAccounts((prev) => {
      const next = [...prev];
      next[accIdx] = { ...next[accIdx], [key]: value };
      return next;
    });
  };

  if (!isOpen) return null;

  const stepCardClass = 'bg-white rounded-xl p-3 sm:p-5 shadow-md border border-gray-100';
  const stepNumClass = 'w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold text-white flex-shrink-0';
  const inputClass = 'w-full px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900 text-sm';

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <div
          className="flex flex-col rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, #2d1b4e 0%, #1a0f2e 100%)',
            border: '1.5px solid rgba(255, 105, 180, 0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative flex-shrink-0 p-3 sm:p-6 flex items-center justify-between border-b border-pink-500/20 overflow-hidden">
            {item.image && (
              <div 
                className="absolute inset-0 z-0 opacity-20 bg-cover bg-center"
                style={{ backgroundImage: `url(${item.image})` }}
              />
            )}
            <div className="relative z-10 flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-xl font-bold text-white">{item.name}</h2>
                {item.subtitle && (
                  <p className="text-xs text-pink-200/80 mt-0.5">{item.subtitle}</p>
                )}
                {item.description && (
                  <p className="text-xs text-white/70 mt-1 whitespace-pre-wrap">{item.description}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              className="relative z-10 p-1.5 sm:p-2 hover:bg-pink-500/20 rounded-full transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
            {/* Section 1: Enter ID / Customer Info (Only show if fields exist) */}
            {hasCustomFields && item.customFields && item.customFields.length > 0 && (
              <div className={stepCardClass}>
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={stepNumClass} style={{ backgroundColor: '#8B5CF6' }}>1</div>
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                      {item.customFields[0].label}
                    </h3>
                  </div>
                  <p className="text-[11px] text-gray-500 ml-9 italic">
                    To add multiple UID'S and ORDERS click " ADD NEW {firstFieldLabel.toUpperCase()} "
                  </p>
                </div>
                <div className="space-y-4">
                  {accounts.map((acc, accIdx) => (
                    <div key={accIdx} className="relative">
                      {accIdx > 0 && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500">
                            {firstFieldLabel} #{accIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAccount(accIdx)}
                            className="p-1 rounded hover:bg-red-100 text-gray-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      
                      <div className="space-y-2 sm:space-y-3">
                        {item.customFields!.map((field) => (
                          <div key={field.key}>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={acc[field.key] || ''}
                                onChange={(e) => updateAccountField(accIdx, field.key, e.target.value)}
                                placeholder={field.placeholder || field.label}
                                className={inputClass}
                              />
                              {field.placeholder?.toLowerCase().includes('id') && (
                                <button
                                  type="button"
                                  onClick={() => setShowIdHelp(!showIdHelp)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-500 hover:text-purple-600"
                                >
                                  <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                                </button>
                              )}
                            </div>
                            {showIdHelp && field.placeholder?.toLowerCase().includes('id') && (
                              <p className="mt-2 text-xs text-gray-500">
                                To find your ID, click on the character icon. Your User ID is listed below your character name. Example: '5363266446'.
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={addAccount}
                      className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg border-2 border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400 text-sm font-medium transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add new {firstFieldLabel}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Select Recharge / Package */}
            <div ref={section2Ref} className={stepCardClass}>
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <div className={stepNumClass} style={{ backgroundColor: '#8B5CF6' }}>2</div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Select Recharge</h3>
              </div>
              {accounts.length > 1 && (
                <div className="mb-3 p-2.5 rounded-lg bg-purple-50 border border-purple-200">
                  {activeUserIdx !== null ? (
                    <p className="text-sm font-medium text-purple-800">
                      Select package for <span className="font-semibold">{firstFieldLabel} #{activeUserIdx + 1}</span>
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-green-700">✓ All users have packages</p>
                  )}
                  <p className="text-xs text-gray-600 mt-0.5">
                    {Object.keys(userSelections).length} of {accounts.length} assigned
                  </p>
                </div>
              )}
              {item.variations && item.variations.length > 0 ? (
                (() => {
                  const grouped = item.variations.reduce<Record<string, Variation[]>>((acc, v) => {
                    const key = (v.category && v.category.trim()) || '\u200b'; // \u200b = empty category label
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(v);
                    return acc;
                  }, {}); // initial {} so acc is never a variation object
                  // Order categories by: 1. Presence of labeled packages, 2. Minimum sort_order
                  const categoryOrder = Object.keys(grouped).sort((a, b) => {
                    const hasBadgeA = grouped[a].some(v => !!v.badge_text);
                    const hasBadgeB = grouped[b].some(v => !!v.badge_text);
                    
                    if (hasBadgeA && !hasBadgeB) return -1;
                    if (!hasBadgeA && hasBadgeB) return 1;
                    
                    const minA = Math.min(...(grouped[a] || []).map((v) => v.sort_order ?? 999));
                    const minB = Math.min(...(grouped[b] || []).map((v) => v.sort_order ?? 999));
                    return minA - minB;
                  });
                  return (
                    <div className="space-y-4">
                      {categoryOrder.map((catKey) => {
                        // Sort variations by badge presence first, then by sort_order
                        const variations = (grouped[catKey] || []).sort((a, b) => {
                          // Labeled packages come first
                          if (a.badge_text && !b.badge_text) return -1;
                          if (!a.badge_text && b.badge_text) return 1;
                          // Then sort by sort_order
                          return (a.sort_order ?? 999) - (b.sort_order ?? 999);
                        });
                        const categoryName = catKey === '\u200b' ? null : catKey;
                        return (
                          <div key={catKey}>
                            {categoryName && (
                              <p className="text-xs font-medium text-gray-600 mb-2">{categoryName}</p>
                            )}
                            <div ref={packageGridRef} className="grid grid-cols-2 gap-2 sm:gap-3">
                              {variations.map((v, idx) => {
                    const price = getDiscountedPrice(v.price, v);
                    const isSelected = accounts.length > 1 && activeUserIdx !== null
                      ? userSelections[activeUserIdx]?.variation.id === v.id
                      : selectedVariation?.id === v.id;
                    return (
                      <button
                        key={`${v.id}-${idx}`}
                        type="button"
                        onClick={() => {
                          if (accounts.length > 1 && activeUserIdx !== null) {
                            assignPackageToUser(activeUserIdx, v, userSelections[activeUserIdx]?.quantity ?? 1);
                          } else {
                            setSelectedVariation(v);
                            if (accounts.length === 1 && quantityApplyToRef.current) {
                              setTimeout(() => quantityApplyToRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
                            }
                          }
                        }}
                        className={`relative rounded-lg border-2 text-left transition-all ${
                          v.badge_text 
                            ? 'pt-7 sm:pt-8 pb-2.5 sm:pb-4 px-2.5 sm:px-4' 
                            : 'p-2.5 sm:p-4'
                        } ${
                          isSelected
                            ? 'border-pink-500 bg-pink-500 text-white shadow-md'
                            : 'border-gray-200 bg-gray-50 hover:border-pink-500 hover:bg-pink-50'
                        }`}
                      >
                        {v.badge_text && (
                          <div 
                            className="absolute top-0 left-0 z-20 px-1.5 py-0.5 rounded-br-lg shadow-sm overflow-hidden"
                            style={{ backgroundColor: v.badge_color || '#EC4899', color: 'white' }}
                          >
                            <span className="text-[8px] font-bold uppercase tracking-wider block leading-tight">{v.badge_text}</span>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-white text-pink-500 rounded-full p-1 shadow-sm">
                            <Check className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={3} />
                          </div>
                        )}
                        <div className={`font-semibold text-xs sm:text-base pr-6 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                          {v.name}
                        </div>
                        {v.description && (
                          <div className={`text-[10px] sm:text-xs mt-0.5 whitespace-pre-wrap ${isSelected ? 'text-pink-100' : 'text-gray-500'}`}>
                            {v.description}
                          </div>
                        )}
                        <div className={`mt-1.5 sm:mt-2 text-sm sm:text-base font-bold ${isSelected ? 'text-white' : 'text-red-600'}`}>₱{price.toFixed(0)}</div>
                        {item.isOnDiscount && item.discountPercentage && (
                          <div className={`text-[10px] sm:text-xs line-through ${isSelected ? 'text-pink-200' : 'text-gray-500'}`}>₱{v.price}</div>
                        )}
                      </button>
                    );
                  })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                <p className="text-xs sm:text-sm text-gray-500">No packages available</p>
              )}
            </div>

            {/* Section 3: Quantity / Your Selections */}
            {(selectedVariation || accounts.length > 1) && (
              <div ref={quantityApplyToRef} className={stepCardClass}>
                {accounts.length > 1 && (
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <div className={stepNumClass} style={{ backgroundColor: '#8B5CF6' }}>3</div>
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900">Your Selections</h3>
                  </div>
                )}
                <div className="space-y-3">
                  {accounts.length === 1 ? (
                    <div className="flex items-center gap-2">
                      <div className={stepNumClass} style={{ backgroundColor: '#8B5CF6' }}>3</div>
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 flex-1">Quantity</h3>
                      <div className="flex items-center gap-0 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-gray-100 hover:bg-purple-100 active:bg-purple-200 text-gray-700 hover:text-purple-700 font-bold text-lg transition-colors border-r border-gray-200"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
                          className="w-12 sm:w-14 text-center py-2 bg-white text-base font-bold text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                          className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-gray-100 hover:bg-purple-100 active:bg-purple-200 text-gray-700 hover:text-purple-700 font-bold text-lg transition-colors border-l border-gray-200"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="space-y-2">
                        {accounts.map((_, idx) => {
                          const sel = userSelections[idx];
                          const isActive = activeUserIdx === idx;
                          return (
                            <div
                              key={idx}
                              className={`flex flex-wrap items-center gap-2 py-3 px-3 rounded-lg border transition-colors ${
                                isActive ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-200' : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <span className="text-sm font-medium text-gray-900 min-w-0">
                                {firstFieldLabel} #{idx + 1}
                                {sel ? (
                                  <span className="ml-2 font-normal text-gray-700">
                                    {sel.variation.name} (₱{(getDiscountedPrice(sel.variation.price, sel.variation) * sel.quantity).toFixed(0)})
                                  </span>
                                ) : (
                                  <span className="ml-2 font-normal text-gray-500 italic">← Select package above</span>
                                )}
                              </span>
                              {sel && (
                                <div className="flex items-center gap-1 ml-auto sm:ml-2">
                                  <span className="text-xs text-gray-600 mr-1">Qty:</span>
                                  <button
                                    type="button"
                                    onClick={() => updateUserQuantity(idx, sel.quantity - 1)}
                                    className="w-8 h-8 rounded border border-gray-200 hover:bg-purple-50 font-medium text-gray-700 text-sm"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    max={99}
                                    value={sel.quantity}
                                    onChange={(e) => updateUserQuantity(idx, parseInt(e.target.value, 10) || 1)}
                                    className="w-12 text-center py-1 rounded border border-gray-200 text-sm font-medium text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateUserQuantity(idx, sel.quantity + 1)}
                                    className="w-8 h-8 rounded border border-gray-200 hover:bg-purple-50 font-medium text-gray-700 text-sm"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                              {sel && (
                                <button
                                  type="button"
                                  onClick={() => handleChangePackageFor(idx)}
                                  className="px-3 py-1 rounded-lg border border-purple-300 text-purple-700 text-xs font-medium hover:bg-purple-50 ml-auto"
                                >
                                  Change
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 4: Select Payment */}
            <div ref={paymentSectionRef} className={stepCardClass}>
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <div className={stepNumClass} style={{ backgroundColor: '#8B5CF6' }}>4</div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Select Payment</h3>
              </div>
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {paymentMethods.map((method) => {
                  const isSelected = paymentMethodId === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethodId(method.id)}
                      title={method.name}
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 flex items-center justify-center p-1.5 transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 bg-gray-50 hover:border-purple-300'
                      }`}
                    >
                      {method.icon_url ? (
                        <img
                          src={method.icon_url}
                          alt={method.name}
                          className="w-full h-full object-contain rounded"
                        />
                      ) : (
                        <span className="text-xl sm:text-2xl">💳</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {paymentMethods.length === 0 && (
                <p className="text-xs sm:text-sm text-gray-500">No payment methods available</p>
              )}

              {/* Payment Details Card */}
              {selectedPaymentMethod && (
                <div
                  ref={paymentDetailsRef}
                  className="mt-4 rounded-xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(45,27,78,0.85) 0%, rgba(26,15,46,0.9) 100%)',
                    border: '1px solid rgba(139,92,246,0.35)',
                  }}
                >
                  {/* Collapsible Header */}
                  <button
                    type="button"
                    onClick={() => setPaymentDetailsOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-3 py-2 transition-colors hover:bg-white/5"
                    style={{ borderBottom: paymentDetailsOpen ? '1px solid rgba(139,92,246,0.2)' : 'none' }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#EC4899' }}>
                      Payment Details
                    </p>
                    {paymentDetailsOpen
                      ? <ChevronUp className="h-3.5 w-3.5" style={{ color: '#EC4899' }} />
                      : <ChevronDown className="h-3.5 w-3.5" style={{ color: '#EC4899' }} />
                    }
                  </button>

                  {/* Card Body — QR left, details right */}
                  {paymentDetailsOpen && (
                    <div className="flex items-center gap-3 p-3">
                      {/* QR Code (tappable) */}
                      {selectedPaymentMethod.qr_code_url ? (
                        <button
                          type="button"
                          onClick={() => setShowQrFullscreen(true)}
                          className="flex-shrink-0 rounded-xl overflow-hidden p-1.5 transition-opacity hover:opacity-80 active:opacity-60"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,92,246,0.25)' }}
                          title="Tap to view full QR"
                        >
                          <img
                            src={selectedPaymentMethod.qr_code_url}
                            alt={`${selectedPaymentMethod.name} QR Code`}
                            className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-lg"
                          />
                          <p className="text-[9px] text-purple-400 text-center mt-1">Tap to expand</p>
                        </button>
                      ) : (
                        <div
                          className="flex-shrink-0 w-24 h-24 rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)' }}
                        >
                          <p className="text-[10px] text-purple-300 text-center px-2">No QR</p>
                        </div>
                      )}

                      {/* Right: badge + centered copy buttons */}
                      <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
                        {/* Total */}
                        <p className="text-sm sm:text-base font-bold text-white tracking-widest mb-1">
                          TOTAL: ₱{totalPrice.toFixed(0)}
                        </p>

                        {/* Method badge */}
                        <div
                          className="px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white mb-0.5"
                          style={{ backgroundColor: '#8B5CF6' }}
                        >
                          {selectedPaymentMethod.name.replace(/ payment/i, '')}
                        </div>

                        {/* Copy Name */}
                        {selectedPaymentMethod.account_name && (
                          <button
                            type="button"
                            onClick={() => handleCopyAccountName(selectedPaymentMethod.account_name)}
                            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors w-full"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}
                            title="Copy account name"
                          >
                            {copiedAccountName ? (
                              <span className="text-green-400 text-[11px] font-semibold">Copied!</span>
                            ) : (
                              <>
                                <Copy className="h-2.5 w-2.5 text-purple-400 flex-shrink-0" />
                                <span className="text-[11px] text-purple-200 truncate">{selectedPaymentMethod.account_name}</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Copy Number */}
                        <button
                          type="button"
                          onClick={() => handleCopyAccountNumber(selectedPaymentMethod.account_number)}
                          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors w-full"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}
                          title="Copy account number"
                        >
                          {copiedAccountNumber ? (
                            <span className="text-green-400 text-[11px] font-semibold">Copied!</span>
                          ) : (
                            <>
                              <Copy className="h-2.5 w-2.5 text-purple-400 flex-shrink-0" />
                              <span className="font-mono font-bold text-[11px] sm:text-xs tracking-widest text-white">
                                {selectedPaymentMethod.account_number}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fullscreen QR Viewer */}
              {showQrFullscreen && selectedPaymentMethod?.qr_code_url && (
                <div
                  className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
                  style={{ background: 'rgba(10,5,20,0.97)' }}
                >
                  {/* Back button */}
                  <button
                    type="button"
                    onClick={() => setShowQrFullscreen(false)}
                    className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
                    style={{ background: 'rgba(139,92,246,0.25)', border: '1px solid rgba(139,92,246,0.4)' }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>

                  {/* QR image */}
                  <div
                    className="rounded-2xl overflow-hidden p-4"
                    style={{ background: 'white', boxShadow: '0 0 60px rgba(139,92,246,0.4)' }}
                  >
                    <img
                      src={selectedPaymentMethod.qr_code_url}
                      alt={`${selectedPaymentMethod.name} QR Code`}
                      className="w-72 h-72 sm:w-80 sm:h-80 object-contain"
                    />
                  </div>

                  {/* Label */}
                  <p className="mt-5 text-xs font-bold uppercase tracking-widest" style={{ color: '#8B5CF6' }}>
                    {selectedPaymentMethod.name.replace(/ payment/i, '')} — Scan to Pay
                  </p>
                  <p className="mt-1 text-xs text-purple-300/60">Take a screenshot to save this QR code</p>
                </div>
              )}


            </div>

            {/* Section 4: Upload Proof of Payment (Only if order_option is place_order or undefined) */}
            {(orderOption === 'place_order') && (
              <div ref={uploadSectionRef} className={stepCardClass}>
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <div className={stepNumClass} style={{ backgroundColor: '#8B5CF6' }}>5</div>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900">Upload Proof of Payment</h3>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {!receiptPreview ? (
                  <label className="block border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-colors">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleReceiptUpload(f);
                      }}
                      className="hidden"
                      disabled={uploadingReceipt}
                    />
                    {uploadingReceipt ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2 border-purple-500 border-t-transparent mx-auto" />
                        <p className="text-xs sm:text-sm text-gray-500 mt-1.5 sm:mt-2">Uploading...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 sm:h-10 sm:w-10 text-purple-500 mx-auto" />
                        <p className="text-xs sm:text-sm font-medium text-gray-700 mt-1.5 sm:mt-2">
                          Click to upload receipt
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-500">JPEG, PNG, WebP, GIF (Max 5MB)</p>
                      </>
                    )}
                  </label>
                ) : (
                  <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <img
                      src={receiptPreview}
                      alt="Receipt"
                      className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                        {receiptFile?.name || 'Receipt uploaded'}
                      </p>
                      <p className="text-[10px] sm:text-xs text-green-600">
                        {receiptImageUrl ? '✓ Uploaded' : 'Uploading...'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleReceiptRemove}
                      className="p-1.5 sm:p-2 rounded-lg hover:bg-red-100 text-gray-600 hover:text-red-600"
                    >
                      <X className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </div>
                )}
                {receiptError && (
                  <p className="text-xs sm:text-sm text-red-500">{receiptError}</p>
                )}
                {orderOption === 'place_order' && (
                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={!isFormValid || isPlacingOrder}
                    className={`w-full py-3 sm:py-4 rounded-xl font-semibold text-sm sm:text-lg transition-all ${
                      isFormValid && !isPlacingOrder
                        ? 'bg-pink-500 hover:bg-pink-600 text-white'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isPlacingOrder ? 'Placing Order...' : `Place Order - ₱${totalPrice.toFixed(0)}`}
                  </button>
                )}
              </div>
            </div>
            )}

            {/* Section 4 (Alternative): Order Message Action (when not place_order) */}
            {orderOption !== 'place_order' && (
              <div ref={uploadSectionRef} className={stepCardClass}>
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <div className={stepNumClass} style={{ backgroundColor: '#8B5CF6' }}>5</div>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900">Copy Order Form</h3>
                </div>
                <div
                  className="mb-4 rounded-xl p-3 sm:p-4 space-y-2.5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(45,27,78,0.9) 0%, rgba(26,15,46,0.95) 100%)',
                    border: '1px solid rgba(236, 72, 153, 0.35)',
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#EC4899' }}>
                    How it works
                  </p>
                  {[
                    'Send payment via E-WALLET, BANK OR REMITLY ABROAD.',
                    <>Screenshot your <span className="font-bold text-white">receipt</span> as proof of payment.</>,
                    'Copy the order form below and send it + receipt to our Messenger.',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div
                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                        style={{ backgroundColor: '#8B5CF6' }}
                      >
                        {i + 1}
                      </div>
                      <p className="text-xs sm:text-sm leading-snug" style={{ color: 'rgba(233,213,255,0.85)' }}>
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleCopyOrderMessage}
                    disabled={!isFormValid || isPlacingOrder}
                    className={`w-full py-3 sm:py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                      isFormValid && !isPlacingOrder
                        ? 'bg-purple-500 hover:bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {copiedOrderMessage ? <span>Copied!</span> : <><Copy className="h-4 w-4" /> Copy Order Form</>}
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    Copy the order form, then open Messenger to send it.
                  </p>
                </div>
              </div>
            )}

            {/* Section 5: Send Order (Order via Messenger only) */}
            {orderOption === 'order_via_messenger' && (
              <div className={stepCardClass}>
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <div className={stepNumClass} style={{ backgroundColor: '#EC4899' }}>6</div>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900">Send Order</h3>
                </div>
                <button
                  type="button"
                  onClick={handleOpenMessenger}
                  disabled={!isFormValid || isPlacingOrder}
                  className={`w-full py-3 sm:py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                    isFormValid && !isPlacingOrder
                      ? 'bg-pink-500 hover:bg-pink-600 text-white'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <MessageCircle className="h-4 w-4" /> Send Order to PGCShop
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </>
  );
};

export default GameItemOrderModal;
