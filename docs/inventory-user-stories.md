# Inventory Module — User Stories

> **63 user stories** covering the full scope of the Inventory module.
> Stories marked **NEW** (INV-32 – INV-63) are additions from the master backlog.
> Use this file as a reference when building or reviewing Inventory features.

---

## Table of Contents

1. [Item Master Management](#1-item-master-management)
2. [Warehouse & Sub-Location Setup](#2-warehouse--sub-location-setup)
3. [Goods Receiving (PO-linked)](#3-goods-receiving-po-linked)
4. [Stock Transfers Between Warehouses](#4-stock-transfers-between-warehouses)
5. [Stock Count & Adjustments](#5-stock-count--adjustments)
6. [Real-Time Stock Balance View](#6-real-time-stock-balance-view)
7. [Reorder Points & Auto Reorder Requests](#7-reorder-points--auto-reorder-requests)
8. [Returns Processing](#8-returns-processing)
9. [Stock Ledger & Audit Trail](#9-stock-ledger--audit-trail)
10. [Stock Valuation Report](#10-stock-valuation-report)
11. [Item Categories & Sub-Categories](#11-item-categories--sub-categories)
12. [Item Variants (Size, Color, Style)](#12-item-variants-size-color-style)
13. [Bundle / Kit Items](#13-bundle--kit-items)
14. [Batch / Lot Tracking](#14-batch--lot-tracking)
15. [Serial Number Tracking](#15-serial-number-tracking)
16. [Expiry Date Tracking (FEFO)](#16-expiry-date-tracking-fefo)
17. [Write-Offs](#17-write-offs)
18. [Inter-Branch Stock Requests](#18-inter-branch-stock-requests)
19. [Units of Measure & Conversion Rates](#19-units-of-measure--conversion-rates)
20. [Stock Costing Method Configuration](#20-stock-costing-method-configuration)
21. [Scheduled Cycle Counts](#21-scheduled-cycle-counts)
22. [Mobile Barcode Stock Count](#22-mobile-barcode-stock-count)
23. [Stock Turnover & Aging Reports](#23-stock-turnover--aging-reports)
24. [Quality Hold on Received Stock](#24-quality-hold-on-received-stock)
25. [Item Lifecycle Status (Active / Discontinued / Archived)](#25-item-lifecycle-status-active--discontinued--archived)
26. [Item Multiple Images](#26-item-multiple-images)
27. [Variant Images](#27-variant-images)
28. [Image Upload Policy](#28-image-upload-policy)
29. [Write-Off Photo Attachments](#29-write-off-photo-attachments)
30. [Category Cover Image](#30-category-cover-image)
31. [Bulk Image Upload by SKU](#31-bulk-image-upload-by-sku)
32. [Price Lists by Customer Segment](#32-price-lists-by-customer-segment) ⭐ NEW
33. [Min / Max Stock Level Boundaries](#33-min--max-stock-level-boundaries) ⭐ NEW
34. [Safety Stock Buffer](#34-safety-stock-buffer) ⭐ NEW
35. [Stock Reservations on Quotes & Orders](#35-stock-reservations-on-quotes--orders) ⭐ NEW
36. [Negative Stock Policy](#36-negative-stock-policy) ⭐ NEW
37. [Backorder Tracking](#37-backorder-tracking) ⭐ NEW
38. [Item Dimensions & Weight](#38-item-dimensions--weight) ⭐ NEW
39. [Barcode Auto-Generation & Label Printing](#39-barcode-auto-generation--label-printing) ⭐ NEW
40. [Landed Cost on Receipts](#40-landed-cost-on-receipts) ⭐ NEW
41. [In-Transit Stock Status](#41-in-transit-stock-status) ⭐ NEW
42. [Inventory Revaluation](#42-inventory-revaluation) ⭐ NEW
43. [Supplier Price History](#43-supplier-price-history) ⭐ NEW
44. [Custom Item Attributes](#44-custom-item-attributes) ⭐ NEW
45. [Warranty Period Tracking](#45-warranty-period-tracking) ⭐ NEW
46. [Substitute Items](#46-substitute-items) ⭐ NEW
47. [Bill of Materials & Assembly](#47-bill-of-materials--assembly) ⭐ NEW
48. [ABC Stock Classification](#48-abc-stock-classification) ⭐ NEW
49. [Warehouse Pick Lists](#49-warehouse-pick-lists) ⭐ NEW
50. [Forward Stock Projection](#50-forward-stock-projection) ⭐ NEW
51. [Bulk Label Printing](#51-bulk-label-printing) ⭐ NEW
52. [Consignment Stock](#52-consignment-stock) ⭐ NEW
53. [Full Physical Inventory Count](#53-full-physical-inventory-count) ⭐ NEW
54. [Item Tagging](#54-item-tagging) ⭐ NEW
55. [Cost Layer Transparency](#55-cost-layer-transparency) ⭐ NEW
56. [Item Master Change Log](#56-item-master-change-log) ⭐ NEW
57. [Pre-Order Selling](#57-pre-order-selling) ⭐ NEW
58. [Return Merchandise Authorization (RMA)](#58-return-merchandise-authorization-rma) ⭐ NEW
59. [Kit & Assembly Build](#59-kit--assembly-build) ⭐ NEW
60. [Barcode Label Templates](#60-barcode-label-templates) ⭐ NEW
61. [Scheduled Cycle Counts (Advanced)](#61-scheduled-cycle-counts-advanced) ⭐ NEW
62. [Batch / Serial Recall Traceability](#62-batch--serial-recall-traceability) ⭐ NEW
63. [Mobile Warehouse Operations](#63-mobile-warehouse-operations) ⭐ NEW

---

## 1. Item Master Management

| Field    | Value             |
| -------- | ----------------- |
| Priority | **High**          |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to create and manage item records in the Item Master, so that every product has a unique, trackable identity across the system.

**Acceptance Criteria**

- Items created with required fields: name, SKU, unit of measure, category, and cost price.
- Duplicate SKUs are rejected at save with a clear validation message.
- New items are immediately available in the POS item list and Sales & Orders catalog.

---

## 2. Warehouse & Sub-Location Setup

| Field    | Value             |
| -------- | ----------------- |
| Priority | **High**          |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to set up multiple warehouses and storage sub-locations, so that stock is tracked accurately by physical location.

**Acceptance Criteria**

- Multiple warehouses can be created with a name and address.
- Each warehouse supports sub-locations (shelf, bin, zone).
- Stock balances display per warehouse and per sub-location.

---

## 3. Goods Receiving (PO-linked)

| Field    | Value            |
| -------- | ---------------- |
| Priority | **High**         |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want to receive goods into inventory against a Procurement purchase order, so that stock levels update immediately upon delivery.

**Acceptance Criteria**

- Receiving links to a Procurement PO and validates quantities against it.
- Partial receipts are allowed; remaining outstanding quantity is tracked on the PO.
- Stock balance increments automatically when the receipt is confirmed.

---

## 4. Stock Transfers Between Warehouses

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to transfer stock between warehouses, so that I can rebalance supply across locations without losing traceability.

**Acceptance Criteria**

- Transfer deducts the source warehouse and adds to the destination on confirmation.
- Transfers can be saved as draft before dispatch.
- Both source and destination ledgers record the movement with timestamps.

---

## 5. Stock Count & Adjustments

| Field    | Value            |
| -------- | ---------------- |
| Priority | **High**         |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want to perform stock counts and submit adjustments, so that physical discrepancies are corrected and the ledger stays accurate.

**Acceptance Criteria**

- Stock count sheet shows expected vs. physically counted quantities per item.
- Adjustments require a reason code (damaged, miscounted, expired).
- Every adjustment posts to the stock ledger with the submitting user and timestamp.

---

## 6. Real-Time Stock Balance View

| Field    | Value         |
| -------- | ------------- |
| Priority | **High**      |
| Role     | Store Manager |

**User Story**
As a Store Manager, I want to view real-time stock balances per item and warehouse, so that I always know what is available before committing to sales or orders.

**Acceptance Criteria**

- Balance view shows on-hand, reserved, and available quantities per item.
- Results are filterable by warehouse, category, and item name.
- Items below the reorder threshold are visually flagged.

---

## 7. Reorder Points & Auto Reorder Requests

| Field    | Value            |
| -------- | ---------------- |
| Priority | **Medium**       |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want to define reorder points per item, so that the system automatically triggers a reorder request to Procurement when stock runs low.

**Acceptance Criteria**

- Each item has an optional reorder point and default reorder quantity in the Item Master.
- When on-hand stock falls below the reorder point, a request is auto-created in Procurement.
- The system prevents duplicate open reorder requests for the same item.

---

## 8. Returns Processing

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to process returned items back into inventory, so that restocked goods are accounted for accurately and the return is traceable.

**Acceptance Criteria**

- Returns can be linked to the original sale or issue record for traceability.
- Returned items are marked as sellable or damaged upon inspection.
- Stock balance updates immediately upon confirming the return.

---

## 9. Stock Ledger & Audit Trail

| Field    | Value        |
| -------- | ------------ |
| Priority | **High**     |
| Role     | System Admin |

**User Story**
As a System Admin, I want every inventory movement recorded in the stock ledger with a timestamp and user, so that a complete and immutable audit trail is maintained.

**Acceptance Criteria**

- Every receive, issue, transfer, adjustment, and return creates a ledger entry automatically.
- Ledger entries cannot be deleted — only reversed via a counter-entry.
- The ledger is filterable by date range, item, warehouse, and transaction type.

---

## 10. Stock Valuation Report

| Field    | Value         |
| -------- | ------------- |
| Priority | **Medium**    |
| Role     | Store Manager |

**User Story**
As a Store Manager, I want to generate a stock valuation report, so that I can see the total value of goods on hand at any point in time.

**Acceptance Criteria**

- Report shows quantity on hand and cost value per item.
- Valuation uses cost price from the Item Master or weighted average if configured.
- Report can be exported to CSV or PDF for finance review.

---

## 11. Item Categories & Sub-Categories

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to organize items into categories and sub-categories, so that the product catalog is easy to navigate and reports can be grouped meaningfully.

**Acceptance Criteria**

- Categories support nested hierarchy (e.g., Electronics → Audio → Headphones).
- Items can be re-categorized without losing transaction history.
- Stock reports and BI dashboards support category-based filtering and grouping.

---

## 12. Item Variants (Size, Color, Style)

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to create item variants with attributes like size, color, and style, so that I can manage similar products under one parent item without duplicating master data.

**Acceptance Criteria**

- Each variant has its own SKU, stock balance, and optional pricing override.
- Parent item shows aggregate stock across all variants; individual variants are also viewable.
- POS and Sales & Orders can filter to a specific variant when adding to cart.

---

## 13. Bundle / Kit Items

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to create bundle items that combine multiple SKUs into one sellable kit, so that promotions and pre-packaged sets can be sold and tracked as a single line item.

**Acceptance Criteria**

- Bundle definition includes component items and quantities (e.g., 1 keyboard + 1 mouse + 1 mat).
- Selling a bundle deducts stock from each component item proportionally.
- Bundle availability shows as the minimum of available component quantities.

---

## 14. Batch / Lot Tracking

| Field    | Value            |
| -------- | ---------------- |
| Priority | **High**         |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want to track stock by batch or lot number, so that I can trace specific batches in case of recalls, expiry, or quality issues.

**Acceptance Criteria**

- Items can be flagged as "batch-tracked" in the Item Master.
- Receiving requires a batch number per delivery; sales pick from available batches.
- Stock balance and ledger show batch-level breakdown for full traceability.

---

## 15. Serial Number Tracking

| Field    | Value            |
| -------- | ---------------- |
| Priority | **Medium**       |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want to track serial numbers for high-value items, so that each individual unit can be traced from receipt through sale and any subsequent return or warranty claim.

**Acceptance Criteria**

- Items can be flagged as "serial-tracked"; each unit captures a unique serial number.
- Receiving prompts for serial numbers for the received quantity.
- Serial number is recorded on POS receipts and Sales Orders for warranty and return matching.

---

## 16. Expiry Date Tracking (FEFO)

| Field    | Value            |
| -------- | ---------------- |
| Priority | **High**         |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want to track and manage expiry dates on perishable items, so that stock is sold in First-Expiry-First-Out order and expired stock is flagged automatically.

**Acceptance Criteria**

- Items can be flagged as "expiry-tracked"; expiry date is recorded at receiving per batch.
- Stock picking suggests the soonest-expiring batch first (FEFO order).
- Items within 30 days of expiry are flagged on the dashboard for action.

---

## 17. Write-Offs

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to write off damaged, expired, or wasted stock with a documented reason, so that physical losses are accounted for and the financial impact is recorded.

**Acceptance Criteria**

- Write-offs require: item, quantity, reason code, and supporting note or photo.
- Write-off automatically posts an expense entry to Accounting (Inventory Loss account).
- Write-off history is reportable for shrinkage analysis and feeds into BI.

---

## 18. Inter-Branch Stock Requests

| Field    | Value         |
| -------- | ------------- |
| Priority | **Medium**    |
| Role     | Store Manager |

**User Story**
As a Store Manager, I want to raise a stock request to another branch when I need items urgently, so that I can serve customers without waiting for a Procurement purchase order.

**Acceptance Criteria**

- Request specifies: source branch, items, quantities, and reason.
- Source branch manager can approve, partially approve, or reject the request.
- Approved requests auto-create a stock transfer between the two branches.

---

## 19. Units of Measure & Conversion Rates

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to define multiple units of measure for an item with conversion rates, so that I can purchase in one unit (case) and sell in another (each) without manual math.

**Acceptance Criteria**

- Items support a base unit and multiple alternate units with defined conversion factors.
- Receiving accepts purchase-unit input and converts to base-unit stock automatically.
- POS and Sales & Orders display the correct selling unit per item.

---

## 20. Stock Costing Method Configuration

| Field    | Value           |
| -------- | --------------- |
| Priority | **High**        |
| Role     | Finance Manager |

**User Story**
As a Finance Manager, I want to configure the stock costing method (FIFO, LIFO, or Weighted Average) per item or globally, so that COGS and stock valuation are calculated consistently and meet accounting standards.

**Acceptance Criteria**

- Default costing method is configurable at the business level; can be overridden per item.
- System uses the chosen method when calculating COGS for sales and stock valuation.
- Costing method cannot be changed mid-period without an explicit revaluation entry.

---

## 21. Scheduled Cycle Counts

| Field    | Value            |
| -------- | ---------------- |
| Priority | **Medium**       |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want to run scheduled cycle counts on a subset of items rather than a full physical inventory, so that stock accuracy is maintained without disrupting daily operations.

**Acceptance Criteria**

- Cycle count schedules can be set per item category, warehouse, or ABC classification.
- System assigns counters and tracks completion progress against the schedule.
- Variances trigger adjustment entries with the same audit trail as full counts (INV-05).

---

## 22. Mobile Barcode Stock Count

| Field    | Value            |
| -------- | ---------------- |
| Priority | **Medium**       |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want to perform stock counts on a mobile device with barcode scanning, so that physical counts are faster, more accurate, and do not require manual paperwork.

**Acceptance Criteria**

- Mobile app allows scanning item barcodes and entering counted quantities.
- Counts sync back to the system in real time, with offline queueing if no connection.
- Variances are highlighted on the device before submitting the final count.

---

## 23. Stock Turnover & Aging Reports

| Field    | Value         |
| -------- | ------------- |
| Priority | **Medium**    |
| Role     | Store Manager |

**User Story**
As a Store Manager, I want to view stock turnover and aging reports, so that I can identify slow-moving and dead stock that ties up capital and warehouse space.

**Acceptance Criteria**

- Turnover report shows sales velocity per item over a configurable period.
- Aging report shows on-hand stock grouped by days since last sale (0–30, 31–60, 61–90, 90+).
- Slow-moving and dead stock items can be flagged for clearance pricing or write-off.

---

## 24. Quality Hold on Received Stock

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to place received stock on quality hold pending inspection, so that defective deliveries are not sold or distributed before being checked.

**Acceptance Criteria**

- Receipts can be marked as "Quality Hold"; held stock is not available for sale or transfer.
- Inspector can release, partially release, or reject held stock with a documented reason.
- Rejected stock can be returned to supplier (RTV) with linkage to the original PO.

---

## 25. Item Lifecycle Status (Active / Discontinued / Archived)

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Low**           |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to mark items as Active, Discontinued, or Archived, so that obsolete items do not clutter the catalog but historical data remains accessible.

**Acceptance Criteria**

- Active items appear in all selection lists; Discontinued items are hidden from new orders but allow returns.
- Archived items are removed from all selectors but historical reports and ledger entries are preserved.
- Lifecycle status changes are logged with user, timestamp, and previous status.

---

## 26. Item Multiple Images

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to upload multiple images per item and choose one as the primary, so that product detail views, POS lookups, and customer-facing documents can show the item from more than one angle.

**Acceptance Criteria**

- Each item supports up to a configured maximum number of images (default 8 per item).
- Exactly one image is always marked primary — that is the image shown in lists, receipts, and POS tiles.
- Images can be reordered by drag-and-drop, and the primary designation can be reassigned at any time without losing the other images.

**Schema Notes**

- New table **item_images**: id (uuid PK), tenant_id (FK NN), item_id (FK items, NN), variant_id (FK item_variants, nullable — used by INV-27), storage_path (text NN), original_filename (varchar 255), mime_type (varchar 50), file_size_bytes (int), width_px (int), height_px (int), is_primary (boolean dv:false), display_order (smallint dv:0), alt_text (varchar 255 nullable), uploaded_by (FK users), uploaded_at (timestamp NN).
- Unique partial index on (item_id) where is_primary = true AND variant_id IS NULL — guarantees exactly one primary per item.
- Migration: copy existing items.image_url into item_images as the primary row, then keep items.image_url as a denormalized pointer to the primary storage_path (kept in sync by trigger) so list queries stay single-table fast.

---

## 27. Variant Images

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want each item variant to carry its own image, so that color, size, or style variants are visually distinct in POS, Sales & Orders, and any catalog view.

**Acceptance Criteria**

- Each variant can have its own primary image; when none is set, the parent item's primary image is shown as a fallback.
- POS variant pickers display the variant image alongside the attributes (e.g., "Red — Medium").
- Variant images follow the same upload rules, size limits, and resize behavior as item images.

**Schema Notes**

- Re-uses the **item_images** table from INV-26 via its variant_id column — no new table needed if INV-26 ships first.
- Unique partial index on (variant_id) where is_primary = true AND variant_id IS NOT NULL — guarantees one primary per variant.
- Fallback to parent item image is application-layer logic; no schema enforcement.

---

## 28. Image Upload Policy

| Field    | Value        |
| -------- | ------------ |
| Priority | **High**     |
| Role     | System Admin |

**User Story**
As a System Admin, I want consistent rules for image uploads across the inventory module, so that storage stays predictable, customer-facing views stay fast, and staff are not stuck handling oversized or malformed files.

**Acceptance Criteria**

- Accepted formats are JPG, PNG, and WEBP; uploads in other formats are rejected with a clear error message.
- Maximum file size is enforced server-side, defaulting to 5 MB per image and configurable per business.
- Uploaded images are automatically resized into list, detail, and POS-tile variants; the original is retained for re-processing if needed.
- Storage paths are scoped by tenant ID so multi-business isolation is preserved.

**Schema Notes**

- New table **tenant_upload_settings**: tenant_id (PK FK), max_file_size_bytes (int dv:5242880), allowed_mime_types (varchar[] dv:['image/jpeg','image/png','image/webp']), max_images_per_item (smallint dv:8), max_dimension_px (int dv:4000), updated_at (timestamp).
- One row per tenant; if no row exists, server uses the defaults above.
- Storage path convention: `tenants/{tenant_id}/inventory/items/{item_id}/{image_id}_{variant}.{ext}` where variant is one of: original, detail, list, tile.

---

## 29. Write-Off Photo Attachments

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to attach photos to a stock write-off, so that damage, expiry, or wastage has visual evidence for audit, supplier claims, and insurance purposes.

**Acceptance Criteria**

- Each write-off accepts one or more photo attachments alongside the existing reason code and note (closes the gap in INV-17).
- Photos are stored against the write-off record and remain visible in the audit trail.
- Photos are preserved even if the write-off is reversed via a counter-entry — original evidence is never deleted.

**Schema Notes**

- New table **stock_writeoff_attachments**: id (uuid PK), tenant_id (FK NN), writeoff_id (FK to the write-off record, NN), storage_path (text NN), original_filename, mime_type, file_size_bytes, uploaded_by (FK users), uploaded_at (timestamp NN).
- No delete cascade — attachments survive write-off reversal and stay linked for audit.
- Reversal counter-entries do not copy attachments; they inherit visibility through the original writeoff_id linkage.

---

## 30. Category Cover Image

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Low**           |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to assign a cover image to each item category, so that POS tile views and catalog browsing screens have a clean visual entry point per category, not just an icon and color.

**Acceptance Criteria**

- Each category supports an optional cover image in addition to its existing icon and color.
- POS catalog tile view shows the category image when set, falling back to icon + color when not.
- Image upload follows the same rules and size limits defined in INV-28.

**Schema Notes**

- Add to **item_categories**: cover_image_path (text nullable), cover_image_mime_type (varchar 50 nullable), cover_image_uploaded_at (timestamp nullable), cover_image_uploaded_by (FK users nullable).
- No separate table — one cover image per category is enough; if multiple are needed later, migrate to a category_images table mirroring item_images.

---

## 31. Bulk Image Upload by SKU

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Low**           |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager onboarding an existing catalog, I want to bulk-upload images and match them to items by SKU, so that I can populate a large catalog quickly without uploading images one at a time.

**Acceptance Criteria**

- Bulk upload accepts a ZIP of images named by SKU (e.g., SKU-00123.jpg) or a folder paired with a CSV that maps filename to SKU.
- Each match attaches the file as a new image on the matched item; the first match per item becomes primary unless one is already set.
- A summary report shows matched, unmatched, and rejected files with reasons (missing SKU, oversized, wrong format).

**Schema Notes**

- New table **image_import_jobs**: id (uuid PK), tenant_id (FK NN), uploaded_by (FK users NN), upload_method (enum: zip, csv_pair, NN), source_archive_path (text NN), status (enum: pending, processing, completed, failed, dv:pending), total_files (int dv:0), matched_count (int dv:0), unmatched_count (int dv:0), rejected_count (int dv:0), summary_report_path (text nullable), started_at (timestamp), completed_at (timestamp nullable).
- New table **image_import_job_files**: id (uuid PK), job_id (FK image_import_jobs NN), original_filename (varchar 255 NN), target_sku (varchar 100), matched_item_id (FK items nullable), matched_image_id (FK item_images nullable), result (enum: matched, unmatched, rejected, NN), reason (text).
- Long-running jobs run on a worker queue; status is polled from the UI.

---

## 32. Price Lists by Customer Segment

> ⭐ **NEW**

| Field    | Value         |
| -------- | ------------- |
| Priority | **High**      |
| Role     | Sales Manager |

**User Story**
As a Sales Manager, I want to maintain price lists for different customer segments (Wholesale, Retail, Member, Promotional) with effective dates, so that POS and Sales & Orders charge the right price for each customer without manual lookup.

**Acceptance Criteria**

- Multiple price lists per tenant; each with name, type, currency, effective_from, effective_to.
- Items can have per-list price overrides; missing items fall back to the Item Master price.
- Price lists assignable to customer segments and individual customers; highest-priority active list wins.
- POS and Sales & Orders automatically apply the correct price at checkout based on customer and date.

---

## 33. Min / Max Stock Level Boundaries

> ⭐ **NEW**

| Field    | Value             |
| -------- | ----------------- |
| Priority | **High**          |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to define minimum and maximum stock levels per item per warehouse, distinct from the reorder point, so that we have clear floor and ceiling boundaries for stock.

**Acceptance Criteria**

- Each item-warehouse pairing supports min_stock_level, reorder_point, and max_stock_level (all optional).
- Falling below min triggers a critical alert distinct from reorder warnings.
- Approaching max blocks further receipts unless explicitly overridden.
- Reports highlight items breaching either boundary for action.

---

## 34. Safety Stock Buffer

> ⭐ **NEW**

| Field    | Value            |
| -------- | ---------------- |
| Priority | **Medium**       |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want to set a safety stock buffer per item that absorbs demand variance during supplier lead times, so that the reorder formula accounts for unpredictable consumption.

**Acceptance Criteria**

- Each item has an optional safety_stock value.
- Reorder formula: reorder_quantity = (avg_daily_usage × lead_time_days) + safety_stock − current_on_hand.
- System suggests safety stock values from historical demand variability if enabled.
- Override per item allowed; system-suggested values are advisory only.

---

## 35. Stock Reservations on Quotes & Orders

> ⭐ **NEW**

| Field    | Value                |
| -------- | -------------------- |
| Priority | **High**             |
| Role     | Sales Representative |

**User Story**
As a Sales Representative, I want stock to be reserved when added to a quotation or pending sales order, so that two reps cannot oversell the same units while customers are deciding.

**Acceptance Criteria**

- Quotations and unconfirmed sales orders create soft reservations against the source document.
- Reservations have an expiration (default 7 days for quotations, 24 hours for unconfirmed orders) and auto-release on expiry.
- Available stock displayed system-wide excludes active reservations.
- Manual release possible by the document owner or a manager.

---

## 36. Negative Stock Policy

> ⭐ **NEW**

| Field    | Value        |
| -------- | ------------ |
| Priority | **High**     |
| Role     | System Admin |

**User Story**
As a System Admin, I want to configure how the system responds when a sale would push stock below zero, so that the business chooses between strict integrity and operational flexibility.

**Acceptance Criteria**

- Tenant-level setting: block (default), warn with manager override, or allow.
- Per-item override of the tenant setting for items with valid sell-then-receive patterns.
- Block prevents the transaction; warn requires manager PIN; allow logs the negative event for review.
- Reports list currently-negative items with the originating transactions.

---

## 37. Backorder Tracking

> ⭐ **NEW**

| Field    | Value                |
| -------- | -------------------- |
| Priority | **High**             |
| Role     | Sales Representative |

**User Story**
As a Sales Representative, I want to track sales-order lines that cannot be filled immediately as backorders, so that customers know when to expect their items and we can notify them when stock arrives.

**Acceptance Criteria**

- SO line marked backorder when ordered quantity exceeds available stock at confirmation.
- Expected fulfillment date estimated from open POs or supplier lead time.
- When stock arrives, backorders auto-flag for fulfillment in FIFO order by commitment date.
- Customer notifications sent on backorder creation, expected-date changes, and fulfillment.

---

## 38. Item Dimensions & Weight

> ⭐ **NEW**

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want each item to carry length, width, height, and weight, so that shipping cost calculation, box selection, and warehouse cube planning have accurate inputs.

**Acceptance Criteria**

- Item Master extended with length_cm, width_cm, height_cm, weight_grams (all optional).
- Dimensions used by Sales & Orders to estimate shipping cost when address is set.
- Warehouse capacity reports compute total weight and cube.
- Bundles inherit cumulative dimensions of components by default.

---

## 39. Barcode Auto-Generation & Label Printing

> ⭐ **NEW**

| Field    | Value             |
| -------- | ----------------- |
| Priority | **High**          |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to auto-generate barcodes for new items and print labels in batches, so that every received item is scannable and we can match items at POS reliably.

**Acceptance Criteria**

- Barcode auto-generated on item creation using a configured format (EAN-13, Code 128, internal); manual override allowed.
- Items support a primary barcode and a list of secondary barcodes for vendor-supplied codes.
- Label printing produces PDF or direct-to-printer output in standard label sizes.
- Bulk label print available from the goods-receipt flow.

---

## 40. Landed Cost on Receipts

> ⭐ **NEW**

| Field    | Value           |
| -------- | --------------- |
| Priority | **High**        |
| Role     | Finance Manager |

**User Story**
As a Finance Manager, I want freight, duty, insurance, and broker fees to be added to item cost on receipt, so that COGS reflects true landed cost and not just the supplier invoice price.

**Acceptance Criteria**

- Landed cost components recorded against a goods receipt: freight, duty, insurance, broker, other.
- Allocation methods: by quantity, by value, by weight (selectable per receipt).
- Allocated cost adjusts the receiving cost layer; FIFO and weighted average pick up the new figure automatically.
- Journal entry posts landed cost to inventory asset with offsetting payable or accrual.

---

## 41. In-Transit Stock Status

> ⭐ **NEW**

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want a dedicated "in transit" status for stock between dispatch and receipt, so that the inter-warehouse pipeline is visible across the network at all times.

**Acceptance Criteria**

- Transfer dispatch sets stock to in_transit; receipt sets on_hand at destination.
- In-transit stock shows as a separate column from on_hand and reserved in stock-balance views.
- Report lists all in-transit movements with source, destination, dispatch date, expected receipt, and aging.
- Stuck transfers (in-transit beyond expected receipt by N days) trigger an alert.

---

## 42. Inventory Revaluation

> ⭐ **NEW**

| Field    | Value           |
| -------- | --------------- |
| Priority | **High**        |
| Role     | Finance Manager |

**User Story**
As a Finance Manager, I want to manually revalue inventory items, so that year-end write-downs, market-price corrections, and historical-error fixes are recorded with a proper accounting trail.

**Acceptance Criteria**

- Revaluation entry captures: item, warehouse, old cost, new cost, reason code, supporting note.
- Posts a journal entry: inventory asset Dr/Cr, gain/loss on revaluation Cr/Dr.
- Affects valuation immediately; cost layers updated per costing method (FIFO, LIFO, weighted average).
- Bulk revaluation supported via CSV import with approval workflow.

---

## 43. Supplier Price History

> ⭐ **NEW**

| Field    | Value               |
| -------- | ------------------- |
| Priority | **Medium**          |
| Role     | Procurement Officer |

**User Story**
As a Procurement Officer, I want to track multiple supplier prices per item over time, so that I can compare suppliers, see trends, and select the best deal at any point.

**Acceptance Criteria**

- Each item-supplier pair carries a price history with effective_from and effective_to dates.
- Current best price highlighted on the item record.
- Price-change alerts when a supplier's quoted price exceeds a configurable variance from prior offers.
- Reports show price trend per supplier per item over selectable periods.

---

## 44. Custom Item Attributes

> ⭐ **NEW**

| Field    | Value             |
| -------- | ----------------- |
| Priority | **High**          |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to add custom attributes to items (material, voltage, model number, brand, fit) without a schema change, so that catalog data captures industry-specific properties.

**Acceptance Criteria**

- Custom attributes defined per category or globally with name, value type (text, number, date, list), required flag.
- Item edit shows applicable custom attributes alongside standard fields.
- Reports and search support filtering by custom attribute values.
- Bulk import accepts custom attributes via CSV mapping.

---

## 45. Warranty Period Tracking

> ⭐ **NEW**

| Field    | Value                |
| -------- | -------------------- |
| Priority | **Medium**           |
| Role     | Customer Service Rep |

**User Story**
As a Customer Service Rep, I want each item to carry a warranty period, so that POS receipts and customer service workflows show valid warranty status for any sale.

**Acceptance Criteria**

- Warranty period captured per item as months or days from sale date.
- POS receipt and digital receipt show warranty period and expiration date.
- Customer profile shows active warranties across all purchases with expiration dates.
- Warranty claim workflow links to the original sale and serial number for traceability.

---

## 46. Substitute Items

> ⭐ **NEW**

| Field    | Value                |
| -------- | -------------------- |
| Priority | **Medium**           |
| Role     | Sales Representative |

**User Story**
As a Sales Representative, I want to define substitute items per item, so that when something is out of stock the system offers approved alternatives without me looking them up manually.

**Acceptance Criteria**

- Each item has a list of substitute items with priority order and optional note.
- Out-of-stock POS lookup or SO entry shows substitutes with availability.
- Substitute relationships configurable as bidirectional or unidirectional.
- Reports show how often substitutes are offered and accepted.

---

## 47. Bill of Materials & Assembly

> ⭐ **NEW**

| Field    | Value              |
| -------- | ------------------ |
| Priority | **Medium**         |
| Role     | Production Manager |

**User Story**
As a Production Manager, I want to define a finished good made from component items via a Bill of Materials, so that we can assemble products in-house with accurate component consumption and finished-goods cost.

**Acceptance Criteria**

- BOM captures: finished item, version, component items with quantities and scrap percentage.
- Assembly transaction consumes components and produces finished goods; reverse for disassembly.
- Finished-good cost calculated from component costs plus optional labor and overhead.
- BOM versioning preserves historical builds for cost analysis.

---

## 48. ABC Stock Classification

> ⭐ **NEW**

| Field    | Value            |
| -------- | ---------------- |
| Priority | **Medium**       |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want items automatically classified A, B, or C based on value and movement, so that cycle counts and reorder reviews focus on what matters most.

**Acceptance Criteria**

- Classification computed nightly from rolling 90-day sales × cost: top 80% of value = A, next 15% = B, bottom 5% = C.
- Override per item if needed.
- Cycle count schedules (INV-21) can target specific classes.
- Reports show class distribution and items that recently shifted class.

---

## 49. Warehouse Pick Lists

> ⭐ **NEW**

| Field    | Value            |
| -------- | ---------------- |
| Priority | **Medium**       |
| Role     | Warehouse Picker |

**User Story**
As a Warehouse Picker, I want generated pick lists sorted by warehouse location, so that I can pick orders efficiently without backtracking through aisles.

**Acceptance Criteria**

- Pick list groups SO lines by warehouse and sorts by location code (zone-aisle-shelf-bin).
- Mobile pick view lets the picker scan each item-location and confirm quantity.
- Partial picks supported with reason codes (short-pick, damaged, location empty).
- Completed picks update SO line status and inventory consumption automatically.

---

## 50. Forward Stock Projection

> ⭐ **NEW**

| Field    | Value            |
| -------- | ---------------- |
| Priority | **High**         |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want a forward-looking view showing available stock over the next 30 days, so that I catch stockouts before they happen.

**Acceptance Criteria**

- Projection per item per warehouse: starting on_hand + incoming PO receipts − outgoing SO commitments − reservations, by date.
- Projected stock falling below zero at any future date triggers a warning.
- Filter by item, category, supplier, branch, or time horizon.
- Drill-down to the underlying POs and SOs driving the projection.

---

## 51. Bulk Label Printing

> ⭐ **NEW**

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Low**           |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to print labels and barcodes in batches from any item list or goods-receipt screen, so that new arrivals are labeled efficiently without one-by-one printing.

**Acceptance Criteria**

- Bulk selection from item list, category, or goods receipt.
- Label sizes selectable from a tenant catalog (e.g., 1×2 inch, 2×4 inch, shelf label, hang-tag).
- PDF output for standard printers; direct-print integration with supported thermal printers.
- Label content configurable: barcode, SKU, name, price, batch, expiry.

---

## 52. Consignment Stock

> ⭐ **NEW**

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to receive consignment stock owned by a supplier without creating an immediate payable, so that we only book payable when the item is consumed or sold.

**Acceptance Criteria**

- Consignment receipts marked separately; stock is held but flagged "Supplier owned."
- Sale or internal consumption of consignment stock triggers a payable creation at the agreed consignment cost.
- Consignment supplier statement reconciles consumed-vs-billed for each period.
- Unconsumed consignment stock returnable to supplier with RTV linkage.

---

## 53. Full Physical Inventory Count

> ⭐ **NEW**

| Field    | Value            |
| -------- | ---------------- |
| Priority | **Medium**       |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want to schedule a full physical inventory count event distinct from cycle counts, so that we can perform full-warehouse audits with proper freeze and variance approval.

**Acceptance Criteria**

- Count event captures: warehouse, start date, freeze window, counters assigned.
- During freeze, no movements allowed except sales (configurable); counts entered against item-location.
- Variances above threshold require approval before posting; full audit log retained.
- Post-count journal entry posts adjustments tagged with the count event ID.

---

## 54. Item Tagging

> ⭐ **NEW**

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Marketing Manager |

**User Story**
As a Marketing Manager, I want to tag items with flexible labels (Best Seller, Holiday, Clearance, New Arrival) independent of category, so that promotions, POS displays, and BI reports can target tag-based selections.

**Acceptance Criteria**

- Items can carry multiple tags; tags are tenant-scoped with name, color, description.
- Tag assignment is bulk-friendly (select multiple items, apply tag in one action).
- POS and online catalog can filter or feature items by tag.
- Reports support tag-based grouping and time-bounded tag history.

---

## 55. Cost Layer Transparency

> ⭐ **NEW**

| Field    | Value           |
| -------- | --------------- |
| Priority | **Medium**      |
| Role     | Finance Manager |

**User Story**
As a Finance Manager, I want to see the remaining cost layers per item, so that I can verify FIFO/LIFO COGS calculations and understand margin trajectory.

**Acceptance Criteria**

- Cost-layer view shows each remaining layer: quantity, cost, source (PO receipt, transfer-in, adjustment), and date.
- Issuing stock consumes the appropriate layer per costing method; the view updates live.
- Drill-down shows which sales or transfers consumed each layer.
- Filter by item, warehouse, and date range.

---

## 56. Item Master Change Log

> ⭐ **NEW**

| Field    | Value        |
| -------- | ------------ |
| Priority | **Medium**   |
| Role     | System Admin |

**User Story**
As a System Admin, I want a history of every change to item master data (price, category, supplier, status), so that we can investigate questions or anomalies that the stock ledger does not cover.

**Acceptance Criteria**

- Every change to items, item_variants, categories, or pricing fields creates a change-log entry.
- Log captures: field, old value, new value, changed-by, timestamp, reason note (optional).
- Filterable by item, field, user, and date.
- Exportable for compliance review.

---

## 57. Pre-Order Selling

> ⭐ **NEW**

| Field    | Value                |
| -------- | -------------------- |
| Priority | **Medium**           |
| Role     | Sales Representative |

**User Story**
As a Sales Representative, I want to sell items not yet in stock with an expected fulfillment date, so that we can capture demand for upcoming arrivals without lying about availability.

**Acceptance Criteria**

- Pre-order SO line accepted even when stock is zero, provided an open PO with expected receipt exists.
- Customer sees the expected ship date at checkout.
- Pre-order stock reserved against the inbound PO; fulfillment triggered automatically on receipt.
- Customer notifications on pre-order placement and stock arrival.

---

## 58. Return Merchandise Authorization (RMA)

> ⭐ **NEW**

| Field    | Value                |
| -------- | -------------------- |
| Priority | **Medium**           |
| Role     | Customer Service Rep |

**User Story**
As a Customer Service Rep, I want a structured Return Merchandise Authorization workflow (request → authorize → receive → inspect → restock or write-off), so that customer returns are tracked end-to-end instead of just appearing as restocked goods.

**Acceptance Criteria**

- RMA captures: original sale or invoice, items, reason, customer condition claim, photos.
- Approval workflow gates authorization; rejected RMAs notify the customer with a reason.
- Authorized RMA tracks shipping (if remote), receipt, and inspection outcome.
- Outcomes: restock, refurbish, write-off, return-to-vendor; each routes to the right downstream flow.

---

## 59. Kit & Assembly Build

> ⭐ **NEW**

| Field    | Value             |
| -------- | ----------------- |
| Priority | **Medium**        |
| Role     | Warehouse Manager |

**User Story**
As a Warehouse Manager, I want to define kits or assemblies — items that are composed of other items in a fixed recipe — so that we can sell assembled bundles or build to order without a full manufacturing module.

**Acceptance Criteria**

- Kit definitions list component items with quantity-per-kit and an optional labour or overhead cost line.
- Building a kit deducts component stock and increments kit stock in one transaction; the cost rolls up from components plus labour.
- Kits can be sold as a single line on POS or Sales orders; reports show kit-level and component-level movement.

---

## 60. Barcode Label Templates

> ⭐ **NEW**

| Field    | Value            |
| -------- | ---------------- |
| Priority | **Medium**       |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want to print barcode labels for items in configurable formats and sizes, so that any item can be scanned in POS, receiving, picking, and counting workflows.

**Acceptance Criteria**

- Label templates support common formats (40×20 mm, 50×30 mm, A4 sheets) and barcode symbologies (Code 128, EAN-13, QR).
- Print run selectable by item, by PO receipt, or by stock count; supports printing on label printers and to PDF.
- Each label includes barcode, item name, SKU, price (optional), and a configurable secondary line (size, colour, batch).

---

## 61. Scheduled Cycle Counts (Advanced)

> ⭐ **NEW**

| Field    | Value            |
| -------- | ---------------- |
| Priority | **Medium**       |
| Role     | Stock Controller |

**User Story**
As a Stock Controller, I want to schedule cycle counts so that high-value or fast-moving items are counted more often than annual, without the disruption of a full stocktake.

**Acceptance Criteria**

- Counts are scheduled by category, ABC class, value tier, or warehouse area with configurable frequency (weekly, monthly, quarterly).
- Scheduled counts auto-create count tasks at the right time and notify the assigned stock controller.
- Variances trigger adjustment workflows that require approval and reason codes per existing INV-05 rules.

---

## 62. Batch / Serial Recall Traceability

> ⭐ **NEW**

| Field    | Value           |
| -------- | --------------- |
| Priority | **Medium**      |
| Role     | Quality Manager |

**User Story**
As a Quality Manager, I want to trace every unit of a batch or serial-tracked item from supplier to customer in one report, so that recalls can be executed quickly and completely.

**Acceptance Criteria**

- Trace report inputs: batch number or serial number; returns full chain (PO, goods receipt, warehouse, transfers, sales, customer).
- Forward and backward tracing supported; affected customers can be listed for direct notification on recall.
- Recall workflow lets the manager freeze remaining stock of the batch, generate customer letters, and track returned units.

---

## 63. Mobile Warehouse Operations

> ⭐ **NEW**

| Field    | Value           |
| -------- | --------------- |
| Priority | **Medium**      |
| Role     | Warehouse Staff |

**User Story**
As a Warehouse Staff member, I want to perform stock checks, transfers, and receipts from a mobile device with barcode scanning, so that I'm not bouncing between the floor and a workstation.

**Acceptance Criteria**

- Mobile workflows: receive against PO, transfer between locations, pick against a sales order, perform a cycle count.
- Barcode scanning of items and locations using the device camera; entries posted to the same ledger as the desktop flows.
- Offline mode buffers operations on the device when network drops and syncs the moment connection returns.

---

## Summary Table

| #   | Title                                    | Priority | Role                 | New |
| --- | ---------------------------------------- | -------- | -------------------- | --- |
| 1   | Item Master Management                   | High     | Warehouse Manager    |     |
| 2   | Warehouse & Sub-Location Setup           | High     | Warehouse Manager    |     |
| 3   | Goods Receiving (PO-linked)              | High     | Stock Controller     |     |
| 4   | Stock Transfers Between Warehouses       | Medium   | Warehouse Manager    |     |
| 5   | Stock Count & Adjustments                | High     | Stock Controller     |     |
| 6   | Real-Time Stock Balance View             | High     | Store Manager        |     |
| 7   | Reorder Points & Auto Reorder Requests   | Medium   | Stock Controller     |     |
| 8   | Returns Processing                       | Medium   | Warehouse Manager    |     |
| 9   | Stock Ledger & Audit Trail               | High     | System Admin         |     |
| 10  | Stock Valuation Report                   | Medium   | Store Manager        |     |
| 11  | Item Categories & Sub-Categories         | Medium   | Warehouse Manager    |     |
| 12  | Item Variants (Size, Color, Style)       | Medium   | Warehouse Manager    |     |
| 13  | Bundle / Kit Items                       | Medium   | Warehouse Manager    |     |
| 14  | Batch / Lot Tracking                     | High     | Stock Controller     |     |
| 15  | Serial Number Tracking                   | Medium   | Stock Controller     |     |
| 16  | Expiry Date Tracking (FEFO)              | High     | Stock Controller     |     |
| 17  | Write-Offs                               | Medium   | Warehouse Manager    |     |
| 18  | Inter-Branch Stock Requests              | Medium   | Store Manager        |     |
| 19  | Units of Measure & Conversion Rates      | Medium   | Warehouse Manager    |     |
| 20  | Stock Costing Method Configuration       | High     | Finance Manager      |     |
| 21  | Scheduled Cycle Counts                   | Medium   | Stock Controller     |     |
| 22  | Mobile Barcode Stock Count               | Medium   | Stock Controller     |     |
| 23  | Stock Turnover & Aging Reports           | Medium   | Store Manager        |     |
| 24  | Quality Hold on Received Stock           | Medium   | Warehouse Manager    |     |
| 25  | Item Lifecycle Status                    | Low      | Warehouse Manager    |     |
| 26  | Item Multiple Images                     | Medium   | Warehouse Manager    |     |
| 27  | Variant Images                           | Medium   | Warehouse Manager    |     |
| 28  | Image Upload Policy                      | High     | System Admin         |     |
| 29  | Write-Off Photo Attachments              | Medium   | Warehouse Manager    |     |
| 30  | Category Cover Image                     | Low      | Warehouse Manager    |     |
| 31  | Bulk Image Upload by SKU                 | Low      | Warehouse Manager    |     |
| 32  | Price Lists by Customer Segment          | High     | Sales Manager        | ⭐  |
| 33  | Min / Max Stock Level Boundaries         | High     | Warehouse Manager    | ⭐  |
| 34  | Safety Stock Buffer                      | Medium   | Stock Controller     | ⭐  |
| 35  | Stock Reservations on Quotes & Orders    | High     | Sales Representative | ⭐  |
| 36  | Negative Stock Policy                    | High     | System Admin         | ⭐  |
| 37  | Backorder Tracking                       | High     | Sales Representative | ⭐  |
| 38  | Item Dimensions & Weight                 | Medium   | Warehouse Manager    | ⭐  |
| 39  | Barcode Auto-Generation & Label Printing | High     | Warehouse Manager    | ⭐  |
| 40  | Landed Cost on Receipts                  | High     | Finance Manager      | ⭐  |
| 41  | In-Transit Stock Status                  | Medium   | Warehouse Manager    | ⭐  |
| 42  | Inventory Revaluation                    | High     | Finance Manager      | ⭐  |
| 43  | Supplier Price History                   | Medium   | Procurement Officer  | ⭐  |
| 44  | Custom Item Attributes                   | High     | Warehouse Manager    | ⭐  |
| 45  | Warranty Period Tracking                 | Medium   | Customer Service Rep | ⭐  |
| 46  | Substitute Items                         | Medium   | Sales Representative | ⭐  |
| 47  | Bill of Materials & Assembly             | Medium   | Production Manager   | ⭐  |
| 48  | ABC Stock Classification                 | Medium   | Stock Controller     | ⭐  |
| 49  | Warehouse Pick Lists                     | Medium   | Warehouse Picker     | ⭐  |
| 50  | Forward Stock Projection                 | High     | Stock Controller     | ⭐  |
| 51  | Bulk Label Printing                      | Low      | Warehouse Manager    | ⭐  |
| 52  | Consignment Stock                        | Medium   | Warehouse Manager    | ⭐  |
| 53  | Full Physical Inventory Count            | Medium   | Stock Controller     | ⭐  |
| 54  | Item Tagging                             | Medium   | Marketing Manager    | ⭐  |
| 55  | Cost Layer Transparency                  | Medium   | Finance Manager      | ⭐  |
| 56  | Item Master Change Log                   | Medium   | System Admin         | ⭐  |
| 57  | Pre-Order Selling                        | Medium   | Sales Representative | ⭐  |
| 58  | Return Merchandise Authorization (RMA)   | Medium   | Customer Service Rep | ⭐  |
| 59  | Kit & Assembly Build                     | Medium   | Warehouse Manager    | ⭐  |
| 60  | Barcode Label Templates                  | Medium   | Stock Controller     | ⭐  |
| 61  | Scheduled Cycle Counts (Advanced)        | Medium   | Stock Controller     | ⭐  |
| 62  | Batch / Serial Recall Traceability       | Medium   | Quality Manager      | ⭐  |
| 63  | Mobile Warehouse Operations              | Medium   | Warehouse Staff      | ⭐  |
