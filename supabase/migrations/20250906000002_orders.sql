-- Orders for catalog (M3)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_phone TEXT,
  customer_name TEXT,
  catalog_item_id UUID REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  option_label TEXT NOT NULL,
  price_cents INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','canceled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orders_instance ON public.orders(instance_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders(instance_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders access" ON public.orders;
CREATE POLICY "orders access" ON public.orders FOR ALL USING (
  EXISTS (SELECT 1 FROM public.instances WHERE id = orders.instance_id AND admin_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_instances WHERE instance_id = orders.instance_id AND user_id = auth.uid())
);
GRANT ALL ON public.orders TO service_role;
