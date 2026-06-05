'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ShoppingBag, Check } from 'lucide-react';
import { toast } from 'sonner';
import { CatalogProduct } from '../settings/catalog-manager';
import { cn } from '@/lib/utils';

interface ProductPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onSent: () => void;
}

export function ProductPickerModal({
  open,
  onOpenChange,
  conversationId,
  onSent,
}: ProductPickerModalProps) {
  const [activeTab, setActiveTab] = useState<'single' | 'list'>('single');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form state
  const [bodyText, setBodyText] = useState('');
  const [sectionTitle, setSectionTitle] = useState('Our Products');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    async function loadProducts() {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('catalog_products')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        toast.error('Failed to load catalog products');
      } else {
        setProducts(data ?? []);
      }
      setLoading(false);
    }
    loadProducts();
  }, [open]);

  const toggleProduct = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (activeTab === 'single') {
        next.clear();
        next.add(id);
      } else {
        if (next.size >= 30) {
          toast.error('Maximum 30 products allowed in a list message');
          return;
        }
        next.add(id);
      }
    }
    setSelectedIds(next);
  };

  // Reset selection when switching tabs
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  const handleSend = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one product');
      return;
    }
    if (activeTab === 'list' && !sectionTitle.trim()) {
      toast.error('Section title is required for a product list');
      return;
    }

    setSending(true);
    try {
      const selectedProducts = products.filter(p => selectedIds.has(p.id));
      
      const payload = {
        conversationId,
        type: activeTab === 'single' ? 'single_product' : 'product_list',
        bodyText: bodyText.trim(),
        sectionTitle: sectionTitle.trim(),
        products: selectedProducts.map(p => ({ retailer_id: p.retailer_id }))
      };

      const res = await fetch('/api/whatsapp/catalog-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send catalog message');
      }

      toast.success('Catalog message sent');
      onOpenChange(false);
      onSent();
      
      // Reset form
      setBodyText('');
      setSectionTitle('Our Products');
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-800 bg-slate-950 text-white sm:max-w-2xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Send Product Message</DialogTitle>
        </DialogHeader>

        <Tabs 
          value={activeTab} 
          onValueChange={(v) => setActiveTab(v as 'single' | 'list')}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="bg-slate-900 border border-slate-800 w-full justify-start rounded-none border-x-0 border-t-0 p-0 h-auto">
            <TabsTrigger 
              value="single"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-2"
            >
              Single Product
            </TabsTrigger>
            <TabsTrigger 
              value="list"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-4 py-2"
            >
              Product List
            </TabsTrigger>
          </TabsList>

          <div className="p-4 space-y-4 shrink-0 border-b border-slate-800 bg-slate-900">
            <div className="space-y-2">
              <Label>Message Text (optional)</Label>
              <Textarea
                value={bodyText}
                onChange={e => setBodyText(e.target.value)}
                placeholder="Check out this product..."
                className="h-16 resize-none bg-slate-950 border-slate-700 text-sm"
              />
            </div>
            
            {activeTab === 'list' && (
              <div className="space-y-2">
                <Label>Section Title *</Label>
                <Input
                  value={sectionTitle}
                  onChange={e => setSectionTitle(e.target.value)}
                  placeholder="e.g. Featured Products"
                  className="bg-slate-950 border-slate-700 h-9"
                  maxLength={24}
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingBag className="h-12 w-12 text-slate-700 mb-4" />
                <h3 className="text-lg font-medium text-slate-300">No products found</h3>
                <p className="text-sm text-slate-500 max-w-sm mt-1">
                  Add products in the Catalog settings to send them to customers.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {products.map(product => {
                  const isSelected = selectedIds.has(product.id);
                  return (
                    <button
                      key={product.id}
                      onClick={() => toggleProduct(product.id)}
                      className={cn(
                        "flex items-start gap-3 p-3 text-left border rounded-xl transition-all",
                        isSelected 
                          ? "bg-primary/10 border-primary ring-1 ring-primary/30" 
                          : "bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800"
                      )}
                    >
                      <div className="relative h-12 w-12 shrink-0 bg-slate-800 rounded-md overflow-hidden border border-slate-700">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-600">
                            <ShoppingBag className="h-5 w-5" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="bg-primary text-white rounded-full p-0.5">
                              <Check className="h-3 w-3" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate pr-2">{product.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: product.currency }).format(product.price)}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">ID: {product.retailer_id}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Tabs>

        <DialogFooter className="p-4 border-t border-slate-800 shrink-0">
          <div className="flex w-full items-center justify-between">
            <span className="text-sm text-slate-400">
              {selectedIds.size} product{selectedIds.size !== 1 && 's'} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleSend} 
                disabled={sending || selectedIds.size === 0}
                className="bg-primary text-primary-foreground"
              >
                {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send {activeTab === 'list' ? 'List' : 'Product'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
