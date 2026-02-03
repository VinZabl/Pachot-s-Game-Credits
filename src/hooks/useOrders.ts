import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Order, CreateOrderData, OrderStatus } from '../types';
const ORDERS_PER_PAGE = 20; // Number of orders to fetch per page

export const useOrders = () => {
  const { pathname } = useLocation();
  const isAdminRoute = pathname.startsWith('/admin');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const fetchOrders = useCallback(async (page: number = 1, showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      const from = (page - 1) * ORDERS_PER_PAGE;
      const to = from + ORDERS_PER_PAGE - 1;

      // Fetch orders with pagination - exclude receipt_url for list view (heavy, only needed in detail)
      // Full order with receipt_url is fetched via fetchOrderById when viewing details
      const { data, error: fetchError, count } = await supabase
        .from('orders')
        .select('id, order_items, total_price, payment_method_id, status, created_at, updated_at, rejection_reason, customer_info, member_id', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;

      // Transform the data to match Order interface (receipt_url omitted for list, fetched on View)
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
        member_id: order.member_id || undefined,
      }));

      setOrders(transformedOrders);
      setTotalCount(count || 0);
      setCurrentPage(page);
      setError(null);
    } catch (err: unknown) {
      const msg = (err && typeof err === 'object' && 'message' in err)
        ? String((err as { message?: string }).message)
        : err instanceof Error ? err.message : 'Failed to fetch orders';
      // Supabase/PostgREST sometimes returns truncated JSON as message (e.g. '{"') - use fallback
      const displayMsg = (msg && msg.length > 3 && !msg.startsWith('{"')) ? msg : 'Failed to fetch orders. Check Supabase connection and RLS policies.';
      setError(displayMsg);
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch a single order by ID
  const fetchOrderById = async (orderId: string): Promise<Order | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

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
        member_id: data.member_id || undefined,
      };
    } catch (err) {
      console.error('Error fetching order:', err);
      return null;
    }
  };

  // Create a new order
  const createOrder = async (orderData: CreateOrderData): Promise<Order | null> => {
    try {
      const { data, error: createError } = await supabase
        .from('orders')
        .insert({
          order_items: orderData.order_items,
          customer_info: orderData.customer_info,
          payment_method_id: orderData.payment_method_id,
          receipt_url: orderData.receipt_url,
          total_price: orderData.total_price,
          member_id: orderData.member_id || null,
          order_option: orderData.order_option || 'place_order',
          invoice_number: orderData.invoice_number || null,
          status: 'pending',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Add new order to the list if we're in admin view
      if (orders.length > 0 && data) {
        setOrders(prev => {
          const updated = [data as Order, ...prev];
          // Keep only the most recent 100
          return updated.slice(0, 100);
        });
      } else if (orders.length === 0 && isAdminRoute) {
        // If no orders loaded (admin only), fetch initial set (page 1)
        // Skip for customer - they don't have permission to list all orders
        await fetchOrders(1);
      }

      // Refresh orders list only on admin (customer doesn't have access to orders list)
      if (isAdminRoute) await fetchOrders(currentPage, false);
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
        member_id: data.member_id || undefined,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
      console.error('Error creating order:', err);
      return null;
    }
  };

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

      // Refresh orders list (stay on current page)
      await fetchOrders(currentPage, false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
      console.error('Error updating order:', err);
      return false;
    }
  }, [fetchOrders, currentPage]);

  const fetchOrdersRef = useRef(fetchOrders);
  const lastFetchRef = useRef<number>(0);
  useEffect(() => {
    fetchOrdersRef.current = fetchOrders;
  }, [fetchOrders]);

  useEffect(() => {
    if (isAdminRoute) fetchOrders(1);
  }, [fetchOrders, isAdminRoute]);

  // Set up polling fallback - check every 30s (reduced from 5s for egress efficiency)
  // Real-time subscription is the primary update mechanism
  const POLL_INTERVAL_MS = 30000;
  const MIN_FETCH_INTERVAL_MS = 2000; // Skip poll if we just fetched (e.g. from real-time)

  useEffect(() => {
    if (!isAdminRoute) return;
    const pollInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastFetchRef.current < MIN_FETCH_INTERVAL_MS) return; // Avoid duplicate fetch after real-time
      lastFetchRef.current = now;
      fetchOrdersRef.current(currentPage, false);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollInterval);
  }, [currentPage, isAdminRoute]);

  // Set up real-time subscription only on admin route (customer side has no access to all orders)
  useEffect(() => {
    if (!isAdminRoute) return;

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
            lastFetchRef.current = Date.now(); // Mark fetch time to avoid immediate poll duplicate
            setTimeout(() => {
              fetchOrdersRef.current(currentPage, false);
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
  }, [currentPage, isAdminRoute]);

  return {
    orders,
    loading,
    error,
    totalCount,
    currentPage,
    ordersPerPage: ORDERS_PER_PAGE,
    fetchOrders,
    fetchOrderById,
    createOrder,
    updateOrderStatus,
  };
};
