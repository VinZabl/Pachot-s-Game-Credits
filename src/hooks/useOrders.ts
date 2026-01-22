import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Order, CreateOrderData, OrderStatus } from '../types';

export const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform the data to match Order interface
      const transformedOrders: Order[] = (data || []).map((order: any) => ({
        id: order.id,
        order_items: order.order_items || [],
        customer_info: order.customer_info || {},
        payment_method_id: order.payment_method_id || '',
        receipt_url: order.receipt_url || '',
        total_price: order.total_price || 0,
        status: order.status as OrderStatus,
        rejection_reason: order.rejection_reason || undefined,
        created_at: order.created_at,
        updated_at: order.updated_at || order.created_at,
      }));

      setOrders(transformedOrders);
      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  const fetchOrderById = useCallback(async (orderId: string): Promise<Order | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) return null;

      return {
        id: data.id,
        order_items: data.order_items || [],
        customer_info: data.customer_info || {},
        payment_method_id: data.payment_method_id || '',
        receipt_url: data.receipt_url || '',
        total_price: data.total_price || 0,
        status: data.status as OrderStatus,
        rejection_reason: data.rejection_reason || undefined,
        created_at: data.created_at,
        updated_at: data.updated_at || data.created_at,
      };
    } catch (err) {
      console.error('Error fetching order:', err);
      return null;
    }
  }, []);

  const createOrder = useCallback(async (orderData: CreateOrderData): Promise<Order | null> => {
    try {
      const { data, error: insertError } = await supabase
        .from('orders')
        .insert({
          order_items: orderData.order_items,
          customer_info: orderData.customer_info,
          payment_method_id: orderData.payment_method_id,
          receipt_url: orderData.receipt_url,
          total_price: orderData.total_price,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newOrder: Order = {
        id: data.id,
        order_items: data.order_items || [],
        customer_info: data.customer_info || {},
        payment_method_id: data.payment_method_id || '',
        receipt_url: data.receipt_url || '',
        total_price: data.total_price || 0,
        status: data.status as OrderStatus,
        created_at: data.created_at,
        updated_at: data.updated_at || data.created_at,
      };

      // Refresh orders list
      await fetchOrders(false);
      return newOrder;
    } catch (err) {
      console.error('Error creating order:', err);
      throw err;
    }
  }, [fetchOrders]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus, rejectionReason?: string): Promise<boolean> => {
    try {
      const updateData: { status: OrderStatus; rejection_reason?: string } = { status };
      
      // Only include rejection_reason if status is rejected
      if (status === 'rejected' && rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      } else if (status !== 'rejected') {
        // Clear rejection reason if status is not rejected
        updateData.rejection_reason = null;
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Refresh orders list
      await fetchOrders(false);
      return true;
    } catch (err) {
      console.error('Error updating order status:', err);
      return false;
    }
  }, [fetchOrders]);

  // Use ref to store the latest fetchOrders function
  const fetchOrdersRef = useRef(fetchOrders);
  useEffect(() => {
    fetchOrdersRef.current = fetchOrders;
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Set up polling fallback - check for new orders every 5 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      console.log('🔄 Polling for new orders...');
      fetchOrdersRef.current(false);
    }, 5000); // Check every 5 seconds

    return () => {
      clearInterval(pollInterval);
    };
  }, []); // Empty dependency array - polling stays active

  // Set up real-time subscription (active regardless of current view)
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel>;
    let reconnectTimeout: NodeJS.Timeout;

    const setupSubscription = () => {
      const channelName = `orders_changes_${Date.now()}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
          },
          (payload) => {
            console.log('✅ Real-time order change detected:', payload.eventType, payload.new?.id);
            // Use ref to call latest fetchOrders function
            // Reduced delay for faster updates
            setTimeout(() => {
              fetchOrdersRef.current(false);
            }, 100);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to orders changes (real-time active)');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Error subscribing to orders changes (polling will continue every 5s)');
            // Retry after 5 seconds
            reconnectTimeout = setTimeout(setupSubscription, 5000);
          } else if (status === 'TIMED_OUT') {
            console.warn('⚠️ Subscription timed out, retrying... (polling will continue every 5s)');
            reconnectTimeout = setTimeout(setupSubscription, 5000);
          } else if (status === 'CLOSED') {
            console.warn('⚠️ Subscription closed, reconnecting... (polling will continue every 5s)');
            reconnectTimeout = setTimeout(setupSubscription, 5000);
          }
        });
    };

    setupSubscription();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (channel) {
        console.log('Unsubscribing from orders changes');
        supabase.removeChannel(channel);
      }
    };
  }, []); // Empty dependency array - subscription stays active on all admin views

  return {
    orders,
    loading,
    error,
    fetchOrders,
    fetchOrderById,
    createOrder,
    updateOrderStatus,
  };
};
