import React, { useState, useMemo, useRef } from 'react';
import { ArrowLeft, Upload, X, Copy, Check, MousePointerClick, Download } from 'lucide-react';
import { CartItem, CustomField } from '../types';
import { usePaymentMethods, PaymentMethod } from '../hooks/usePaymentMethods';
import { useImageUpload } from '../hooks/useImageUpload';
import { useOrders } from '../hooks/useOrders';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { useMemberAuth } from '../hooks/useMemberAuth';
import { supabase } from '../lib/supabase';
import OrderStatusModal from './OrderStatusModal';

interface CheckoutProps {
  cartItems: CartItem[];
  getEffectiveUnitPrice: (item: CartItem) => number;
  totalPrice: number;
  onBack: () => void;
  onNavigateToMenu?: () => void; // Callback to navigate to menu (e.g., after order succeeded)
}

const CHECKOUT_STATE_STORAGE_KEY = 'pachot_checkout_state';

const Checkout: React.FC<CheckoutProps> = ({ cartItems, totalPrice, onBack, onNavigateToMenu }) => {
  const { paymentMethods } = usePaymentMethods();
  const { uploadImage, uploading: uploadingReceipt } = useImageUpload();
  const { createOrder } = useOrders();
  const { siteSettings } = useSiteSettings();
  const { currentMember } = useMemberAuth();
  const orderOption = siteSettings?.order_option || 'order_via_messenger';
  
  // Load checkout state from localStorage on mount
  const [step, setStep] = useState<'details' | 'payment' | 'order'>(() => {
    try {
      const stored = localStorage.getItem(CHECKOUT_STATE_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        return state.step || 'details';
      }
    } catch (error) {
      console.error('Error loading checkout state from localStorage:', error);
    }
    return 'details';
  });
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(() => {
    try {
      const stored = localStorage.getItem(CHECKOUT_STATE_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        return state.paymentMethod || null;
      }
    } catch (error) {
      console.error('Error loading checkout state from localStorage:', error);
    }
    return null;
  });
  
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(CHECKOUT_STATE_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        return state.customFieldValues || {};
      }
    } catch (error) {
      console.error('Error loading checkout state from localStorage:', error);
    }
    return {};
  });
  
  const [bulkInputValues, setBulkInputValues] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(CHECKOUT_STATE_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        return state.bulkInputValues || {};
      }
    } catch (error) {
      console.error('Error loading checkout state from localStorage:', error);
    }
    return {};
  });
  
  const [bulkSelectedGames, setBulkSelectedGames] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(CHECKOUT_STATE_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        return state.bulkSelectedGames || [];
      }
    } catch (error) {
      console.error('Error loading checkout state from localStorage:', error);
    }
    return [];
  });
  
  const [receiptPreview, setReceiptPreview] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(CHECKOUT_STATE_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        return state.receiptPreview || null;
      }
    } catch (error) {
      console.error('Error loading checkout state from localStorage:', error);
    }
    return null;
  });
  
  const paymentDetailsRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const [, setShowScrollIndicator] = useState(true);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasCopiedMessage, setHasCopiedMessage] = useState(false);
  const [copiedAccountNumber, setCopiedAccountNumber] = useState(false);
  const [copiedAccountName, setCopiedAccountName] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState<string | null>(null);
  const [invoiceNumberDate, setInvoiceNumberDate] = useState<string | null>(null);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);

  // Persist checkout state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CHECKOUT_STATE_STORAGE_KEY, JSON.stringify({
        step,
        paymentMethod,
        customFieldValues,
        bulkInputValues,
        bulkSelectedGames,
        receiptPreview
      }));
    } catch (error) {
      console.error('Error saving checkout state to localStorage:', error);
    }
  }, [step, paymentMethod, customFieldValues, bulkInputValues, bulkSelectedGames, receiptPreview]);

  // Extract original menu item ID from cart item ID (format: "menuItemId:::CART:::timestamp-random")
  // This allows us to group all packages from the same game together
  const getOriginalMenuItemId = (cartItemId: string): string => {
    const parts = cartItemId.split(':::CART:::');
    return parts.length > 1 ? parts[0] : cartItemId;
  };

  // Cart items that require custom fields (e.g. USER ID, IGN) — one entry per line item (no deduplication)
  // so each product/package can have different account info
  const cartItemsWithCustomFields = useMemo(() => {
    return cartItems.filter(item => item.customFields && item.customFields.length > 0);
  }, [cartItems]);

  // Unique games (by menu item ID) for bulk input UI and count
  const itemsWithCustomFields = useMemo(() => {
    const uniqueItems = new Map<string, typeof cartItems[0]>();
    cartItemsWithCustomFields.forEach(item => {
      const originalId = getOriginalMenuItemId(item.id);
      if (!uniqueItems.has(originalId)) {
        uniqueItems.set(originalId, item);
      }
    });
    return Array.from(uniqueItems.values());
  }, [cartItemsWithCustomFields]);

  const hasAnyCustomFields = cartItemsWithCustomFields.length > 0;

  // Detect if we can use multiple accounts (same game with different packages)
  const canUseMultipleAccounts = useMemo(() => {
    if (!hasAnyCustomFields) return false;
    
    // Group cart items by original menu item ID (game)
    const itemsByGame = new Map<string, typeof cartItems>();
    cartItems.forEach(item => {
      const originalId = getOriginalMenuItemId(item.id);
      if (!itemsByGame.has(originalId)) {
        itemsByGame.set(originalId, []);
      }
      itemsByGame.get(originalId)!.push(item);
    });
    
    // Check if any game has multiple different packages/variations
    for (const [gameId, items] of itemsByGame.entries()) {
      if (items.length > 1) {
        // Check if they have different variations
        const variationIds = new Set(items.map(item => item.selectedVariation?.id || 'none'));
        if (variationIds.size > 1) {
          return true;
        }
      }
    }
    
    return false;
  }, [cartItems, hasAnyCustomFields]);

  // Get items grouped by game and variation for multiple accounts
  const itemsByGameAndVariation = useMemo(() => {
    if (!canUseMultipleAccounts) return [];
    
    const grouped = new Map<string, Map<string, typeof cartItems[0][]>>();
    
    cartItems.forEach(item => {
      const originalId = getOriginalMenuItemId(item.id);
      const variationId = item.selectedVariation?.id || 'none';
      
      if (!grouped.has(originalId)) {
        grouped.set(originalId, new Map());
      }
      const gameGroup = grouped.get(originalId)!;
      
      if (!gameGroup.has(variationId)) {
        gameGroup.set(variationId, []);
      }
      gameGroup.get(variationId)!.push(item);
    });
    
    // Convert to array format
    const result: Array<{
      gameId: string;
      gameName: string;
      variationId: string;
      variationName: string;
      items: typeof cartItems[0][];
    }> = [];
    
    grouped.forEach((variations, gameId) => {
      const firstItem = Array.from(variations.values())[0][0];
      const gameName = firstItem.name;
      
      variations.forEach((items, variationId) => {
        const variationName = items[0].selectedVariation?.name || 'Default';
        result.push({
          gameId,
          gameName,
          variationId,
          variationName,
          items
        });
      });
    });
    
    return result;
  }, [cartItems, canUseMultipleAccounts]);

  // Get bulk input fields based on selected games - position-based
  // If selected games have N fields, show N bulk input fields
  const bulkInputFields = useMemo(() => {
    if (bulkSelectedGames.length === 0) return [];
    
    // Get all selected items (bulkSelectedGames contains original menu item IDs)
    const selectedItems = itemsWithCustomFields.filter(item => 
      bulkSelectedGames.includes(getOriginalMenuItemId(item.id))
    );
    
    if (selectedItems.length === 0) return [];
    
    // Find the maximum number of fields across all selected games
    const maxFields = Math.max(...selectedItems.map(item => item.customFields?.length || 0));
    
    if (maxFields === 0) return [];
    
    // Create fields array based on position (index)
    // Use the first selected item's fields as reference for labels
    const referenceItem = selectedItems[0];
    const fields: Array<{ index: number, field: CustomField | null }> = [];
    
    for (let i = 0; i < maxFields; i++) {
      // Try to get field from reference item, or use a placeholder
      const field = referenceItem.customFields?.[i] || null;
      fields.push({ index: i, field });
    }
    
    return fields;
  }, [bulkSelectedGames, itemsWithCustomFields]);

  // Do NOT sync bulk → per-item in an effect: that overwrites the first game when customer entered two different accounts.
  // Bulk only applies when user explicitly types in a bulk field (see handleBulkInputChange).

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Show payment details modal when payment method is selected
  React.useEffect(() => {
    if (paymentMethod) {
      setShowPaymentDetailsModal(true);
    }
  }, [paymentMethod]);

  // Check if buttons section is visible to hide scroll indicator
  React.useEffect(() => {
    if (!buttonsRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // If buttons are visible, hide the scroll indicator
          if (entry.isIntersecting) {
            setShowScrollIndicator(false);
          } else {
            setShowScrollIndicator(true);
          }
        });
      },
      {
        threshold: 0.1, // Trigger when 10% of the element is visible
        rootMargin: '-50px 0px' // Add some margin to trigger earlier
      }
    );

    observer.observe(buttonsRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const selectedPaymentMethod = paymentMethod;
  
  const handleBulkInputChange = (fieldKey: string, value: string) => {
    setBulkInputValues(prev => ({ ...prev, [fieldKey]: value }));
    // Apply bulk only when user types here — write to all cart items in bulkSelectedGames so per-item sections stay in sync
    if (bulkSelectedGames.length === 0) return;
    const fieldIndex = parseInt(fieldKey, 10);
    const selectedCartItems = cartItemsWithCustomFields.filter(item =>
      bulkSelectedGames.includes(getOriginalMenuItemId(item.id))
    );
    const updates: Record<string, string> = {};
    selectedCartItems.forEach((item) => {
      if (item.customFields?.[fieldIndex]) {
        const field = item.customFields[fieldIndex];
        updates[`${item.id}_${fieldIndex}_${field.key}`] = value;
      }
    });
    if (Object.keys(updates).length > 0) {
      setCustomFieldValues(prev => ({ ...prev, ...updates }));
    }
  };

  const handleBulkGameSelectionChange = (itemId: string, checked: boolean) => {
    // itemId is the cart item ID, convert to original menu item ID
    const originalId = getOriginalMenuItemId(itemId);
    if (checked) {
      setBulkSelectedGames(prev => [...prev, originalId]);
    } else {
      setBulkSelectedGames(prev => prev.filter(id => id !== originalId));
    }
  };


  const handleReceiptUpload = async (file: File) => {
    try {
      setReceiptError(null);
      setReceiptFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setReceiptPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to Supabase
      const url = await uploadImage(file, 'payment-receipts');
      setReceiptImageUrl(url);
    } catch (error) {
      console.error('Error uploading receipt:', error);
      setReceiptError(error instanceof Error ? error.message : 'Failed to upload receipt');
      setReceiptFile(null);
      setReceiptPreview(null);
    }
  };

  const handleReceiptRemove = () => {
    setReceiptFile(null);
    setReceiptImageUrl(null);
    setReceiptPreview(null);
    setReceiptError(null);
    setHasCopiedMessage(false); // Reset copy state when receipt is removed
    setGeneratedInvoiceNumber(null); // Reset invoice number when receipt is removed
    setInvoiceNumberDate(null);
  };

  // Helper function to get current date in Philippine timezone (Asia/Manila, UTC+8)
  const getPhilippineDate = () => {
    const now = new Date();
    // Convert to Philippine time (UTC+8)
    const philippineTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    // Get date components
    const year = philippineTime.getFullYear();
    const month = String(philippineTime.getMonth() + 1).padStart(2, '0');
    const day = String(philippineTime.getDate()).padStart(2, '0');
    return {
      dateString: `${year}-${month}-${day}`, // YYYY-MM-DD
      dayOfMonth: philippineTime.getDate()
    };
  };

  // Generate invoice number (format: {orderNumber}M{day}D{orderNumber})
  // Example: 1M17D1 = 1st order on the 17th day of the month
  //          1M17D2 = 2nd order on the 17th day of the month
  // Resets daily at 12:00 AM Philippine time (Asia/Manila, UTC+8)
  // The invoice number increments each time "Copy Order Message" is clicked (forceNew = true)
  // Subsequent calls (like "Order via Messenger") will reuse the same invoice number (forceNew = false)
  // Uses database (site_settings) to track invoice count with proper locking to prevent race conditions
  const generateInvoiceNumber = async (forceNew: boolean = false): Promise<string> => {
    const { dateString: todayStr, dayOfMonth } = getPhilippineDate();
    
    // Check if we already generated an invoice number for today and forceNew is false
    // If forceNew is false, reuse the existing number from state
    if (!forceNew && generatedInvoiceNumber && invoiceNumberDate === todayStr) {
      return generatedInvoiceNumber;
    }

    try {
      // Get invoice count from database (site_settings table)
      const countSettingId = 'invoice_count';
      const dateSettingId = 'invoice_count_date';
      
      // Fetch current invoice count and date from database
      // Use a transaction-like approach: fetch, check, update
      const { data: countData, error: countError } = await supabase
        .from('site_settings')
        .select('value')
        .eq('id', countSettingId)
        .maybeSingle();
      
      if (countError) {
        console.error('Error fetching invoice count:', countError);
        // Continue with default value
      }
      
      const { data: dateData, error: dateError } = await supabase
        .from('site_settings')
        .select('value')
        .eq('id', dateSettingId)
        .maybeSingle();
      
      if (dateError) {
        console.error('Error fetching invoice count date:', dateError);
        // Continue with default value
      }
      
      let currentCount = 0;
      const lastDate = dateData?.value || null;
      
      // Check if we need to reset (new day)
      if (lastDate !== todayStr) {
        // New day - reset the count to 0
        currentCount = 0;
        
        // Update both count and date in database atomically
        const { error: updateCountError } = await supabase
          .from('site_settings')
          .upsert({ id: countSettingId, value: '0', type: 'number', description: 'Current invoice count for the day' }, { onConflict: 'id' });
        
        if (updateCountError) {
          console.error('Error updating invoice count:', updateCountError);
        }
        
        const { error: updateDateError } = await supabase
          .from('site_settings')
          .upsert({ id: dateSettingId, value: todayStr, type: 'text', description: 'Date of the current invoice count' }, { onConflict: 'id' });
        
        if (updateDateError) {
          console.error('Error updating invoice date:', updateDateError);
        }
      } else {
        // Same day - get current count from database
        currentCount = countData?.value ? parseInt(countData.value, 10) : 0;
      }
      
      // If forceNew is true (Copy button clicked), always increment the count
      // This ensures each new order gets a new invoice number
      if (forceNew) {
        currentCount += 1;
        
        // Update count in database - ensure this completes before returning
        const { error: updateError } = await supabase
          .from('site_settings')
          .upsert({ id: countSettingId, value: currentCount.toString(), type: 'number', description: 'Current invoice count for the day' }, { onConflict: 'id' });
        
        if (updateError) {
          console.error('Error updating invoice count:', updateError);
          // Still use the incremented count even if update fails
        }
      } else {
        // If forceNew is false and no count exists, start at 1
        if (currentCount === 0) {
          currentCount = 1;
          const { error: updateError } = await supabase
            .from('site_settings')
            .upsert({ id: countSettingId, value: currentCount.toString(), type: 'number', description: 'Current invoice count for the day' }, { onConflict: 'id' });
          
          if (updateError) {
            console.error('Error updating invoice count:', updateError);
          }
        }
      }

      const orderNumber = currentCount;

      // Format: TD1M{day}D{orderNumber}
      // Example: TD1M17D1 (1st order on day 17), TD1M17D2 (2nd order on day 17), etc.
      // The first number is always 1, the last number is the order number
      const invoiceNumber = `TD1M${dayOfMonth}D${orderNumber}`;
      
      // Store the generated invoice number and date
      setGeneratedInvoiceNumber(invoiceNumber);
      setInvoiceNumberDate(todayStr);
      
      return invoiceNumber;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      // Fallback to a simple format if there's an error
      const { dayOfMonth } = getPhilippineDate();
      return `TD1M${dayOfMonth}D1`;
    }
  };

  // Generate the order message text
  const generateOrderMessage = (): string => {
    // Build custom fields section grouped by game
    let customFieldsSection = '';
    if (hasAnyCustomFields) {
      const gamesByFieldValues = new Map<string, { games: string[], fields: Array<{ label: string, value: string }> }>();
      
      cartItemsWithCustomFields.forEach(item => {
        const fields = item.customFields?.map((field, fieldIndex) => {
          const valueKey = `${item.id}_${fieldIndex}_${field.key}`;
          const value = customFieldValues[valueKey] || '';
          return value ? { label: field.label, value } : null;
        }).filter(Boolean) as Array<{ label: string, value: string }> || [];
        
        if (fields.length === 0) {
          // No field values, treat as item without fields
          itemsWithoutFields.push(cartItem);
          return;
        }
        
        const itemLabel = item.selectedVariation ? `${item.name} (${item.selectedVariation.name})` : item.name;
        const valueKey = fields.map(f => `${f.label}:${f.value}`).join('|');
        
        if (!gamesByFieldValues.has(valueKey)) {
          gamesByFieldValues.set(valueKey, { games: [], items: [], fields });
        }
        gamesByFieldValues.get(valueKey)!.games.push(itemLabel);
      });
      
      // Build sections for each group
      gamesByFieldValues.forEach(({ games, items, fields }) => {
        // Game name (only once if multiple games share same fields)
        lines.push(`GAME: ${games.join(', ')}`);
        
        // ID & SERVER or other fields
        if (fields.length === 1) {
          lines.push(`${fields[0].label}: ${fields[0].value}`);
        } else if (fields.length > 1) {
          // Combine fields with & if multiple
          const allValuesSame = fields.every(f => f.value === fields[0].value);
          if (allValuesSame) {
            // All values same, combine labels with &
            const labels = fields.map(f => f.label);
            if (labels.length === 2) {
              lines.push(`${labels[0]} & ${labels[1]}: ${fields[0].value}`);
            } else {
              const allButLast = labels.slice(0, -1).join(', ');
              const lastLabel = labels[labels.length - 1];
              lines.push(`${allButLast} & ${lastLabel}: ${fields[0].value}`);
            }
          } else {
            // Different values, show each field separately
            const fieldPairs = fields.map(f => `${f.label}: ${f.value}`);
            lines.push(fieldPairs.join(', '));
          }
        }
        
        // Order items
        items.forEach(item => {
          let orderLine = `ORDER: ${item.selectedVariation?.name || item.name}`;
          if (item.quantity > 1) {
            orderLine += ` x${item.quantity}`;
          }
          orderLine += ` - ₱${getEffectiveUnitPrice(item) * item.quantity}`;
          lines.push(orderLine);
        });
      });
      
      // Handle items without custom fields
      if (itemsWithoutFields.length > 0) {
        const uniqueGames = [...new Set(itemsWithoutFields.map(item => item.name))];
        lines.push(`GAME: ${uniqueGames.join(', ')}`);
        
        itemsWithoutFields.forEach(item => {
          let orderLine = `ORDER: ${item.selectedVariation?.name || item.name}`;
          if (item.quantity > 1) {
            orderLine += ` x${item.quantity}`;
          }
          orderLine += ` - ₱${getEffectiveUnitPrice(item) * item.quantity}`;
          lines.push(orderLine);
        });
      }
    } else {
      // No custom fields, single account mode
      const uniqueGames = [...new Set(cartItems.map(item => item.name))];
      lines.push(`GAME: ${uniqueGames.join(', ')}`);
      
      // Default IGN field
      const ign = customFieldValues['default_ign'] || '';
      if (ign) {
        lines.push(`IGN: ${ign}`);
      }
      
      // Order items
      cartItems.forEach(item => {
        let orderLine = `ORDER: ${item.selectedVariation?.name || item.name}`;
        if (item.quantity > 1) {
          orderLine += ` x${item.quantity}`;
        }
        orderLine += ` - ₱${getEffectiveUnitPrice(item) * item.quantity}`;
        lines.push(orderLine);
      });
    }
    
    // Payment
    const paymentLine = `PAYMENT: ${selectedPaymentMethod?.name || ''}${selectedPaymentMethod?.account_name ? ` - ${selectedPaymentMethod.account_name}` : ''}`;
    lines.push(paymentLine);
    
    // Total
    lines.push(`TOTAL: ₱${totalPrice}`);
    lines.push(''); // Break before payment receipt
    
    // Payment Receipt
    lines.push('PAYMENT RECEIPT:');
    if (receiptImageUrl) {
      lines.push(receiptImageUrl);
    }
    
    return lines.join('\n');
  };

    const orderDetails = `
🛒 Pachot's Game Credits ORDER

${customFieldsSection}

📋 ORDER DETAILS:
${cartItems.map(item => {
  let itemDetails = `• ${item.name}`;
  if (item.selectedVariation) {
    itemDetails += ` (${item.selectedVariation.name})`;
  }
  itemDetails += ` x${item.quantity} - ₱${item.totalPrice * item.quantity}`;
  return itemDetails;
}).join('\n')}

💰 TOTAL: ₱${totalPrice}

💳 Payment: ${selectedPaymentMethod?.name || ''}

📸 Payment Receipt: ${receiptImageUrl || ''}

Please confirm this order to proceed. Thank you for choosing Pachot's Game Credits! 🎮
    `.trim();

    return orderDetails;
  };

  const handleCopyMessage = async () => {
    try {
      // Create order first and allocate invoice from DB (invoice count) – single source of truth
      await saveOrderToDb();
      // Build message using that invoice (reuse – no extra increment)
      const message = await generateOrderMessage(false);

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isMac = /Mac/.test(navigator.platform) || /MacIntel|MacPPC|Mac68K/.test(navigator.platform);
      const useExecCommand = isIOS || isMac;

      let didCopy = false;
      if (useExecCommand) {
        const textarea = document.createElement('textarea');
        textarea.value = message;
        textarea.style.position = 'fixed';
        textarea.style.left = '0';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        textarea.setAttribute('readonly', '');
        textarea.setAttribute('contenteditable', 'true');
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, message.length);
        try {
          didCopy = document.execCommand('copy');
        } catch (e) {
          console.error('execCommand failed:', e);
        }
        document.body.removeChild(textarea);
        if (!didCopy) {
          try {
            await navigator.clipboard.writeText(message);
            didCopy = true;
          } catch (clipboardError) {
            console.error('Failed to copy on iOS/Mac:', clipboardError);
            alert('Failed to copy. Please try again or copy manually.');
          }
        }
      } else {
        try {
          await navigator.clipboard.writeText(message);
          didCopy = true;
        } catch (clipboardError) {
          const textarea = document.createElement('textarea');
          textarea.value = message;
          textarea.style.position = 'fixed';
          textarea.style.left = '-999999px';
          textarea.style.top = '-999999px';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          didCopy = document.execCommand('copy');
          document.body.removeChild(textarea);
        }
      }
      if (didCopy) {
        setCopied(true);
        setHasCopiedMessage(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  // Kept for potential future use (e.g. sync copy paths); order_via_messenger now uses DB invoice count
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const generateOrderMessageSync = async (invoiceNumber: string): Promise<string> => {
    // Build message lines (same logic as generateOrderMessage but without invoice generation)
    const lines: string[] = [];
    
    // Invoice number
    lines.push(`INVOICE # ${invoiceNumber}`);
    lines.push(''); // Break after invoice
    
    // Handle multiple accounts mode
    if (useMultipleAccounts && canUseMultipleAccounts) {
      // Group by game and variation
      const gameGroups = new Map<string, Array<{ variationName: string; items: CartItem[]; fields: Array<{ label: string, value: string }> }>>();
      
      itemsByGameAndVariation.forEach(({ gameId, gameName, variationId, variationName, items }) => {
        const firstItem = items[0];
        if (!firstItem.customFields) return;
        
        const fields = firstItem.customFields.map(field => {
          const valueKey = `${gameId}_${variationId}_${field.key}`;
          const value = customFieldValues[valueKey] || '';
          return value ? { label: field.label, value } : null;
        }).filter(Boolean) as Array<{ label: string, value: string }>;
        
        if (fields.length === 0) return;
        
        if (!gameGroups.has(gameName)) {
          gameGroups.set(gameName, []);
        }
        gameGroups.get(gameName)!.push({ variationName, items, fields });
      });
      
      // Build message for each game (game name mentioned once)
      gameGroups.forEach((variations, gameName) => {
        lines.push(`GAME: ${gameName}`);
        
        variations.forEach(({ variationName, items, fields }) => {
          // ID & SERVER or other fields
          if (fields.length === 1) {
            lines.push(`${fields[0].label}: ${fields[0].value}`);
          } else if (fields.length > 1) {
            // Combine fields with & if multiple
            const allValuesSame = fields.every(f => f.value === fields[0].value);
            if (allValuesSame) {
              const labels = fields.map(f => f.label);
              if (labels.length === 2) {
                lines.push(`${labels[0]} & ${labels[1]}: ${fields[0].value}`);
              } else {
                const allButLast = labels.slice(0, -1).join(', ');
                const lastLabel = labels[labels.length - 1];
                lines.push(`${allButLast} & ${lastLabel}: ${fields[0].value}`);
              }
            } else {
              // Different values, show each field separately
              fields.forEach(field => {
                lines.push(`${field.label}: ${field.value}`);
              });
            }
          }
          
          // Order items for this variation
          items.forEach(item => {
            const variationText = item.selectedVariation ? ` ${item.selectedVariation.name}` : '';
            const addOnsText = item.selectedAddOns && item.selectedAddOns.length > 0
              ? ` + ${item.selectedAddOns.map(a => a.name).join(', ')}`
              : '';
            lines.push(`ORDER: ${item.name}${variationText}${addOnsText} x${item.quantity} - ₱${getEffectiveUnitPrice(item) * item.quantity}`);
          });
        });
      });
    } else if (hasAnyCustomFields) {
      // Build game/order sections (single account or bulk mode)
      // Group games by their field values (for bulk input)
      const gamesByFieldValues = new Map<string, { games: string[], items: CartItem[], fields: Array<{ label: string, value: string }> }>();
      const itemsWithoutFields: CartItem[] = [];
      
      cartItems.forEach(cartItem => {
        const originalId = getOriginalMenuItemId(cartItem.id);
        const item = itemsWithCustomFields.find(i => getOriginalMenuItemId(i.id) === originalId);
        
        if (!item || !item.customFields || item.customFields.length === 0) {
          // Item without custom fields, handle separately
          itemsWithoutFields.push(cartItem);
          return;
        }
        
        const fields = item.customFields.map(field => {
          const valueKey = `${originalId}_${field.key}`;
          const value = customFieldValues[valueKey] || '';
          return value ? { label: field.label, value } : null;
        }).filter(Boolean) as Array<{ label: string, value: string }> || [];
        
        if (fields.length === 0) {
          // No field values, treat as item without fields
          itemsWithoutFields.push(cartItem);
          return;
        }
        
        // Create a key based on field values (to group games with same values)
        const valueKey = fields.map(f => `${f.label}:${f.value}`).join('|');
        
        if (!gamesByFieldValues.has(valueKey)) {
          gamesByFieldValues.set(valueKey, { games: [], items: [], fields });
        }
        const group = gamesByFieldValues.get(valueKey)!;
        if (!group.games.includes(item.name)) {
          group.games.push(item.name);
        }
        group.items.push(cartItem);
        group.fields = fields; // Use the fields from this item
      });
      
      // Build sections for each group
      gamesByFieldValues.forEach(({ games, items, fields }) => {
        // Game name (only once if multiple games share same fields)
        lines.push(`GAME: ${games.join(', ')}`);
        
        // ID & SERVER or other fields
        if (fields.length === 1) {
          lines.push(`${fields[0].label}: ${fields[0].value}`);
        } else if (fields.length > 1) {
          // Combine fields with & if multiple
          const allValuesSame = fields.every(f => f.value === fields[0].value);
          if (allValuesSame) {
            // All values same, combine labels with &
            const labels = fields.map(f => f.label);
            if (labels.length === 2) {
              lines.push(`${labels[0]} & ${labels[1]}: ${fields[0].value}`);
            } else {
              const allButLast = labels.slice(0, -1).join(', ');
              const lastLabel = labels[labels.length - 1];
              lines.push(`${allButLast} & ${lastLabel}: ${fields[0].value}`);
            }
          } else {
            // Different values, show each field separately
            const fieldPairs = fields.map(f => `${f.label}: ${f.value}`);
            lines.push(fieldPairs.join(', '));
          }
        }
        
        // Order items
        items.forEach(item => {
          let orderLine = `ORDER: ${item.selectedVariation?.name || item.name}`;
          if (item.quantity > 1) {
            orderLine += ` x${item.quantity}`;
          }
          orderLine += ` - ₱${getEffectiveUnitPrice(item) * item.quantity}`;
          lines.push(orderLine);
        });
      });
      
      // Handle items without custom fields
      if (itemsWithoutFields.length > 0) {
        const uniqueGames = [...new Set(itemsWithoutFields.map(item => item.name))];
        lines.push(`GAME: ${uniqueGames.join(', ')}`);
        
        itemsWithoutFields.forEach(item => {
          let orderLine = `ORDER: ${item.selectedVariation?.name || item.name}`;
          if (item.quantity > 1) {
            orderLine += ` x${item.quantity}`;
          }
          orderLine += ` - ₱${getEffectiveUnitPrice(item) * item.quantity}`;
          lines.push(orderLine);
        });
      }
    } else {
      // No custom fields, single account mode
      const uniqueGames = [...new Set(cartItems.map(item => item.name))];
      lines.push(`GAME: ${uniqueGames.join(', ')}`);
      
      // Default IGN field
      const ign = customFieldValues['default_ign'] || '';
      if (ign) {
        lines.push(`IGN: ${ign}`);
      }
      
      // Order items
      cartItems.forEach(item => {
        let orderLine = `ORDER: ${item.selectedVariation?.name || item.name}`;
        if (item.quantity > 1) {
          orderLine += ` x${item.quantity}`;
        }
        orderLine += ` - ₱${getEffectiveUnitPrice(item) * item.quantity}`;
        lines.push(orderLine);
      });
    }
    
    // Payment
    const paymentLine = `PAYMENT: ${selectedPaymentMethod?.name || ''}${selectedPaymentMethod?.account_name ? ` - ${selectedPaymentMethod.account_name}` : ''}`;
    lines.push(paymentLine);
    
    // Total
    lines.push(`TOTAL: ₱${totalPrice}`);
    lines.push(''); // Break before payment receipt
    
    // Payment Receipt
    lines.push('PAYMENT RECEIPT:');
    if (receiptImageUrl) {
      lines.push(receiptImageUrl);
    }
    
    return lines.join('\n');
  };

  const handleCopyAccountNumber = async (accountNumber: string) => {
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      if (isIOS) {
        const textarea = document.createElement('textarea');
        textarea.value = accountNumber;
        textarea.style.position = 'fixed';
        textarea.style.left = '0';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, accountNumber.length);
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) {
          setCopiedAccountNumber(true);
          setTimeout(() => setCopiedAccountNumber(false), 2000);
        }
      } else {
        try {
          await navigator.clipboard.writeText(accountNumber);
          setCopiedAccountNumber(true);
          setTimeout(() => setCopiedAccountNumber(false), 2000);
        } catch (clipboardError) {
          const textarea = document.createElement('textarea');
          textarea.value = accountNumber;
          textarea.style.position = 'fixed';
          textarea.style.left = '-999999px';
          textarea.style.top = '-999999px';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (successful) {
            setCopiedAccountNumber(true);
            setTimeout(() => setCopiedAccountNumber(false), 2000);
          }
        }
      }
    } catch (error) {
      console.error('Failed to copy account number:', error);
    }
  };

  const handleCopyAccountName = async (accountName: string) => {
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      if (isIOS) {
        const textarea = document.createElement('textarea');
        textarea.value = accountName;
        textarea.style.position = 'fixed';
        textarea.style.left = '0';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, accountName.length);
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) {
          setCopiedAccountName(true);
          setTimeout(() => setCopiedAccountName(false), 2000);
        }
      } else {
        try {
          await navigator.clipboard.writeText(accountName);
          setCopiedAccountName(true);
          setTimeout(() => setCopiedAccountName(false), 2000);
        } catch (clipboardError) {
          const textarea = document.createElement('textarea');
          textarea.value = accountName;
          textarea.style.position = 'fixed';
          textarea.style.left = '-999999px';
          textarea.style.top = '-999999px';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (successful) {
            setCopiedAccountName(true);
            setTimeout(() => setCopiedAccountName(false), 2000);
          }
        }
      }
    } catch (error) {
      console.error('Failed to copy account name:', error);
    }
  };

  // Detect if we're in Messenger's in-app browser
  const isMessengerBrowser = useMemo(() => {
    return /FBAN|FBAV/i.test(navigator.userAgent) || 
           /FB_IAB/i.test(navigator.userAgent);
  }, []);

  const handleDownloadQRCode = async (qrCodeUrl: string | null | undefined, paymentMethodName: string) => {
    // Only disable in Messenger's in-app browser
    // All external browsers (Chrome, Safari, Firefox, Edge, etc.) should work
    if (isMessengerBrowser || !qrCodeUrl) {
      // In Messenger, downloads don't work - users can long-press the QR code image
      // Also return early if no QR code URL is provided
      return;
    }
    
    // For all external browsers, fetch and download as blob to force download
    // This approach works in Chrome, Safari, Firefox, Edge, Opera, and other modern browsers
    try {
      const response = await fetch(qrCodeUrl, {
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-code-${paymentMethodName.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.style.display = 'none';
      
      // Append to body, click, then remove
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: try direct link with download attribute
      // This works in most browsers but may open instead of download in some cases
      try {
        const link = document.createElement('a');
        link.href = qrCodeUrl;
        link.download = `qr-code-${paymentMethodName.toLowerCase().replace(/\s+/g, '-')}.png`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
        }, 100);
      } catch (fallbackError) {
        console.error('Fallback download also failed:', fallbackError);
      }
    }
  };

  // Check for existing order on mount and auto-show modal if processing
  useEffect(() => {
    const checkExistingOrder = async () => {
      const storedOrderId = localStorage.getItem('current_order_id');
      if (storedOrderId) {
        const order = await fetchOrderById(storedOrderId);
        if (order) {
          setExistingOrderStatus(order.status);
          setOrderId(order.id);
          
          // Auto-show modal if order is pending or processing
          if (order.status === 'pending' || order.status === 'processing') {
            setIsOrderModalOpen(true);
          }
          
          // Clear localStorage only if order is approved (succeeded)
          // Keep rejected orders so user can still view them
          if (order.status === 'approved') {
            localStorage.removeItem('current_order_id');
            setExistingOrderStatus(null);
            setOrderId(null);
            // Clear checkout state when order is approved
            localStorage.removeItem(CHECKOUT_STATE_STORAGE_KEY);
          }
        });
        
        if (Object.keys(fields).length > 0) {
          accountsData.push({
            game: gameName,
            package: variationName,
            fields
          });
        }
      });
      
      customerInfo = accountsData.length > 0 ? accountsData : {};
    } else {
      // Single account mode: store as flat object
      const singleAccountInfo: Record<string, string> = {};
      
      // Add payment method
      if (selectedPaymentMethod) {
        singleAccountInfo['Payment Method'] = selectedPaymentMethod.name;
      }

      // Add custom fields
      if (hasAnyCustomFields) {
        itemsWithCustomFields.forEach((item) => {
          const originalId = getOriginalMenuItemId(item.id);
          item.customFields?.forEach(field => {
            const valueKey = `${originalId}_${field.key}`;
            const value = customFieldValues[valueKey];
            if (value) {
              singleAccountInfo[field.label] = value;
            }
          });
        });
      } else {
        // Default IGN field
        if (customFieldValues['default_ign']) {
          singleAccountInfo['IGN'] = customFieldValues['default_ign'];
        }
      }
      
      customerInfo = singleAccountInfo;
    }
    return customerInfo;
  };

  const handlePlaceOrder = async () => {
    if (!paymentMethod) {
      setReceiptError('Please select a payment method');
      return;
    }
    
    if (!receiptImageUrl) {
      setReceiptError('Please upload your payment receipt before placing the order');
      return;
    }

    // Save order to database if not already saved
    await saveOrderToDb();

    // Reuse the existing invoice number (don't generate a new one)
    // If no invoice number exists yet, it will generate one, but ideally Copy should be clicked first
    const orderDetails = await generateOrderMessage(false);
    const encodedMessage = encodeURIComponent(orderDetails);
    const messengerUrl = `https://m.me/pachotsgamecredits?text=${encodedMessage}`;
    
    window.open(messengerUrl, '_blank');
    
  };

  const handlePlaceOrderDirect = async () => {
    if (!paymentMethod) {
      setReceiptError('Please select a payment method');
      return;
    }
    
    if (!receiptImageUrl) {
      setReceiptError('Please upload your payment receipt before placing the order');
      return;
    }

    setIsPlacingOrder(true);
    setReceiptError(null);

    try {
      const savedOrderId = await saveOrderToDb();

      // Build customer info object
      const customerInfo: Record<string, string | unknown> = {};
      
      // Add payment method (shown in modals)
      customerInfo['Payment Method'] = selectedPaymentMethod.name;

      if (hasAnyCustomFields) {
        // One account block per cart item so each product/package keeps its own UID, IGN, etc.
        const multipleAccounts: Array<{ game: string; package: string; fields: Record<string, string> }> = [];
        cartItemsWithCustomFields.forEach((item) => {
          const fields: Record<string, string> = {};
          item.customFields?.forEach((field, fieldIndex) => {
            const valueKey = `${item.id}_${fieldIndex}_${field.key}`;
            const value = customFieldValues[valueKey];
            if (value) {
              fields[field.label] = value;
            }
          });
          if (Object.keys(fields).length > 0) {
            multipleAccounts.push({
              game: item.name,
              package: item.selectedVariation?.name ?? '',
              fields,
            });
          }
        });
        if (multipleAccounts.length > 0) {
          customerInfo['Multiple Accounts'] = multipleAccounts;
        }
      } else {
        // Single account: default IGN field
        if (customFieldValues['default_ign']) {
          customerInfo['IGN'] = customFieldValues['default_ign'];
        }
      }

      // Create order
      const newOrder = await createOrder({
        order_items: cartItems,
        customer_info: customerInfo as Record<string, string | unknown>,
        payment_method_id: selectedPaymentMethod.id,
        receipt_url: receiptImageUrl,
        total_price: totalPrice,
      });

      if (newOrder) {
        setOrderId(newOrder.id);
        setExistingOrderStatus(newOrder.status);
        localStorage.setItem('current_order_id', newOrder.id);
        setIsOrderModalOpen(true);
      } else {
        setReceiptError('Failed to create order. Please try again.');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      setReceiptError('Failed to create order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const isDetailsValid = useMemo(() => {
    if (!hasAnyCustomFields) {
      return customFieldValues['default_ign']?.trim() || false;
    }
    return cartItemsWithCustomFields.every(item => {
      if (!item.customFields) return true;
      return item.customFields.every((field, fieldIndex) => {
        if (!field.required) return true;
        const valueKey = `${item.id}_${fieldIndex}_${field.key}`;
        return customFieldValues[valueKey]?.trim() || false;
      });
    });
  }, [hasAnyCustomFields, cartItemsWithCustomFields, customFieldValues]);

  const renderOrderStatusModal = () => (
    <OrderStatusModal
      orderId={orderId}
      isOpen={isOrderModalOpen}
      onClose={() => {
        setIsOrderModalOpen(false);
        // Check order status when modal closes
        if (orderId) {
          fetchOrderById(orderId).then(order => {
            if (order) {
              setExistingOrderStatus(order.status);
              if (order.status === 'approved') {
                // Clear localStorage and state only for approved orders
                localStorage.removeItem('current_order_id');
                setExistingOrderStatus(null);
                setOrderId(null);
              }
              // For rejected orders, keep the IDs and localStorage so user can still view the order details
              // and the "Order Again" button will show
            }
          });
        }
      }}
      onSucceededClose={() => {
        localStorage.removeItem('current_order_id');
        // Clear checkout state when order succeeds
        localStorage.removeItem(CHECKOUT_STATE_STORAGE_KEY);
        setExistingOrderStatus(null);
        setOrderId(null);
        if (onNavigateToMenu) {
          onNavigateToMenu();
        }
      }}
    />
  );

  if (step === 'details') {
    return (
      <>
        <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button
            onClick={onBack}
            className="flex items-center text-whiteMuted hover:text-pink-500 transition-colors duration-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-3xl font-semibold text-white text-center flex-1">Order Details</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Customer Details Form */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-2xl font-medium text-white mb-6">Customer Information</h2>
            
            <form className="space-y-6">
              {/* Show count of items with custom fields */}
              {hasAnyCustomFields && cartItemsWithCustomFields.length > 0 && (
                <div className="mb-4 p-3 glass border border-pink-500/30 rounded-lg">
                  <p className="text-sm text-white">
                    <span className="font-semibold">{cartItemsWithCustomFields.length}</span> item{cartItemsWithCustomFields.length > 1 ? 's' : ''} require{cartItemsWithCustomFields.length === 1 ? 's' : ''} additional information
                  </p>
                </div>
              )}

              {/* Bulk Input Section */}
              {cartItemsWithCustomFields.length >= 2 && (
                <div className="mb-6 p-4 glass-strong border border-pink-500/30 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-4">Bulk Input</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Select games and fill fields once for all selected games.
                  </p>
                  
                  {/* Game Selection Checkboxes */}
                  <div className="space-y-2 mb-4">
                    {itemsWithCustomFields.map((item) => {
                      const originalId = getOriginalMenuItemId(item.id);
                      const isSelected = bulkSelectedGames.includes(originalId);
                      return (
                        <label
                          key={item.id}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleBulkGameSelectionChange(item.id, e.target.checked)}
                            className="w-4 h-4 text-pink-500 border-pink-500/30 rounded focus:ring-pink-500"
                          />
                          <span className="text-sm text-white">{item.name}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Input Fields - Only show if games are selected */}
                  {bulkSelectedGames.length > 0 && bulkInputFields.length > 0 && (
                    <div className="space-y-4 mt-4 pt-4 border-t border-pink-500/20">
                      {bulkInputFields.map(({ index, field }) => (
                        <div key={index}>
                          <label className="block text-sm font-medium text-white mb-2">
                            {field ? field.label : `Field ${index + 1}`} <span className="text-whiteMuted">(Bulk)</span> {field?.required && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            type="text"
                            value={bulkInputValues[index.toString()] || ''}
                            onChange={(e) => handleBulkInputChange(index.toString(), e.target.value)}
                            className="w-full px-4 py-3 glass border border-pink-500/30 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all duration-200 text-white placeholder-gray-400"
                            placeholder={field?.placeholder || field?.label || `Field ${index + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Custom Fields: one section per cart item so each can have different UID/IGN */}
              {hasAnyCustomFields ? (
                cartItemsWithCustomFields.map((item, itemIndex) => (
                  <div key={item.id} className="space-y-4 pb-6 border-b border-pink-500/20 last:border-b-0 last:pb-0">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                      {item.selectedVariation && (
                        <p className="text-sm text-gray-400">Package: {item.selectedVariation.name}</p>
                      )}
                      <p className="text-sm text-gray-400">Please provide the following information for this item</p>
                    </div>
                    {item.customFields?.map((field, fieldIndex) => {
                      const valueKey = `${item.id}_${fieldIndex}_${field.key}`;
                      const inputId = `input-${item.id}-${itemIndex}-${fieldIndex}-${field.key}`;
                      return (
                        <div key={`${item.id}-${fieldIndex}-${field.key}`}>
                          <label htmlFor={inputId} className="block text-sm font-medium text-white mb-2">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            id={inputId}
                            type="text"
                            name={valueKey}
                            autoComplete="off"
                            value={customFieldValues[valueKey] || ''}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setCustomFieldValues(prev => ({
                                ...prev,
                                [valueKey]: newValue
                              }));
                            }}
                            className="w-full px-4 py-3 glass border border-pink-500/30 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all duration-200 text-white placeholder-gray-400"
                            placeholder={field.placeholder || field.label}
                            required={field.required}
                          />
                        </div>
                        {firstItem.customFields.map((field) => {
                          const valueKey = `${gameId}_${variationId}_${field.key}`;
                          return (
                            <div key={field.key}>
                              <label className="block text-sm font-medium text-cafe-text mb-2">
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                              </label>
                              <input
                                type="text"
                                value={customFieldValues[valueKey] || ''}
                                onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [valueKey]: e.target.value }))}
                                className="w-full px-3 py-2 glass border border-cafe-primary/30 rounded-lg focus:ring-2 focus:ring-cafe-primary focus:border-cafe-primary transition-all duration-200 text-sm text-cafe-text placeholder-cafe-textMuted"
                                placeholder={field.placeholder || field.label}
                                required={field.required}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                ) : (
                  // Single account mode: show fields grouped by game
                  itemsWithCustomFields.map((item) => (
                    <div key={item.id} className="space-y-4 pb-6 border-b border-cafe-primary/20 last:border-b-0 last:pb-0">
                      <div className="mb-4 flex items-center gap-4">
                        {/* Game Icon */}
                        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-cafe-darkCard to-cafe-darkBg">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center ${item.image ? 'hidden' : ''}`}>
                            <div className="text-2xl opacity-20 text-gray-400">🎮</div>
                          </div>
                        </div>
                        
                        {/* Game Title and Description */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-cafe-text">{item.name}</h3>
                          <p className="text-sm text-cafe-textMuted">Please provide the following information for this game</p>
                        </div>
                      </div>
                      {item.customFields?.map((field) => {
                        const originalId = getOriginalMenuItemId(item.id);
                        const valueKey = `${originalId}_${field.key}`;
                        return (
                          <div key={valueKey}>
                            <label className="block text-sm font-medium text-cafe-text mb-2">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <input
                              type="text"
                              value={customFieldValues[valueKey] || ''}
                              onChange={(e) => setCustomFieldValues({
                                ...customFieldValues,
                                [valueKey]: e.target.value
                              })}
                              className="w-full px-3 py-2 glass border border-cafe-primary/30 rounded-lg focus:ring-2 focus:ring-cafe-primary focus:border-cafe-primary transition-all duration-200 text-sm text-cafe-text placeholder-cafe-textMuted"
                              placeholder={field.placeholder || field.label}
                              required={field.required}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))
                )
              ) : (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    IGN <span className="text-red-500">*</span>
                  </label>
                    <input
                      id="default-ign-input"
                      type="text"
                      name="default_ign"
                      autoComplete="off"
                      value={customFieldValues['default_ign'] || ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setCustomFieldValues(prev => ({
                          ...prev,
                          ['default_ign']: newValue
                        }));
                      }}
                      className="w-full px-4 py-3 glass border border-pink-500/30 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all duration-200 text-white placeholder-cafe-textMuted"
                      placeholder="In game name"
                      required
                    />
                </div>
              )}

              <button
                onClick={handleProceedToPayment}
                disabled={!isDetailsValid}
                className={`w-full py-4 rounded-xl font-medium text-lg transition-all duration-200 transform ${
                  isDetailsValid
                    ? 'text-white hover:opacity-90 hover:scale-[1.02]'
                    : 'glass text-whiteMuted cursor-not-allowed'
                }`}
                style={isDetailsValid ? { backgroundColor: '#FF69B4' } : {}}
              >
                Proceed to Payment
              </button>
            </form>
          </div>

          {/* Order Summary */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-2xl font-medium text-white mb-6">Order Summary</h2>
            
            <div className="space-y-4 mb-6">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-pink-500/30">
                  <div>
                    <h4 className="font-medium text-white">{item.name}</h4>
                    {item.selectedVariation && (
                      <p className="text-sm text-whiteMuted">Package: {item.selectedVariation.name}</p>
                    )}
                    {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                      <p className="text-sm text-whiteMuted">
                        Add-ons: {item.selectedAddOns.map(addOn => addOn.name).join(', ')}
                      </p>
                    )}
                    <p className="text-sm text-whiteMuted">₱{item.totalPrice} x {item.quantity}</p>
                  </div>
                  <span className="font-semibold text-white">₱{item.totalPrice * item.quantity}</span>
                </div>
              ))}
            </div>
            
            <div className="border-t border-pink-500/30 pt-4">
              <div className="flex items-center justify-between text-2xl font-semibold text-white">
                <span>Total:</span>
                <span className="text-white">₱{totalPrice}</span>
              </div>
            </div>
            
          </div>
        </div>

  // Payment Step
  if (step === 'payment') {
    return (
      <>
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <button
          onClick={() => setStep('details')}
          className="flex items-center text-whiteMuted hover:text-pink-500 transition-colors duration-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-3xl font-semibold text-white text-center flex-1">Payment</h1>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Payment Method Selection */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-2xl font-medium text-white mb-6">Choose Payment Method</h2>
          
          <div className="grid grid-cols-5 gap-3 md:gap-4 mb-6">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => {
                  setPaymentMethod(method);
                  setShowPaymentDetailsModal(true);
                }}
                title={method.name}
                className={`w-14 h-14 md:w-16 md:h-16 rounded-xl border-2 transition-all duration-200 flex items-center justify-center p-1.5 ${
                  paymentMethod === method.id
                    ? 'border-transparent text-white'
                    : 'glass border-pink-500/30 text-white hover:border-pink-500 hover:glass-strong'
                }`}
                style={paymentMethod === method.id ? { backgroundColor: '#FF69B4' } : {}}
              >
                {method.icon_url ? (
                  <img src={method.icon_url} alt={method.name} className="w-full h-full object-contain rounded" />
                ) : (
                  <span className="text-xl md:text-2xl">💳</span>
                )}
              </button>
            ))}
          </div>

          {/* Payment Details with QR Code */}
          {selectedPaymentMethod && (
            <div 
              ref={paymentDetailsRef}
              className="glass-strong rounded-lg p-6 mb-6 border border-pink-500/30"
            >
              <h3 className="font-medium text-white mb-4">Payment Details</h3>
              <div className="space-y-4">
                {/* Payment Method Name */}
                <div>
                  <p className="text-lg font-semibold text-white">{selectedPaymentMethod.name}</p>
                </div>
                
                {/* Account Name with Copy Button */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm text-whiteMuted">Account Name:</p>
                    <button
                      onClick={() => handleCopyAccountName(selectedPaymentMethod.account_name)}
                      className="px-3 py-1.5 glass-strong rounded-lg hover:bg-pink-500/20 transition-colors duration-200 flex-shrink-0 text-sm font-medium"
                      title="Copy account name"
                    >
                      {copiedAccountName ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <span className="text-white">Copy</span>
                      )}
                    </button>
                  </div>
                  <p className="text-white font-medium">{selectedPaymentMethod.account_name}</p>
                </div>
                
                {/* Other Option */}
                <div>
                  <h3 className="font-medium text-white text-center">Other Option</h3>
                </div>
                
                {/* Download QR Button and QR Image */}
                <div className="flex flex-col items-center gap-3">
                  {selectedPaymentMethod.qr_code_url ? (
                    <>
                      {!isMessengerBrowser && (
                        <button
                          onClick={() => handleDownloadQRCode(selectedPaymentMethod.qr_code_url, selectedPaymentMethod.name)}
                          className="px-3 py-1.5 glass-strong rounded-lg hover:bg-pink-500/20 transition-colors duration-200 text-sm font-medium text-white flex items-center gap-2"
                          title="Download QR code"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download QR</span>
                        </button>
                      )}
                      {isMessengerBrowser && (
                        <p className="text-xs text-whiteMuted text-center">Long-press the QR code to save</p>
                      )}
                      <img 
                        src={selectedPaymentMethod.qr_code_url} 
                        alt={`${selectedPaymentMethod.name} QR Code`}
                        className="w-32 h-32 rounded-lg border-2 border-pink-500/30 shadow-sm"
                      />
                    </>
                  ) : (
                    <div className="w-32 h-32 rounded-lg border-2 border-pink-500/30 shadow-sm bg-gray-100 flex items-center justify-center p-4">
                      <p className="text-sm text-whiteMuted text-center">QR code not available</p>
                    </div>
                  )}
                </div>
                
                {/* Account Number with Copy Button */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm text-whiteMuted">Account Number:</p>
                    <button
                      onClick={() => handleCopyAccountNumber(selectedPaymentMethod.account_number)}
                      className="px-3 py-1.5 glass-strong rounded-lg hover:bg-pink-500/20 transition-colors duration-200 flex-shrink-0 text-sm font-medium"
                      title="Copy account number"
                    >
                      {copiedAccountNumber ? (
                        <span className="text-green-400">Copied!</span>
                      ) : (
                        <span className="text-white">Copy</span>
                      )}
                    </button>
                  </div>
                  <p className="font-mono text-white font-medium text-xl md:text-2xl">{selectedPaymentMethod.account_number}</p>
                </div>
                
                {/* Amount and Instructions */}
                <div className="pt-2 border-t border-pink-500/20">
                  <p className="text-xl font-semibold text-white mb-2">Amount: ₱{totalPrice}</p>
                  <p className="text-sm text-whiteMuted">Press the copy button to copy the account number or download the QR code, make your payment, then click "Confirm" to proceed to the order page where you can upload your payment receipt.</p>
                </div>
              </div>
            </div>
          )}

          {/* Confirm Button */}
          <button
            onClick={handleProceedToOrder}
            disabled={!paymentMethod}
            className={`w-full py-4 rounded-xl font-medium text-lg transition-all duration-200 transform mb-6 ${
              paymentMethod
                ? 'text-white hover:opacity-90 hover:scale-[1.02]'
                : 'glass text-whiteMuted cursor-not-allowed'
            }`}
            style={paymentMethod ? { backgroundColor: '#FF69B4' } : {}}
          >
            Confirm
          </button>

          {/* Payment instructions */}
          <div className="glass border border-pink-500/30 rounded-lg p-4">
            <h4 className="font-medium text-white mb-2">📸 Payment Proof Required</h4>
            <p className="text-sm text-whiteMuted">
              After making your payment, you'll be able to upload a screenshot of your payment receipt in the next step. This helps us verify and process your order quickly.
            </p>
          </div>
        </div>
      </div>
    </div>
      {renderOrderStatusModal()}
      </>
    );
  }

  // Order Step
  if (step === 'order') {
    return (
      <>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button
            onClick={() => setStep('payment')}
            className="flex items-center text-whiteMuted hover:text-pink-500 transition-colors duration-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-3xl font-semibold text-white text-center flex-1">Order</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Final Order Summary */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-2xl font-medium text-white mb-6">Final Order Summary</h2>
            
            <div className="space-y-4 mb-6">
              <div className="glass-strong rounded-lg p-4 border border-pink-500/30">
                <h4 className="font-medium text-white mb-2">Customer Details</h4>
                {hasAnyCustomFields ? (
                  cartItemsWithCustomFields.map((item) => {
                    const fields = item.customFields?.map((field, fieldIndex) => {
                      const valueKey = `${item.id}_${fieldIndex}_${field.key}`;
                      const value = customFieldValues[valueKey];
                      return value ? (
                        <p key={valueKey} className="text-sm text-whiteMuted">
                          {field.label}: {value}
                        </p>
                      ) : null;
                    }).filter(Boolean);
                    
                    if (!fields || fields.length === 0) return null;
                    
                    return (
                      <div key={item.id} className="mb-3 pb-3 border-b border-pink-500/20 last:border-b-0 last:pb-0">
                        <p className="text-sm font-semibold text-white mb-1">
                          {item.name}{item.selectedVariation ? ` (${item.selectedVariation.name})` : ''}:
                        </p>
                        {fields}
                      </div>
                    );
                  })
                ) : (
                  customFieldValues['default_ign'] && (
                    <p className="text-sm text-whiteMuted">
                      IGN: {customFieldValues['default_ign']}
                    </p>
                  )
                )}
                {/* Payment Method Information */}
                {selectedPaymentMethod && (
                  <div className="mt-3 pt-3 border-t border-pink-500/20">
                    <p className="text-sm font-semibold text-white mb-1">Payment Method:</p>
                    <p className="text-sm text-whiteMuted">{selectedPaymentMethod.name}</p>
                  </div>
                )}
              </div>

              {cartItems.map((item) => (
                <div key={item.id} className="flex items-start gap-4 py-2 border-b border-pink-500/30">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-cafe-darkCard to-cafe-darkBg relative">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`absolute inset-0 w-full h-full flex items-center justify-center ${item.image ? 'hidden' : ''} fallback-icon`}>
                      <div className="text-xl opacity-20 text-gray-400">🎮</div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white">{item.name}</h4>
                    {item.selectedVariation && (
                      <p className="text-sm text-whiteMuted">Package: {item.selectedVariation.name}</p>
                    )}
                    {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                      <p className="text-sm text-whiteMuted">
                        Add-ons: {item.selectedAddOns.map(addOn => 
                          addOn.quantity && addOn.quantity > 1 
                            ? `${addOn.name} x${addOn.quantity}`
                            : addOn.name
                        ).join(', ')}
                      </p>
                    )}
                    <p className="text-sm text-whiteMuted">₱{item.totalPrice} x {item.quantity}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="font-semibold text-white">₱{item.totalPrice * item.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="pt-4 mb-6">
              <div className="flex items-center justify-between text-2xl font-semibold text-white">
                <span>Total:</span>
                <span className="text-white">₱{totalPrice}</span>
              </div>
            </div>
          </div>

          {/* Receipt Upload and Place Order */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-2xl font-medium text-white mb-6">Payment Receipt</h2>
            
            {/* Receipt Upload Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-white mb-2">
                Payment Receipt <span className="text-red-400">*</span>
              </label>
              
              {!receiptPreview ? (
                <div className="relative glass border-2 border-dashed border-pink-500/30 rounded-lg p-6 text-center hover:border-pink-500 transition-colors duration-200">
                  <div className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-cafe-primary text-white">
                    1
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleReceiptUpload(file);
                      }
                    }}
                    className="hidden"
                    id="receipt-upload"
                    disabled={uploadingReceipt}
                  />
                  <label
                    htmlFor="receipt-upload"
                    className={`cursor-pointer flex flex-col items-center space-y-2 ${uploadingReceipt ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {uploadingReceipt ? (
                      <>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
                        <span className="text-sm text-whiteMuted">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-pink-500" />
                        <span className="text-sm text-white">Click to upload receipt</span>
                        <span className="text-xs text-whiteMuted">JPEG, PNG, WebP, or GIF (Max 5MB)</span>
                      </>
                    )}
                  </label>
                </div>
              ) : (
                <div className="relative glass border border-pink-500/30 rounded-lg p-4">
                  <div className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-cafe-primary text-white">
                    1
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <img
                        src={receiptPreview}
                        alt="Receipt preview"
                        className="w-20 h-20 object-cover rounded-lg border border-pink-500/30"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {receiptFile?.name || 'Receipt uploaded'}
                      </p>
                      <p className="text-xs text-whiteMuted">
                        {receiptImageUrl ? '✓ Uploaded successfully' : 'Uploading...'}
                      </p>
                    </div>
                    <button
                      onClick={handleReceiptRemove}
                      className="flex-shrink-0 p-2 glass-strong rounded-lg hover:bg-red-500/20 transition-colors duration-200"
                      disabled={uploadingReceipt}
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </div>
              )}

              {receiptError && (
                <p className="mt-2 text-sm text-red-400">{receiptError}</p>
              )}
            </div>

            <div ref={buttonsRef}>
              {/* Copy button - only show for order_via_messenger */}
              {orderOption === 'order_via_messenger' && (
                <button
                  onClick={handleCopyMessage}
                  disabled={uploadingReceipt || !paymentMethod || !receiptImageUrl}
                  className={`w-full py-3 rounded-xl font-medium transition-all duration-200 transform mb-3 flex items-center justify-center space-x-2 ${
                    !uploadingReceipt && paymentMethod && receiptImageUrl
                      ? 'glass border border-pink-500/30 text-white hover:border-pink-500 hover:glass-strong'
                      : 'glass border border-pink-500/20 text-whiteMuted cursor-not-allowed'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="h-5 w-5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-5 w-5" />
                      <span>Copy Order Message</span>
                    </>
                  )}
                </button>
              )}

              {/* Order placement buttons - different based on order_option */}
              {orderOption === 'place_order' ? (
                <>
                  {/* Direct Order Placement */}
                  {existingOrderStatus && existingOrderStatus !== 'approved' && existingOrderStatus !== 'rejected' && (
                    <button
                      onClick={() => setIsOrderModalOpen(true)}
                      className="w-full py-4 rounded-xl font-medium text-lg transition-all duration-200 transform text-white hover:opacity-90 hover:scale-[1.02]"
                      style={{ backgroundColor: '#FF69B4' }}
                    >
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-cafe-primary text-white">
                        2
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <Eye className="h-5 w-5" />
                        View Order
                      </div>
                    </button>
                  )}
                  {(!existingOrderStatus || existingOrderStatus === 'rejected') && (
                    <button
                      onClick={handlePlaceOrderDirect}
                      disabled={!paymentMethod || !receiptImageUrl || uploadingReceipt || isPlacingOrder}
                      className={`relative w-full py-4 rounded-xl font-medium text-lg transition-all duration-200 transform ${
                        paymentMethod && receiptImageUrl && !uploadingReceipt && !isPlacingOrder
                          ? 'text-white hover:opacity-90 hover:scale-[1.02]'
                          : 'glass text-whiteMuted cursor-not-allowed'
                      }`}
                      style={paymentMethod && receiptImageUrl && !uploadingReceipt && !isPlacingOrder ? { backgroundColor: '#FF69B4' } : {}}
                    >
                      <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        paymentMethod && receiptImageUrl && !uploadingReceipt && !isPlacingOrder
                          ? 'bg-cafe-primary text-white'
                          : 'bg-cafe-textMuted/30 text-whiteMuted'
                      }`}>
                        2
                      </div>
                      {isPlacingOrder ? 'Placing Order...' : existingOrderStatus === 'rejected' ? 'Order Again' : 'Place Order'}
                    </button>
                  )}
                  <p className="text-xs text-whiteMuted text-center mt-3">
                    Your order will be processed directly. You can track its status after placing the order.
                  </p>
                </>
              ) : (
                <>
                  {/* Messenger Order Placement */}
                  <button
                    onClick={handlePlaceOrder}
                    disabled={!paymentMethod || !receiptImageUrl || uploadingReceipt || !hasCopiedMessage}
                    className={`w-full py-4 rounded-xl font-medium text-lg transition-all duration-200 transform ${
                      paymentMethod && receiptImageUrl && !uploadingReceipt && hasCopiedMessage
                        ? 'text-white hover:opacity-90 hover:scale-[1.02]'
                        : 'glass text-whiteMuted cursor-not-allowed'
                    }`}
                    style={paymentMethod && receiptImageUrl && !uploadingReceipt && hasCopiedMessage ? { backgroundColor: '#FF69B4' } : {}}
                  >
                    <Download className="h-4 w-4" />
                    <span>Download QR</span>
                  </button>
                  
                  <p className="text-xs text-whiteMuted text-center mt-3">
                    You'll be redirected to Facebook Messenger to confirm your order. Your receipt has been uploaded and will be included in the message.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order Status Modal */}
      <OrderStatusModal
        orderId={orderId}
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSucceededClose={onNavigateToMenu}
      />
    </div>
  );
};

export default Checkout;