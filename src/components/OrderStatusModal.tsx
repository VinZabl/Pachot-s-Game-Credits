import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  const shouldContinuePolling = useRef(true);

  const loadOrder = useCallback(async (isInitial: boolean) => {
    if (!orderId) return;
    
    if (isInitial) {
      setLoading(true);
    }
    
    const orderData = await fetchOrderById(orderId);
    
    if (orderData) {
      // Stop polling if order reaches final state (approved or rejected)
      if (orderData.status === 'approved' || orderData.status === 'rejected') {
        shouldContinuePolling.current = false;
      }
      
      // Always update the order data to ensure it stays visible
      setOrder(prevOrder => {
        if (!prevOrder || isInitial) {
          return orderData;
        }
        // Always update to latest order data, especially when status changes to approved or rejected
        if (prevOrder.status !== orderData.status || prevOrder.updated_at !== orderData.updated_at) {
          return orderData;
        }
        // If status is approved or rejected, always keep the order data visible
        if (orderData.status === 'approved' || orderData.status === 'rejected') {
          return orderData;
        }
        // Keep previous order if nothing changed
        return prevOrder;
      });
    } else {
      // If order data is not found, only clear on initial load
      if (isInitial) {
        setOrder(null);
      }
    }
    
    if (isInitial) {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, [orderId, fetchOrderById]);

  useEffect(() => {
    if (isOpen && orderId) {
      isInitialLoad.current = true;
      shouldContinuePolling.current = true;
      loadOrder(true);
      // Poll for order updates every 3 seconds, but stop if order is in final state
      const interval = setInterval(() => {
        // Only continue polling if we should (order is still pending or processing)
        if (shouldContinuePolling.current) {
          loadOrder(false);
        }
      }, 3000);
      return () => clearInterval(interval);
    } else {
      // Only reset when modal closes AND order is not approved or rejected
      // Keep order data if it was approved or rejected so user can see it when reopening
      if (order?.status !== 'approved' && order?.status !== 'rejected') {
        setOrder(null);
        setLoading(true);
        isInitialLoad.current = true;
        shouldContinuePolling.current = true;
      }
    }
  }, [isOpen, orderId, order, loadOrder]);

  if (!isOpen) return null;

  const getStatusDisplay = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return { text: 'Processing', icon: Loader2, color: '#FF69B4' };
      case 'processing':
        return { text: 'Processing', icon: Loader2, color: '#FF69B4' };
      case 'approved':
        return { text: 'Succeeded', icon: CheckCircle, color: '#FF69B4' };
      case 'rejected':
        return { text: 'Rejected', icon: XCircle, color: '#FF00FF' };
      default:
        return { text: 'Processing', icon: Loader2, color: '#FF69B4' };
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
          className="flex-shrink-0 p-6 flex items-center justify-between rounded-t-2xl" 
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
            {order && (order.status === 'pending' || order.status === 'processing') && (
              <p className="text-xs text-pink-300 mb-2 font-light">
                Please do not exit this website while your order is being processed
              </p>
            )}
            <h2 className="text-2xl font-semibold text-white">Order Status</h2>
            {order && (
              <p className="text-sm text-gray-400 mt-1">
                Order #{order.id.slice(0, 8)}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              // If order is succeeded and onSucceededClose is provided, call it
              if (order?.status === 'approved' && onSucceededClose) {
                onSucceededClose();
              } else {
                onClose();
              }
            }}
            className="p-2 hover:bg-pink-500/20 rounded-full transition-colors duration-200 flex-shrink-0 ml-2"
          >
            <X className="h-5 w-5 text-white" />
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
          
          <div className="p-6 pt-4">

        {loading && !order ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
          </div>
        ) : order ? (
          <div className="space-y-6">
            {/* Status Display */}
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex items-center gap-3">
                <StatusIcon 
                  className={`h-8 w-8 ${order.status === 'processing' || order.status === 'pending' ? 'animate-spin' : ''}`}
                  style={{ color: statusDisplay?.color }}
                />
                <span 
                  className="text-2xl font-semibold"
                  style={{ color: statusDisplay?.color }}
                >
                  {statusDisplay?.text}
                </span>
              </div>
              {order.created_at && (
                <p className="text-sm text-gray-400">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              )}
            </div>

            {/* Rejection Reason */}
            {order.status === 'rejected' && order.rejection_reason && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
                <h3 className="font-medium text-red-300 mb-2 flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Rejection Reason
                </h3>
                <p className="text-sm text-red-200 whitespace-pre-wrap leading-relaxed">
                  {order.rejection_reason}
                </p>
              </div>
            )}

            {/* Support Section */}
            {siteSettings?.footer_support_url && (
              <div className="mb-6">
                <a
                  href={siteSettings.footer_support_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-900/50 hover:bg-gray-900/70 border border-pink-500/30 hover:border-pink-500/50 transition-all duration-200 group"
                >
                  <MessageCircle className="h-5 w-5 text-pink-500 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-sm font-medium text-white group-hover:text-pink-500 transition-colors duration-200">
                    Having trouble or issues? Tap here to contact us
                  </span>
                </a>
              </div>
            )}

            {/* Order Details */}
            <div className="bg-gray-900 rounded-lg p-4 border border-pink-500/30 shadow-md">
              <h3 className="font-medium text-white mb-4">Order Details</h3>
              <div className="space-y-3">
                {order.order_items.map((item, index) => (
                  <div key={index} className="flex items-start gap-4 py-2 border-b border-pink-500/20 last:border-b-0">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-cafe-darkCard to-cafe-darkBg">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-xl opacity-20 text-gray-400">🎮</div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white">{item.name}</h4>
                      {item.selectedVariation && (
                        <p className="text-sm text-gray-400">Package: {item.selectedVariation.name}</p>
                      )}
                      {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                        <p className="text-sm text-gray-400">
                          Add-ons: {item.selectedAddOns.map(addOn => 
                            addOn.quantity && addOn.quantity > 1 
                              ? `${addOn.name} x${addOn.quantity}`
                              : addOn.name
                          ).join(', ')}
                        </p>
                      )}
                      <p className="text-sm text-gray-400">₱{item.totalPrice} × {item.quantity}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="font-semibold text-white">₱{item.totalPrice * item.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-pink-500/30">
                <div className="flex items-center justify-between text-xl font-semibold text-white">
                  <span>Total:</span>
                  <span className="text-white">₱{order.total_price}</span>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="bg-gray-900 rounded-lg p-4 border border-pink-500/30 shadow-md">
              <h3 className="font-medium text-white mb-4">Customer Information</h3>
              {(() => {
                const info = order.customer_info || {};
                const multipleAccounts = Array.isArray(info['Multiple Accounts']) ? info['Multiple Accounts'] : null;
                const hasMultipleAccounts = multipleAccounts && multipleAccounts.length > 0;
                const singleEntries = Object.entries(info).filter(([key]) => key !== 'Multiple Accounts');
                const hasSingleEntries = singleEntries.length > 0;

                if (hasMultipleAccounts) {
                  return (
                    <div className="space-y-4">
                      {multipleAccounts.map((account: { game?: string; package?: string; fields?: Record<string, string> }, accountIndex: number) => (
                        <div key={accountIndex} className="pb-4 border-b border-pink-500/20 last:border-b-0 last:pb-0">
                          <div className="mb-2">
                            <p className="text-sm font-semibold text-white">{account.game || 'Item'}</p>
                            {account.package && (
                              <p className="text-xs text-gray-400">Package: {account.package}</p>
                            )}
                          </div>
                          <div className="space-y-2 mt-2">
                            {account.fields && Object.entries(account.fields).map(([key, value]) => (
                              <p key={key} className="text-sm text-gray-400">
                                {key}: {String(value)}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                      {info['Payment Method'] && (
                        <div className="pt-2 border-t border-pink-500/20">
                          <p className="text-sm text-gray-400">
                            Payment Method: {String(info['Payment Method'])}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                }
                if (hasSingleEntries) {
                  return (
                    <div className="space-y-2">
                      {singleEntries.map(([key, value]) => (
                        <p key={key} className="text-sm text-gray-400">
                          {key}: {String(value)}
                        </p>
                      ))}
                    </div>
                  );
                }
                return (
                  <p className="text-sm text-gray-500 italic">No customer information recorded for this order.</p>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400">Order not found</p>
          </div>
        )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-pink-500/20">
              <p className="text-xs text-gray-400 text-center">
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
