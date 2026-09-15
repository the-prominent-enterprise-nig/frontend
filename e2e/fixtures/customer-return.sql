-- Fixture for e2e/inventory-customer-returns.spec.ts's end-to-end posting test.
--
-- The seed creates no customer with a completed sale, and the return screen is
-- built around picking from the customer's own purchase history — so without
-- one there is nothing to tick and the happy path cannot be exercised at all.
--
-- Idempotent: re-running replaces the fixture rather than stacking duplicates.
--
-- Re-run it whenever the posting test starts failing with "only 0 of N left to
-- return" — that is the server's quantity cap doing its job, not a bug: each
-- run of the spec returns units off this sale and they do not come back.
-- Run against the TEST database only:
--   psql "$TEST_DATABASE_URL" -f e2e/fixtures/customer-return.sql

DO $$
DECLARE
  v_tenant text;
  v_wh     text;
  v_uom    text;
  v_session text;
  v_cust   text := gen_random_uuid()::text;
  v_item   text := gen_random_uuid()::text;
  v_txn    text := gen_random_uuid()::text;
  v_sitem  text := gen_random_uuid()::text;
  v_receipt text := gen_random_uuid()::text;
  v_sold_sn text;
BEGIN
  SELECT "enterpriseOwnerId" INTO v_tenant
    FROM users WHERE email = 'technova.owner@test.com';
  SELECT id INTO v_wh
    FROM warehouses
   WHERE "tenantId" = v_tenant AND status = 'active' AND "branchId" IS NOT NULL
   LIMIT 1;
  SELECT id INTO v_uom FROM units_of_measure WHERE "tenantId" = v_tenant LIMIT 1;
  SELECT id INTO v_session FROM pos_sessions ORDER BY "openedAt" DESC LIMIT 1;

  -- Clear any previous run, innermost references first. The returns posted
  -- by earlier runs of the spec hang off this item and this customer, so they
  -- have to go before either can be deleted — which is exactly what the
  -- foreign keys are there to insist on.
  DELETE FROM customer_return_lines
   WHERE "itemId" IN (
     SELECT id FROM items WHERE sku IN ('E2E-RETUI-ITEM', 'E2E-RETUI-SER')
   );
  DELETE FROM customer_returns
   WHERE "customerId" IN (
     SELECT id FROM customers WHERE "customerCode" = 'E2E-RETUI-01'
   );
  DELETE FROM stock_cost_layers
   WHERE "itemId" IN (
     SELECT id FROM items WHERE sku IN ('E2E-RETUI-ITEM', 'E2E-RETUI-SER')
   );
  DELETE FROM stock_ledger
   WHERE "itemId" IN (
     SELECT id FROM items WHERE sku IN ('E2E-RETUI-ITEM', 'E2E-RETUI-SER')
   );
  DELETE FROM serial_numbers
   WHERE "serialNumber" LIKE 'E2E-RETUI-SN-%';
  DELETE FROM pos_transaction_lines
   WHERE "transactionId" IN (
     SELECT id FROM pos_transactions WHERE "transactionNumber" = 'E2E-RETUI-TXN-01'
   );
  DELETE FROM pos_transactions WHERE "transactionNumber" = 'E2E-RETUI-TXN-01';
  DELETE FROM stock_balances
   WHERE "itemId" IN (
     SELECT id FROM items WHERE sku IN ('E2E-RETUI-ITEM', 'E2E-RETUI-SER')
   );
  DELETE FROM items WHERE sku IN ('E2E-RETUI-ITEM', 'E2E-RETUI-SER');
  DELETE FROM customers WHERE "customerCode" = 'E2E-RETUI-01';

  INSERT INTO customers (id,"tenantId","customerCode",name,"customerType","paymentTerms","createdAt","updatedAt")
  VALUES (v_cust, v_tenant, 'E2E-RETUI-01', 'E2E Returns UI Customer', 'individual', 'Net 30', now(), now());

  INSERT INTO items (id,"tenantId",sku,name,"baseUnitId","sellingPrice","createdAt","updatedAt")
  VALUES (v_item, v_tenant, 'E2E-RETUI-ITEM', 'E2E Returns UI Widget', v_uom, 1200, now(), now());

  INSERT INTO stock_balances (id,"tenantId","itemId","warehouseId","onHandQty","availableQty","reservedQty")
  VALUES (gen_random_uuid()::text, v_tenant, v_item, v_wh, 50, 50, 0);

  INSERT INTO pos_transactions (id,"tenantId","sessionId","transactionNumber","transactionType","customerId",subtotal,"totalAmount","occurredAt",status,"salesInvoiceNumber","createdAt","updatedAt")
  VALUES (v_txn, v_tenant, v_session, 'E2E-RETUI-TXN-01', 'sale', v_cust, 240000, 240000, now(), 'completed', 'SI-E2E-RETUI-01', now(), now());

  INSERT INTO pos_transaction_lines (id,"tenantId","transactionId","itemId",quantity,"unitPrice","lineTotal","unitCost","createdAt")
  VALUES (gen_random_uuid()::text, v_tenant, v_txn, v_item, 200, 1200, 240000, 700, now());

  -- ── A serial-tracked line, so the exchange path has something to work on.
  -- An exchange needs two units: the one coming back (sold, on the sale) and
  -- one on the shelf to hand over in its place. Without both, selecting
  -- Exchange in the UI is a dead end.
  INSERT INTO items (id,"tenantId",sku,name,"baseUnitId","sellingPrice","isSerialTracked","createdAt","updatedAt")
  VALUES (v_sitem, v_tenant, 'E2E-RETUI-SER', 'E2E Returns UI Tracked Unit', v_uom, 2500, true, now(), now());

  INSERT INTO stock_balances (id,"tenantId","itemId","warehouseId","onHandQty","availableQty","reservedQty")
  VALUES (gen_random_uuid()::text, v_tenant, v_sitem, v_wh, 4, 4, 0);

  INSERT INTO stock_ledger (id,"tenantId","itemId","warehouseId","transactionType","quantityChange","unitCost","occurredAt")
  VALUES (v_receipt, v_tenant, v_sitem, v_wh, 'receipt', 4, 1500, now());

  INSERT INTO stock_cost_layers (id,"tenantId","itemId","warehouseId","receiptLedgerId","unitCost","originalQty","remainingQty","receivedAt")
  VALUES (gen_random_uuid()::text, v_tenant, v_sitem, v_wh, v_receipt, 1500, 4, 4, now());

  -- The unit the customer is bringing back.
  INSERT INTO serial_numbers (id,"tenantId","itemId","serialNumber",status,"soldToCustomerId","saleDate","createdAt","updatedAt")
  VALUES (gen_random_uuid()::text, v_tenant, v_sitem, 'E2E-RETUI-SN-SOLD', 'sold', v_cust, now(), now(), now())
  RETURNING id INTO v_sold_sn;

  -- The unit on the shelf it can be swapped for.
  INSERT INTO serial_numbers (id,"tenantId","itemId","serialNumber",status,"currentWarehouseId","createdAt","updatedAt")
  VALUES (gen_random_uuid()::text, v_tenant, v_sitem, 'E2E-RETUI-SN-SHELF', 'in_stock', v_wh, now(), now());

  INSERT INTO pos_transaction_lines (id,"tenantId","transactionId","itemId",quantity,"unitPrice","lineTotal","unitCost","serialNumberId","createdAt")
  VALUES (gen_random_uuid()::text, v_tenant, v_txn, v_sitem, 1, 2500, 2500, 1500, v_sold_sn, now());
END $$;
