import React, { createContext, useContext, useState, useCallback } from 'react';

interface OrderStatusContextType {
  orderId: string | null;
  showOrderStatusModal: boolean;
  setOrderPlaced: (orderId: string) => void;
  clearOrderStatus: () => void;
  closeOrderStatusModal: () => void;
  openOrderStatusModal: (orderId: string, autoShow?: boolean) => void;
}

const OrderStatusContext = createContext<OrderStatusContextType | null>(null);

export const OrderStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [showOrderStatusModal, setShowOrderStatusModal] = useState(false);

  const setOrderPlaced = useCallback((id: string) => {
    setOrderId(id);
    setShowOrderStatusModal(true);
    localStorage.setItem('current_order_id', id);
  }, []);

  const clearOrderStatus = useCallback(() => {
    setShowOrderStatusModal(false);
    setOrderId(null);
    localStorage.removeItem('current_order_id');
  }, []);

  const closeOrderStatusModal = useCallback(() => {
    setShowOrderStatusModal(false);
  }, []);

  const openOrderStatusModal = useCallback((id: string, autoShow = true) => {
    setOrderId(id);
    if (autoShow) setShowOrderStatusModal(true);
  }, []);

  return (
    <OrderStatusContext.Provider
      value={{
        orderId,
        showOrderStatusModal,
        setOrderPlaced,
        clearOrderStatus,
        closeOrderStatusModal,
        openOrderStatusModal,
      }}
    >
      {children}
    </OrderStatusContext.Provider>
  );
};

export const useOrderStatus = () => {
  const ctx = useContext(OrderStatusContext);
  if (!ctx) throw new Error('useOrderStatus must be used within OrderStatusProvider');
  return ctx;
};
