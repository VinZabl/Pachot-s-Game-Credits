import React, { useEffect, useState, useRef } from 'react';
import { X, CheckCircle, XCircle, Loader2, MessageCircle } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { useOrders } from '../hooks/useOrders';
import { useSiteSettings } from '../hooks/useSiteSettings';

interface OrderStatusModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSucceededClose?: () => void; // Callback when closing a succeeded order
}

const OrderStatusModal: React.FC<OrderStatusModalProps> = ({ orderId, isOpen, onClose, onSucceededClose }) => {
  const { fetchOrderById } = useOrders();
  const { siteSettings } = useSiteSettings();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (isOpen && orderId) {
      isInitialLoad.current = true;
      loadOrder(true);
      // Poll for order updates every 3 seconds
      const interval = setInterval(() => loadOrder(false), 3000);
      return () => clearInterval(interval);
    } else {
      // Reset when modal closes
      setOrder(null);
      setLoading(true);
      isInitialLoad.current = true;
    }
  }, [isOpen, orderId]);

  const loadOrder = async (isInitial: boolean) => {
    if (!orderId) return;
    
    if (isInitial) {
      setLoading(true);
    }
    
    const orderData = await fetchOrderById(orderId);
    
    if (orderData) {
      // Only update if status or updated_at changed (indicating a real update)
      // Do not auto-close on approve/reject; user closes via X to dismiss the banner
      setOrder(prevOrder => {
        if (!prevOrder || isInitial) {
          return orderData;
        }
        if (prevOrder.status !== orderData.status || prevOrder.updated_at !== orderData.updated_at) {
          return orderData;
        }
        return prevOrder;
      });
    }
    
    if (isInitial) {
      setLoading(false);
      isInitialLoad.current = false;
    }
  };

  if (!isOpen) return null;

  const getStatusDisplay = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return { text: 'Order Submitted', icon: CheckCircle, color: '#22c55e' };
      case 'processing':
        return { text: 'Order Submitted', icon: CheckCircle, color: '#22c55e' };
      case 'approved':
        return { text: 'Success!', icon: CheckCircle, color: '#22c55e' };
      case 'rejected':
        return { text: 'Rejected', icon: XCircle, color: '#FF00FF' };
      default:
        return { text: 'Order Submitted', icon: CheckCircle, color: '#22c55e' };
    }
  };

  const statusDisplay = order ? getStatusDisplay(order.status) : null;
  const StatusIcon = statusDisplay?.icon || Loader2;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="flex flex-col rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl overflow-hidden" 
        style={{
          background: 'rgba(26, 26, 26, 0.95)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1.5px solid rgba(255, 105, 180, 0.4)',
          boxShadow: '0 8px 32px 0 rgba(255, 105, 180, 0.2), 0 2px 8px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 105, 180, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div 
          className="flex-shrink-0 p-3 sm:p-6 flex items-center justify-between rounded-t-2xl" 
          style={{ 
            background: 'rgba(13, 13, 13, 0.9)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            zIndex: 20,
            borderBottom: '1.5px solid rgba(255, 105, 180, 0.3)',
            boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.3)'
          }}
        >
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-2xl font-semibold text-white">Order Status</h2>
            {order && (
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
                Order #{order.id.slice(0, 8)}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              // If order is completed (approved or rejected) and onSucceededClose is provided, call it
              if ((order?.status === 'approved' || order?.status === 'rejected') && onSucceededClose) {
                onSucceededClose();
              } else {
                onClose();
              }
            }}
            className="p-1.5 sm:p-2 hover:bg-pink-500/20 rounded-full transition-colors duration-200 flex-shrink-0 ml-2"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </button>
        </div>

        {/* Content Section */}
        <div 
          className="flex-1 overflow-y-auto min-h-0 relative" 
          style={{ 
            background: 'rgba(13, 13, 13, 0.8)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain'
          }}
        >
          {/* Fade-out gradient overlay at top - items fade as they approach header */}
          <div
            className="sticky top-0 left-0 right-0 z-10 pointer-events-none"
            style={{
              height: '32px',
              background: 'linear-gradient(to bottom, rgba(13, 13, 13, 0.9) 0%, rgba(13, 13, 13, 0.8) 20%, rgba(13, 13, 13, 0.6) 50%, transparent 100%)',
              marginBottom: '-32px'
            }}
          />
          
          <div className="p-3 sm:p-6 pt-2 sm:pt-4">

        {loading && !order ? (
          <div className="flex items-center justify-center py-8 sm:py-12">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-pink-500" />
          </div>
        ) : order ? (
          <div className="space-y-4 sm:space-y-6">
            {/* Status Display */}
            <div className="flex flex-col items-center gap-2 sm:gap-3 py-3 sm:py-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <StatusIcon 
                  className="h-6 w-6 sm:h-8 sm:w-8"
                  style={{ color: statusDisplay?.color }}
                />
                <span 
                  className="text-lg sm:text-2xl font-semibold"
                  style={{ color: statusDisplay?.color }}
                >
                  {statusDisplay?.text}
                </span>
              </div>
              {(order.status === 'pending' || order.status === 'processing') && (
                <p className="text-xs sm:text-sm text-gray-400 text-center">
                  Your orders are now being processed
                </p>
              )}
              {order.created_at && (
                <p className="text-xs sm:text-sm text-gray-400">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              )}
              {order.status === 'rejected' && order.rejection_message && (
                <div className="mt-2 w-full max-w-md rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-center">
                  <p className="text-sm font-medium text-red-400">Message from store:</p>
                  <p className="text-sm text-white mt-1">{order.rejection_message}</p>
                </div>
              )}
            </div>

            {/* Rejection Reason */}
            {order.status === 'rejected' && order.rejection_reason && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 sm:p-4">
                <h3 className="text-sm sm:text-base font-medium text-red-300 mb-1.5 sm:mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  Rejection Reason
                </h3>
                <p className="text-xs sm:text-sm text-red-200 whitespace-pre-wrap leading-relaxed">
                  {order.rejection_reason}
                </p>
              </div>
            )}

            {/* Support Section */}
            {siteSettings?.footer_support_url && (
              <div className="mb-4 sm:mb-6">
                <a
                  href={siteSettings.footer_support_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-lg bg-gray-900/50 hover:bg-gray-900/70 border border-pink-500/30 hover:border-pink-500/50 transition-all duration-200 group"
                >
                  <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-pink-500 group-hover:scale-110 transition-transform duration-200 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-white group-hover:text-pink-500 transition-colors duration-200">
                    Having trouble or issues? Tap here to contact us
                  </span>
                </a>
              </div>
            )}

            {/* Order Details */}
            <div>
              <h3 className="text-sm sm:text-base font-medium text-white mb-3 sm:mb-4">Order Details</h3>
              <div className="space-y-2 sm:space-y-3">
                {order.order_items.map((item, index) => (
                  <div key={index} className="flex items-start gap-2 sm:gap-4 py-1.5 sm:py-2 border-b border-pink-500/20 last:border-b-0">
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-gradient-to-br from-cafe-darkCard to-cafe-darkBg">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-base sm:text-xl opacity-20 text-gray-400">🎮</div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm sm:text-base font-medium text-white">{item.name}</h4>
                      {item.selectedVariation && (
                        <p className="text-xs sm:text-sm text-gray-400">Package: {item.selectedVariation.name}</p>
                      )}
                      {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                        <p className="text-xs sm:text-sm text-gray-400">
                          Add-ons: {item.selectedAddOns.map(addOn => 
                            addOn.quantity && addOn.quantity > 1 
                              ? `${addOn.name} x${addOn.quantity}`
                              : addOn.name
                          ).join(', ')}
                        </p>
                      )}
                      <p className="text-xs sm:text-sm text-gray-400">₱{item.totalPrice} × {item.quantity}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="text-sm sm:text-base font-semibold text-white">₱{item.totalPrice * item.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-pink-500/30">
                <div className="flex items-center justify-between text-base sm:text-xl font-semibold text-white">
                  <span>Total:</span>
                  <span className="text-white">₱{order.total_price}</span>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div>
              <h3 className="text-sm sm:text-base font-medium text-white mb-3 sm:mb-4">Customer Information</h3>
              {(() => {
                const info = order.customer_info || {};
                const multipleAccounts = Array.isArray(info['Multiple Accounts']) ? info['Multiple Accounts'] : null;
                const hasMultipleAccounts = multipleAccounts && multipleAccounts.length > 0;
                const singleEntries = Object.entries(info).filter(([key]) => key !== 'Multiple Accounts');
                const hasSingleEntries = singleEntries.length > 0;

                if (hasMultipleAccounts) {
                  return (
                    <div className="space-y-3 sm:space-y-4">
                      {multipleAccounts.map((account: { game?: string; package?: string; fields?: Record<string, string> }, accountIndex: number) => (
                        <div key={accountIndex} className="pb-3 sm:pb-4 border-b border-pink-500/20 last:border-b-0 last:pb-0">
                          <div className="mb-1.5 sm:mb-2">
                            <p className="text-xs sm:text-sm font-semibold text-white">{account.game || 'Item'}</p>
                            {account.package && (
                              <p className="text-[10px] sm:text-xs text-gray-400">Package: {account.package}</p>
                            )}
                          </div>
                          <div className="space-y-1 sm:space-y-2 mt-1.5 sm:mt-2">
                            {account.fields && Object.entries(account.fields).map(([key, value]) => (
                              <p key={key} className="text-xs sm:text-sm text-gray-400">
                                {key}: {String(value)}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                      {info['Payment Method'] && (
                        <p className="text-xs sm:text-sm text-gray-400 mt-1.5 sm:mt-2">
                          Payment Method: {String(info['Payment Method'])}
                        </p>
                      )}
                    </div>
                  );
                }
                if (hasSingleEntries) {
                  const customFieldEntries = singleEntries.filter(([key]) => key !== 'Payment Method');
                  const paymentMethod = info['Payment Method'];
                  return (
                    <div className="space-y-1.5 sm:space-y-2">
                      {customFieldEntries.map(([key, value]) => (
                        <p key={key} className="text-xs sm:text-sm text-gray-400">
                          {key}: {String(value)}
                        </p>
                      ))}
                      {paymentMethod && (
                        <p key="payment-method" className="text-xs sm:text-sm text-gray-400">
                          Payment Method: {String(paymentMethod)}
                        </p>
                      )}
                    </div>
                  );
                }
                return (
                  <p className="text-xs sm:text-sm text-gray-500 italic">No customer information recorded for this order.</p>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 sm:py-12">
            <p className="text-sm sm:text-base text-gray-400">Order not found</p>
          </div>
        )}

            {/* Footer */}
            <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-pink-500/20">
              <p className="text-[10px] sm:text-xs text-gray-400 text-center">
                by Pachot's Game Credits
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderStatusModal;
