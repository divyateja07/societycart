DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['users','societies','society_memberships','categories','products','suppliers','supplier_products','buying_cycles','cycle_product_prices','orders','order_items','payments','refunds','supplier_orders','supplier_order_items','fulfillments','audit_logs'] LOOP
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()',t);
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()',t);
 END LOOP;
END $$;
CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now();RETURN NEW;END $$;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['users','societies','society_memberships','categories','products','suppliers','supplier_products','buying_cycles','cycle_product_prices','orders','order_items','payments','refunds','supplier_orders','supplier_order_items','fulfillments','audit_logs'] LOOP
  EXECUTE format('CREATE TRIGGER update_timestamp BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',t);
 END LOOP;
END $$;
CREATE INDEX memberships_society ON society_memberships(society_id,status);
CREATE INDEX products_category ON products(category_id);
CREATE INDEX order_items_product ON order_items(product_id);
CREATE INDEX audit_actor_created ON audit_logs(actor_id,created_at DESC);
