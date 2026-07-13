import React, { useEffect, useState, useRef } from 'react';
import { X, CheckCircle, XCircle, Loader2, MessageCircle, Clock } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { useOrders } from '../hooks/useOrders';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { aggregateOrderItems } from '../utils/orderItems';

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
    } else {
      // Order not found (deleted or invalid) - clear stale ID and stop polling
      onSucceededClose?.();
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
        className="flex flex-col rounded-2xl max-w-xl w-full max-h-[90vh] shadow-2xl overflow-hidden relative" 
        style={{
          background: 'linear-gradient(180deg, #161922 0%, #0d0d0d 100%)',
          border: '1px solid rgba(255, 105, 180, 0.25)',
          boxShadow: '0 8px 32px 0 rgba(255, 105, 180, 0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button absolute positioned */}
        <button
          onClick={() => {
            if ((order?.status === 'approved' || order?.status === 'rejected') && onSucceededClose) {
              onSucceededClose();
            } else {
              onClose();
            }
          }}
          className="absolute top-4 right-4 z-50 p-2 hover:bg-pink-500/20 text-gray-400 hover:text-white rounded-full transition-colors duration-200"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content Section */}
        <div 
          className="flex-1 overflow-y-auto min-h-0 relative pt-6 sm:pt-8" 
          style={{ 
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain'
          }}
        >
          <div className="p-4 sm:p-6">

        {loading && !order ? (
          <div className="flex items-center justify-center py-8 sm:py-12">
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-pink-500" />
          </div>
        ) : order ? (
          <div className="space-y-5">
            {/* Status Display */}
            <div className="flex flex-col items-center gap-2 py-3 text-center">
              <div className="flex items-center justify-center gap-2 text-[#ff007f]">
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-pink-500">
                  {order.status === 'pending' || order.status === 'processing' ? 'ORDER SUBMITTED' : statusDisplay?.text.toUpperCase()}
                </h2>
                <StatusIcon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3px]" style={{ color: statusDisplay?.color }} />
              </div>
              
              {(order.status === 'pending' || order.status === 'processing') && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-gray-900/50 border border-gray-800/80 max-w-sm mx-auto w-full mt-2">
                  <Clock className="w-4 h-4 text-pink-500" />
                  <span className="text-[10px] sm:text-xs text-gray-300 font-bold tracking-wider uppercase">
                    Processing Time : 10 mins to few hours
                  </span>
                </div>
              )}

              {(order.status === 'pending' || order.status === 'processing') && (
                <p className="text-center text-xs sm:text-sm font-bold text-pink-500/90 leading-relaxed px-4 mt-2 max-w-sm mx-auto">
                  Please wait. Your order is being processed by our team
                </p>
              )}

              {order.status === 'rejected' && order.rejection_message && (
                <div className="mt-2 w-full max-w-md rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-center">
                  <p className="text-sm font-medium text-red-400">Message from store:</p>
                  <p className="text-sm text-white mt-1">{order.rejection_message}</p>
                </div>
              )}

              <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase mt-2">
                Order #{order.invoice_number || order.id.slice(0, 8)}
              </p>
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

            {/* Approval Message */}
            {order.status === 'approved' && order.approval_message && (
              <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3 sm:p-4">
                <h3 className="text-sm sm:text-base font-medium text-green-300 mb-1.5 sm:mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  Message from store
                </h3>
                <p className="text-xs sm:text-sm text-green-200 whitespace-pre-wrap leading-relaxed">
                  {order.approval_message}
                </p>
              </div>
            )}

            {/* Support Section */}
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

            {/* Unified Summary Card (New Order Submitted Design) */}
            <div className="bg-[#161922]/90 border border-gray-800/80 rounded-xl p-4 sm:p-5 shadow-lg space-y-4 text-xs sm:text-sm font-medium">
              {(() => {
                // Get game name (from the first order item)
                const gameName = order.order_items?.[0]?.name || 'Game Credits';
                
                // Get all order items (quantities and names)
                const itemsList = aggregateOrderItems(order.order_items).map(item => {
                  const varName = item.selectedVariation?.name || '';
                  return `${varName} ${item.quantity}x`;
                });

                // Extract player IDs
                const info = order.customer_info;
                const accountsArray = Array.isArray(info) ? info : null;
                const infoObj = info && typeof info === 'object' && !Array.isArray(info) ? (info as Record<string, unknown>) : {};
                const multipleAccounts = accountsArray ?? (Array.isArray(infoObj['Multiple Accounts']) ? infoObj['Multiple Accounts'] : null);
                
                const ids: string[] = [];
                if (multipleAccounts && multipleAccounts.length > 0) {
                  multipleAccounts.forEach((account: any) => {
                    if (account.fields) {
                      Object.values(account.fields).forEach((v) => {
                        if (v && typeof v === 'string') ids.push(v);
                      });
                    }
                  });
                } else {
                  Object.entries(infoObj)
                    .filter(([key]) => key !== 'Payment Method' && key !== 'Multiple Accounts')
                    .forEach(([, value]) => {
                      if (value && typeof value === 'string') ids.push(value);
                    });
                }

                // Get payment method
                const paymentMethod = infoObj['Payment Method'] || 'GCASH';

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs">GAME:</span>
                      <span className="text-white col-span-2">{gameName}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs">ORDER:</span>
                      <div className="text-white col-span-2 flex flex-col gap-0.5 font-bold">
                        {itemsList.map((itemStr, idx) => (
                          <span key={idx}>{itemStr}</span>
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
                        {String(paymentMethod).replace(/ payment/i, '')}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs">TOTAL:</span>
                      <span className="text-pink-500 font-black text-sm sm:text-base">₱{order.total_price}</span>
                    </div>
                  </div>
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
