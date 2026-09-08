-- Catalog items for generic orders (M1)
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  price_cents INT NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_items_instance ON public.catalog_items(instance_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_active ON public.catalog_items(instance_id, active, sort_order);

-- updated_at trigger
DROP TRIGGER IF EXISTS catalog_items_updated_at ON public.catalog_items;
CREATE TRIGGER catalog_items_updated_at BEFORE UPDATE ON public.catalog_items FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalog_items access" ON public.catalog_items;
CREATE POLICY "catalog_items access" ON public.catalog_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.instances WHERE id = catalog_items.instance_id AND admin_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_instances WHERE instance_id = catalog_items.instance_id AND user_id = auth.uid())
);
GRANT ALL ON public.catalog_items TO service_role;
