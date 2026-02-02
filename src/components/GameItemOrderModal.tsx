import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Upload, HelpCircle, Copy, Download } from 'lucide-react';
import { MenuItem, Variation, CartItem } from '../types';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { useImageUpload } from '../hooks/useImageUpload';
import { useOrders } from '../hooks/useOrders';
import OrderStatusModal from './OrderStatusModal';

interface GameItemOrderModalProps {
  item: MenuItem;
  isOpen: boolean;
  onClose: () => void;
  onOrderPlaced?: () => void;
}

const GameItemOrderModal: React.FC<GameItemOrderModalProps> = ({
  item,
  isOpen,
  onClose,
  onOrderPlaced,
}) => {
  const { paymentMethods } = usePaymentMethods();
  const { uploadImage, uploading: uploadingReceipt } = useImageUpload();
  const { createOrder, fetchOrderById } = useOrders();

  const [selectedVariation, setSelectedVariation] = useState<Variation | undefined>(
    item.variations?.[0]
  );
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [isOrderStatusOpen, setIsOrderStatusOpen] = useState(false);
  const [showIdHelp, setShowIdHelp] = useState(false);
  const [copiedAccountName, setCopiedAccountName] = useState(false);
  const [copiedAccountNumber, setCopiedAccountNumber] = useState(false);
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

  // Auto-scroll to payment section when package is selected
  useEffect(() => {
    if (selectedVariation && paymentSectionRef.current) {
      setTimeout(() => {
        paymentSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    }
  }, [selectedVariation]);

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

  const totalPrice = useMemo(() => {
    if (!selectedVariation) return 0;
    const base = selectedVariation.price;
    if (item.isOnDiscount && item.discountPercentage) {
      return base - (base * item.discountPercentage) / 100;
    }
    return base;
  }, [selectedVariation, item.isOnDiscount, item.discountPercentage]);

  const getDiscountedPrice = (basePrice: number): number => {
    if (item.isOnDiscount && item.discountPercentage !== undefined) {
      return basePrice - (basePrice * item.discountPercentage) / 100;
    }
    return basePrice;
  };

  const isFormValid = useMemo(() => {
    if (!selectedVariation || !paymentMethodId || !receiptImageUrl) return false;
    if (hasCustomFields && item.customFields) {
      return item.customFields.every((field, idx) => {
        if (!field.required) return true;
        const key = `0_${idx}_${field.key}`;
        return !!customFieldValues[key]?.trim();
      });
    }
    return !!customFieldValues['default_ign']?.trim();
  }, [selectedVariation, paymentMethodId, receiptImageUrl, hasCustomFields, item.customFields, customFieldValues]);

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
    if (!selectedVariation || !selectedPaymentMethod || !receiptImageUrl) return;

    try {
      setIsPlacingOrder(true);
      setReceiptError(null);

      const customerInfo: Record<string, string | unknown> = {};
      customerInfo['Payment Method'] = selectedPaymentMethod.name;

      if (hasCustomFields && item.customFields) {
        const fields: Record<string, string> = {};
        item.customFields.forEach((field, idx) => {
          const key = `0_${idx}_${field.key}`;
          const val = customFieldValues[key];
          if (val) fields[field.label] = val;
        });
        if (Object.keys(fields).length > 0) {
          customerInfo['Multiple Accounts'] = [{
            game: item.name,
            package: selectedVariation.name,
            fields,
          }];
        }
      } else {
        if (customFieldValues['default_ign']) {
          customerInfo['IGN'] = customFieldValues['default_ign'];
        }
      }

      const cartItem: CartItem = {
        ...item,
        id: `${item.id}:::CART:::${Date.now()}-${Math.random().toString(36).slice(2)}`,
        quantity: 1,
        selectedVariation,
        totalPrice,
      };

      const newOrder = await createOrder({
        order_items: [cartItem],
        customer_info: customerInfo as Record<string, string | unknown>,
        payment_method_id: selectedPaymentMethod.id,
        receipt_url: receiptImageUrl,
        total_price: totalPrice,
      });

      if (newOrder) {
        setOrderId(newOrder.id);
        localStorage.setItem('current_order_id', newOrder.id);
        setIsOrderStatusOpen(true);
        onOrderPlaced?.();
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
    setSelectedVariation(item.variations?.[0]);
    setCustomFieldValues({});
    setPaymentMethodId(null);
    handleReceiptRemove();
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
          <div className="flex-shrink-0 p-3 sm:p-6 flex items-center justify-between border-b border-pink-500/20">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              {item.image && (
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-10 w-10 sm:h-14 sm:w-14 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-xl font-bold text-white">{item.name}</h2>
                {item.subtitle && (
                  <p className="text-xs text-pink-200/80 mt-0.5">{item.subtitle}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 sm:p-2 hover:bg-pink-500/20 rounded-full transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
            {/* Section 1: Enter ID / Customer Info */}
            <div className={stepCardClass}>
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <div className={stepNumClass} style={{ backgroundColor: '#8B5CF6' }}>1</div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                  {hasCustomFields && item.customFields?.[0]
                    ? item.customFields[0].label
                    : 'Enter ID'}
                </h3>
              </div>
              {hasCustomFields && item.customFields ? (
                <div className="space-y-2 sm:space-y-3">
                  {item.customFields.map((field, idx) => {
                    const key = `0_${idx}_${field.key}`;
                    return (
                      <div key={key}>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={customFieldValues[key] || ''}
                            onChange={(e) =>
                              setCustomFieldValues((prev) => ({ ...prev, [key]: e.target.value }))
                            }
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
                    );
                  })}
                </div>
              ) : (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Enter Player ID <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customFieldValues['default_ign'] || ''}
                      onChange={(e) =>
                        setCustomFieldValues((prev) => ({
                          ...prev,
                          default_ign: e.target.value,
                        }))
                      }
                      placeholder="e.g. 5363266446"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowIdHelp(!showIdHelp)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-500 hover:text-purple-600"
                    >
                      <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </div>
                  {showIdHelp && (
                    <p className="mt-2 text-xs text-gray-500">
                      To find your ID, click on the character icon. Your User ID is listed below your character name. Example: '5363266446'.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Section 2: Select Recharge / Package */}
            <div className={stepCardClass}>
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <div className={stepNumClass} style={{ backgroundColor: '#8B5CF6' }}>2</div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Select Recharge</h3>
              </div>
              {item.variations && item.variations.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {item.variations.map((v) => {
                    const price = getDiscountedPrice(v.price);
                    const isSelected = selectedVariation?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariation(v)}
                        className={`p-2.5 sm:p-4 rounded-lg border-2 text-left transition-all ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 bg-gray-50 hover:border-purple-300'
                        }`}
                      >
                        <div className="font-semibold text-gray-900 text-xs sm:text-base">
                          {v.name}
                        </div>
                        {v.description && (
                          <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {v.description}
                          </div>
                        )}
                        <div className="mt-1.5 sm:mt-2 text-sm sm:text-base font-bold text-red-600">₱{price.toFixed(0)}</div>
                        {item.isOnDiscount && item.discountPercentage && (
                          <div className="text-[10px] sm:text-xs text-gray-500 line-through">₱{v.price}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-gray-500">No packages available</p>
              )}
            </div>

            {/* Section 3: Select Payment */}
            <div ref={paymentSectionRef} className={stepCardClass}>
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <div className={stepNumClass} style={{ backgroundColor: '#8B5CF6' }}>3</div>
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
            </div>

            {/* Payment Details (below Section 3, before Section 4) */}
            {selectedPaymentMethod && (
              <div ref={paymentDetailsRef} className={stepCardClass}>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2 sm:mb-3">Payment Details</h3>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-sm sm:text-lg font-semibold text-gray-900">{selectedPaymentMethod.name}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                      <p className="text-xs sm:text-sm text-gray-500">Account Name:</p>
                      <button
                        type="button"
                        onClick={() => handleCopyAccountName(selectedPaymentMethod.account_name)}
                        className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-gray-200 hover:bg-purple-50 hover:border-purple-300 text-xs sm:text-sm font-medium text-gray-700 transition-colors"
                        title="Copy account name"
                      >
                        {copiedAccountName ? (
                          <span className="text-green-600">Copied!</span>
                        ) : (
                          <span className="flex items-center gap-1"><Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Copy</span>
                        )}
                      </button>
                    </div>
                    <p className="text-sm sm:text-base text-gray-900 font-medium">{selectedPaymentMethod.account_name}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                      <p className="text-xs sm:text-sm text-gray-500">Account Number:</p>
                      <button
                        type="button"
                        onClick={() => handleCopyAccountNumber(selectedPaymentMethod.account_number)}
                        className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-gray-200 hover:bg-purple-50 hover:border-purple-300 text-xs sm:text-sm font-medium text-gray-700 transition-colors"
                        title="Copy account number"
                      >
                        {copiedAccountNumber ? (
                          <span className="text-green-600">Copied!</span>
                        ) : (
                          <span className="flex items-center gap-1"><Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Copy</span>
                        )}
                      </button>
                    </div>
                    <p className="font-mono text-gray-900 font-medium text-base sm:text-xl">{selectedPaymentMethod.account_number}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 text-center">Other Option</p>
                    {selectedPaymentMethod.qr_code_url ? (
                      <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                        {!isMessengerBrowser && (
                          <button
                            type="button"
                            onClick={() => handleDownloadQRCode(selectedPaymentMethod.qr_code_url, selectedPaymentMethod.name)}
                            className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-gray-200 hover:bg-purple-50 hover:border-purple-300 text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5 sm:gap-2 transition-colors"
                            title="Download QR code"
                          >
                            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            Download QR
                          </button>
                        )}
                        {isMessengerBrowser && (
                          <p className="text-[10px] sm:text-xs text-gray-500 text-center">Long-press the QR code to save</p>
                        )}
                        <img
                          src={selectedPaymentMethod.qr_code_url}
                          alt={`${selectedPaymentMethod.name} QR Code`}
                          className="w-28 h-28 sm:w-32 sm:h-32 rounded-lg border-2 border-gray-200 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-lg border-2 border-gray-200 bg-gray-50 flex items-center justify-center mx-auto">
                        <p className="text-xs sm:text-sm text-gray-500 text-center px-2">QR code not available</p>
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-base sm:text-lg font-semibold text-gray-900">Amount: ₱{totalPrice.toFixed(0)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Upload Proof of Payment */}
            <div ref={uploadSectionRef} className={stepCardClass}>
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <div className={stepNumClass} style={{ backgroundColor: '#8B5CF6' }}>4</div>
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
                  {isPlacingOrder ? 'Placing Order...' : `Proceed to Payment - ₱${totalPrice.toFixed(0)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <OrderStatusModal
        orderId={orderId}
        isOpen={isOrderStatusOpen}
        onClose={() => {
          setIsOrderStatusOpen(false);
          if (orderId) {
            fetchOrderById(orderId).then((o) => {
              if (o?.status === 'approved') {
                localStorage.removeItem('current_order_id');
                setOrderId(null);
                handleClose();
              }
            });
          }
        }}
        onSucceededClose={() => {
          localStorage.removeItem('current_order_id');
          setOrderId(null);
          handleClose();
        }}
      />
    </>
  );
};

export default GameItemOrderModal;
