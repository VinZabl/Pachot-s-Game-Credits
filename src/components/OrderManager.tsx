import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, Loader2, Eye, Download, X, Copy, Search } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { useOrders } from '../hooks/useOrders';

const OrderManager: React.FC = () => {
  const { orders, loading, fetchOrders, updateOrderStatus } = useOrders();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [, setTimeKey] = useState(0); // Force re-render for time updates
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [selectedRejectionReason, setSelectedRejectionReason] = useState<string>('');
  const [customRejectionText, setCustomRejectionText] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Mark orders as viewed when component mounts or orders change
  useEffect(() => {
    const viewedIds = sessionStorage.getItem('viewed_order_ids');
    const viewedSet = viewedIds ? new Set(JSON.parse(viewedIds)) : new Set();
    
    // Mark all current orders as viewed
    const currentOrderIds = orders.map(order => order.id);
    currentOrderIds.forEach(id => viewedSet.add(id));
    
    sessionStorage.setItem('viewed_order_ids', JSON.stringify(Array.from(viewedSet)));
  }, [orders]);

  // Update time indicators every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeKey(prev => prev + 1);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const handleCopyField = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleApprove = async (orderId: string) => {
    const success = await updateOrderStatus(orderId, 'approved');
    if (success) {
      setIsModalOpen(false);
      setSelectedOrder(null);
    }
  };

  const handleRejectClick = (orderId: string) => {
    setRejectingOrderId(orderId);
    setIsRejectModalOpen(true);
    setSelectedRejectionReason('');
    setCustomRejectionText('');
  };

  const handleRejectConfirm = async () => {
    if (!rejectingOrderId) return;

    // Build rejection reason
    let rejectionReason = '';
    if (selectedRejectionReason) {
      rejectionReason = selectedRejectionReason;
      if (customRejectionText.trim()) {
        rejectionReason += ` - ${customRejectionText.trim()}`;
      }
    } else if (customRejectionText.trim()) {
      rejectionReason = customRejectionText.trim();
    } else {
      // If no reason selected, use a default
      rejectionReason = 'Order rejected by admin';
    }

    const success = await updateOrderStatus(rejectingOrderId, 'rejected', rejectionReason);
    if (success) {
      setIsRejectModalOpen(false);
      setIsModalOpen(false);
      setSelectedOrder(null);
      setRejectingOrderId(null);
      setSelectedRejectionReason('');
      setCustomRejectionText('');
    }
  };

  const handleRejectCancel = () => {
    setIsRejectModalOpen(false);
    setRejectingOrderId(null);
    setSelectedRejectionReason('');
    setCustomRejectionText('');
  };

  // Filter orders based on search query
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) {
      return orders;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return orders.filter(order => {
      // Search by order ID (full or partial)
      if (order.id.toLowerCase().includes(query)) {
        return true;
      }

      // Search in customer_info fields
      if (order.customer_info) {
        // Handle multiple accounts case
        if (order.customer_info['Multiple Accounts']) {
          const multipleAccounts = order.customer_info['Multiple Accounts'] as Array<{
            game: string;
            package: string;
            fields: Record<string, string>;
          }>;
          
          for (const account of multipleAccounts) {
            // Check game name
            if (account.game.toLowerCase().includes(query)) {
              return true;
            }
            // Check package name
            if (account.package.toLowerCase().includes(query)) {
              return true;
            }
            // Check all fields in the account
            for (const [key, value] of Object.entries(account.fields)) {
              if (key.toLowerCase().includes(query) || String(value).toLowerCase().includes(query)) {
                return true;
              }
            }
          }
        } else {
          // Single account mode - search all customer_info fields
          for (const [key, value] of Object.entries(order.customer_info)) {
            // Skip payment method as it's less useful for search
            if (key === 'Payment Method') continue;
            
            if (key.toLowerCase().includes(query) || String(value).toLowerCase().includes(query)) {
              return true;
            }
          }
        }
      }

      return false;
    });
  }, [orders, searchQuery]);

  const getTimeAgo = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInSeconds = Math.floor((now.getTime() - created.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'New';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
            Pending
          </span>
        );
      case 'processing':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            Processing
          </span>
        );
      case 'approved':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-medium border" style={{ backgroundColor: 'rgba(75, 31, 66, 0.1)', color: '#4B1F42', borderColor: 'rgba(75, 31, 66, 0.3)' }}>
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-medium border" style={{ backgroundColor: 'rgba(75, 31, 66, 0.1)', color: '#4B1F42', borderColor: 'rgba(75, 31, 66, 0.3)' }}>
            Rejected
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-6">
      <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-6">
        {/* Search Bar */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order number or customer details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        <button
          onClick={() => fetchOrders()}
          className="px-3 py-1.5 md:px-4 md:py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 text-gray-700 flex items-center gap-1.5 md:gap-2 shadow-sm text-xs md:text-sm"
        >
          <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
          Refresh
        </button>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">
            {searchQuery ? `No orders found matching "${searchQuery}"` : 'No orders found'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
           {filteredOrders.map((order) => (
             <div
               key={order.id}
               className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-6 hover:shadow-md transition-shadow duration-200 relative"
             >
               {/* Time Indicator and Order Number */}
               <div className="absolute top-3 left-3">
                 <div className="flex flex-col gap-1.5">
                   <span className={`px-2 py-1 rounded text-xs font-medium ${
                     getTimeAgo(order.created_at) === 'New'
                       ? 'bg-green-100 text-green-800 border border-green-200'
                       : 'bg-gray-100 text-gray-600 border border-gray-200'
                   }`}>
                     {getTimeAgo(order.created_at)}
                   </span>
                   <h3 className="text-sm font-semibold text-gray-900">
                     Order #{order.id.slice(0, 8)}
                   </h3>
                 </div>
               </div>

               {/* Order Header with Status */}
               <div className="flex items-start justify-end mb-4 pl-32 pr-2">
                 <div className="flex flex-col items-end gap-1.5">
                   {getStatusBadge(order.status)}
                   <p className="text-xs text-gray-500">
                     {new Date(order.created_at).toLocaleString()}
                   </p>
                 </div>
               </div>

              {/* Order Summary */}
              <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Price</p>
                  <p className="text-base font-semibold text-gray-900">₱{order.total_price}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Items</p>
                  <p className="text-sm font-semibold text-gray-900">{order.order_items.length} item(s)</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">MOP</p>
                  <p className="text-sm font-semibold text-gray-900 capitalize">{order.payment_method_id}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                <button
                  onClick={() => handleViewOrder(order)}
                  className="px-3 py-1.5 md:px-4 md:py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-gray-700 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium"
                >
                  <Eye className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">View Details</span>
                  <span className="sm:hidden">View</span>
                </button>
                 {order.status === 'pending' && (
                   <>
                     <button
                       onClick={() => handleApprove(order.id)}
                       className="px-3 py-1.5 md:px-4 md:py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors duration-200 text-green-700 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium"
                     >
                       <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                       Approve
                     </button>
                     <button
                       onClick={() => handleRejectClick(order.id)}
                       className="px-3 py-1.5 md:px-4 md:py-2 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors duration-200 text-red-700 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium"
                     >
                       <XCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                       Reject
                     </button>
                   </>
                 )}
                 {order.status === 'processing' && (
                   <>
                     <button
                       onClick={() => handleApprove(order.id)}
                       className="px-3 py-1.5 md:px-4 md:py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors duration-200 text-green-700 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium"
                     >
                       <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                       Approve
                     </button>
                     <button
                       onClick={() => handleRejectClick(order.id)}
                       className="px-3 py-1.5 md:px-4 md:py-2 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors duration-200 text-red-700 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium"
                     >
                       <XCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                       Reject
                     </button>
                   </>
                 )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Detail Modal */}
      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white rounded-lg shadow-xl p-3 md:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 md:mb-6 pb-3 md:pb-4 border-b border-gray-200">
              <h2 className="text-lg md:text-2xl font-semibold text-gray-900">
                Order #{selectedOrder.id.slice(0, 8)}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedOrder(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4 md:space-y-6">
              {/* Order Status */}
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-xs md:text-sm text-gray-600">Status:</span>
                {getStatusBadge(selectedOrder.status)}
              </div>

              {/* Order Items */}
              <div className="bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-200">
                <h3 className="text-sm md:text-base font-medium text-gray-900 mb-3 md:mb-4">Order Items</h3>
                <div className="space-y-2 md:space-y-3">
                  {selectedOrder.order_items.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 md:gap-4 py-2 md:py-3 border-b border-gray-200 last:border-b-0">
                      <div className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-xl opacity-40 text-gray-400">🎮</div>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm md:text-base font-medium text-gray-900">{item.name}</h4>
                        {item.selectedVariation && (
                          <p className="text-xs md:text-sm text-gray-600">Package: {item.selectedVariation.name}</p>
                        )}
                        {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                          <p className="text-xs md:text-sm text-gray-600">
                            Add-ons: {item.selectedAddOns.map(addOn => 
                              addOn.quantity && addOn.quantity > 1 
                                ? `${addOn.name} x${addOn.quantity}`
                                : addOn.name
                            ).join(', ')}
                          </p>
                        )}
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5 md:mt-1">₱{item.totalPrice} × {item.quantity}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="text-sm md:text-base font-semibold text-gray-900">₱{item.totalPrice * item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-base md:text-xl font-semibold text-gray-900">
                    <span>Total:</span>
                    <span className="text-gray-900">₱{selectedOrder.total_price}</span>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-200">
                <h3 className="text-sm md:text-base font-medium text-gray-900 mb-3 md:mb-4">Customer Information</h3>
                {selectedOrder.customer_info['Multiple Accounts'] ? (
                  // Multiple accounts mode
                  <div className="space-y-4">
                    {(selectedOrder.customer_info['Multiple Accounts'] as Array<{
                      game: string;
                      package: string;
                      fields: Record<string, string>;
                    }>).map((account, accountIndex) => (
                      <div key={accountIndex} className="pb-4 border-b border-gray-200 last:border-b-0 last:pb-0">
                        <div className="mb-2">
                          <p className="text-xs md:text-sm font-semibold text-gray-900">{account.game}</p>
                          <p className="text-xs text-gray-600">Package: {account.package}</p>
                        </div>
                        <div className="space-y-1.5 md:space-y-2 mt-2">
                          {Object.entries(account.fields).map(([key, value]) => {
                            const fieldKey = `${accountIndex}_${key}`;
                            return (
                              <div key={fieldKey} className="flex items-center justify-between gap-2">
                                <p className="text-xs md:text-sm text-gray-600 flex-1 min-w-0">
                                  <span className="font-medium text-gray-700">{key}:</span> <span className="break-words">{String(value)}</span>
                                </p>
                                <button
                                  onClick={() => handleCopyField(fieldKey, String(value))}
                                  className="p-1 md:p-1.5 hover:bg-gray-200 rounded transition-colors duration-200 flex-shrink-0"
                                  title="Copy"
                                >
                                  {copiedField === fieldKey ? (
                                    <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4" style={{ color: '#4B1F42' }} />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5 md:h-4 md:w-4 text-gray-500" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Single account mode (default)
                  <div className="space-y-1.5 md:space-y-2">
                    {Object.entries(selectedOrder.customer_info)
                      .filter(([key]) => key !== 'Payment Method')
                      .map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between gap-2">
                          <p className="text-xs md:text-sm text-gray-600 flex-1 min-w-0">
                            <span className="font-medium text-gray-700">{key}:</span> <span className="break-words">{String(value)}</span>
                          </p>
                          <button
                            onClick={() => handleCopyField(key, String(value))}
                            className="p-1 md:p-1.5 hover:bg-gray-200 rounded transition-colors duration-200 flex-shrink-0"
                            title="Copy"
                          >
                            {copiedField === key ? (
                              <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 md:h-4 md:w-4 text-gray-500" />
                            )}
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Receipt */}
              <div className="bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-200">
                <h3 className="text-sm md:text-base font-medium text-gray-900 mb-3 md:mb-4">Payment Receipt</h3>
                <div className="flex flex-col items-center gap-3 md:gap-4">
                  <a
                    href={selectedOrder.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={selectedOrder.receipt_url}
                      alt="Receipt"
                      className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-lg border border-gray-300 shadow-sm hover:opacity-80 transition-opacity cursor-pointer"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/300x300?text=Receipt+Not+Found';
                      }}
                    />
                  </a>
                  <div className="flex flex-col gap-2 items-center w-full sm:w-auto">
                    <a
                      href={selectedOrder.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 md:px-4 md:py-2 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors duration-200 text-blue-700 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium"
                    >
                      <Eye className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      View Receipt
                    </a>
                    <a
                      href={selectedOrder.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="px-3 py-1.5 md:px-4 md:py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-gray-700 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium"
                    >
                      <Download className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      Download Receipt
                    </a>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 md:gap-3 pt-3 md:pt-4 border-t border-gray-200 flex-wrap">
                {selectedOrder.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(selectedOrder.id)}
                      className="px-3 py-1.5 md:px-4 md:py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors duration-200 text-green-700 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium"
                    >
                      <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectClick(selectedOrder.id)}
                      className="px-3 py-1.5 md:px-4 md:py-2 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors duration-200 text-red-700 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium"
                    >
                      <XCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      Reject
                    </button>
                  </>
                )}
                {selectedOrder.status === 'processing' && (
                  <>
                    <button
                      onClick={() => handleApprove(selectedOrder.id)}
                      className="px-3 py-1.5 md:px-4 md:py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors duration-200 text-green-700 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium"
                    >
                      <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectClick(selectedOrder.id)}
                      className="px-3 py-1.5 md:px-4 md:py-2 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors duration-200 text-red-700 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium"
                    >
                      <XCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      Reject
                    </button>
                  </>
                )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white rounded-lg shadow-xl p-4 md:p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                Reject Order
              </h2>
              <button
                onClick={handleRejectCancel}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Please select a reason for rejection or provide a custom message:
              </p>

              {/* Predefined rejection reasons */}
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedRejectionReason(selectedRejectionReason === 'Wrong ID or Password' ? '' : 'Wrong ID or Password')}
                  className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 text-left ${
                    selectedRejectionReason === 'Wrong ID or Password'
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <span className="font-medium">Wrong ID or Password</span>
                </button>

                <button
                  onClick={() => setSelectedRejectionReason(selectedRejectionReason === 'Invalid Inputs' ? '' : 'Invalid Inputs')}
                  className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 text-left ${
                    selectedRejectionReason === 'Invalid Inputs'
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <span className="font-medium">Invalid Inputs</span>
                </button>
              </div>

              {/* Custom text field */}
              <div>
                <label htmlFor="custom-rejection" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Details (Optional)
                </label>
                <textarea
                  id="custom-rejection"
                  value={customRejectionText}
                  onChange={(e) => setCustomRejectionText(e.target.value)}
                  placeholder="Provide more specific details about the rejection..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none text-sm"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleRejectCancel}
                  className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-gray-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectConfirm}
                  className="flex-1 px-4 py-2 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors duration-200 text-red-700 font-medium flex items-center justify-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManager;
