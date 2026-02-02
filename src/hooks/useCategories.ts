import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async (retries = 3) => {
    try {
      setLoading(true);
      
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (fetchError) {
        // If it's a network/CORS error and we have retries left, try again
        if (retries > 0 && (fetchError.message.includes('NetworkError') || fetchError.message.includes('CORS') || fetchError.code === 'PGRST116')) {
          console.warn(`Retrying categories fetch... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries))); // Exponential backoff
          return fetchCategories(retries - 1);
        }
        throw fetchError;
      }

      setCategories(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching categories:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch categories';
      
      // Provide more helpful error message for CORS issues
      if (errorMessage.includes('CORS') || errorMessage.includes('NetworkError')) {
        setError('Network error: Please check your Supabase CORS settings and internet connection.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async (category: Partial<Omit<Category, 'created_at' | 'updated_at'>>) => {
    try {
      const insertPayload: any = {
        id: category.id,
        name: category.name,
        sort_order: category.sort_order,
        active: category.active
      };
      // Only include icon if provided; otherwise let DB default apply
      if (category.icon) insertPayload.icon = category.icon;

      const { data, error: insertError } = await supabase
        .from('categories')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) throw insertError;

      await fetchCategories();
      return data;
    } catch (err) {
      console.error('Error adding category:', err);
      throw err;
    }
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    try {
      const updatePayload: any = {
        name: updates.name,
        sort_order: updates.sort_order,
        active: updates.active
      };
      // Allow icon update only if explicitly provided
      if (typeof updates.icon === 'string') updatePayload.icon = updates.icon;

      const { error: updateError } = await supabase
        .from('categories')
        .update(updatePayload)
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchCategories();
    } catch (err) {
      console.error('Error updating category:', err);
      throw err;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      // Check if category has menu items
      const { data: menuItems, error: checkError } = await supabase
        .from('menu_items')
        .select('id')
        .eq('category', id)
        .limit(1);

      if (checkError) throw checkError;

      if (menuItems && menuItems.length > 0) {
        throw new Error('Cannot delete category that contains menu items. Please move or delete the items first.');
      }

      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
      throw err;
    }
  };

  const reorderCategories = async (reorderedCategories: Category[]) => {
    try {
      const updates = reorderedCategories.map((cat, index) => ({
        id: cat.id,
        sort_order: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('categories')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      await fetchCategories();
    } catch (err) {
      console.error('Error reordering categories:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    error,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    refetch: fetchCategories
  };
};