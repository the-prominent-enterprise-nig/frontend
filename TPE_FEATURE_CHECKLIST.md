# The Prominent Enterprise — Feature Test Checklist

Manual QA checklist. Tick off each feature after it has been tested and confirmed working.

---

## PLATFORM CAPABILITIES

### Enterprise Activation and Onboarding

- [ ] Invite link is issued and received correctly
- [ ] Business owner can claim the invite link
- [ ] Account setup (name + password creation) completes successfully
- [ ] Workspace is immediately accessible after activation
- [ ] All subscribed modules are visible upon first login
- [ ] Expired invite link is rejected with a clear message

### Role-Based Access Control

- [ ] Role can be created with a name and hierarchy level
- [ ] Full permission catalog is browsable by module, feature, and action
- [ ] Role can be assigned to a user with business-wide scope
- [ ] Role can be assigned to a user with branch-specific scope
- [ ] Role can be assigned to a user with department-specific scope
- [ ] Navigation hides features the user does not have permission to access
- [ ] Visual role editor renders the permission tree correctly
- [ ] Effective permission preview reflects the correct access before saving
- [ ] Multi-tier approval rule can be configured and triggers correctly
- [ ] Single Sign-On login works with Google Workspace
- [ ] Single Sign-On login works with Microsoft 365
- [ ] API key can be generated with scoped permissions

### Project Management

- [ ] Project can be created with a name, description, and phases
- [ ] Milestones can be added to a project
- [ ] Board view displays tasks correctly by status column
- [ ] List view displays all tasks in a flat sortable list
- [ ] Members can be added to a project with a defined role
- [ ] Tasks can be assigned to a specific member
- [ ] Activity log updates when actions are taken on a task
- [ ] Notification center receives alerts for task updates and mentions
- [ ] Task dependency (predecessor/successor) can be set and is enforced
- [ ] Recurring task generates automatically on schedule
- [ ] Gantt/timeline view renders the project schedule correctly
- [ ] Time entries can be logged on a task as billable or non-billable
- [ ] Risk register entry can be added to a project
- [ ] Weekly status report is auto-generated
- [ ] Project can be saved as a reusable template
- [ ] Custom fields can be added to projects and tasks

### Dashboard and Business Intelligence

- [ ] Default dashboard loads on login for each role
- [ ] Widgets can be dragged, dropped, and resized
- [ ] Module dashboards display real-time data (HR, Accounting, Inventory, CRM, Sales, Procurement)
- [ ] Clicking a KPI card drills through to source records
- [ ] Period-comparison delta is displayed on metric widgets
- [ ] Date range filter applies correctly to dashboard data
- [ ] Branch filter scopes dashboard data to selected branch
- [ ] Department filter scopes dashboard data to selected department
- [ ] User can save a personalized layout
- [ ] Enterprise Owner can push a layout to all users in a role
- [ ] Predictive low-stock alert triggers based on sales velocity
- [ ] Scheduled report is delivered to email on the configured schedule
- [ ] Branded PDF report exports with business logo and footer
- [ ] AI-generated insights surface correctly on the dashboard

---

## BUSINESS OPERATION MODULES

### 1. Enterprise Setup and Onboarding

- [ ] User account can be created by the Enterprise Owner
- [ ] User can be deactivated and reactivated
- [ ] Role can be assigned to a user
- [ ] Role can be removed from a user
- [ ] Branch can be created with name and details
- [ ] Department can be created and linked to a branch
- [ ] Team member invitation is sent and received
- [ ] Invited member completes setup and can log in
- [ ] Subscription plan details are visible in settings
- [ ] Business name and settings can be updated

### 2. Human Resources and Payroll

- [ ] Employee profile can be created with personal information
- [ ] Government IDs (SSS, PhilHealth, Pag-IBIG, TIN) can be saved on a profile
- [ ] Bank account can be added to an employee profile
- [ ] Emergency contact can be added to an employee profile
- [ ] Department and position can be assigned to an employee
- [ ] Branch can be assigned to an employee
- [ ] Daily attendance log can be recorded
- [ ] Shift schedule can be configured and assigned
- [ ] Overtime request can be submitted and approved
- [ ] Leave type can be created with a balance and rules
- [ ] Employee leave request can be submitted
- [ ] Leave request can be approved or rejected by a manager
- [ ] Holiday-aware day count is correct on leave computation
- [ ] Philippine public holidays are pre-loaded in the holiday calendar
- [ ] Custom holidays can be added
- [ ] Payroll run can be initiated for a pay period
- [ ] Deductions are applied correctly in the payroll run
- [ ] Payroll multi-step approval workflow completes successfully
- [ ] Payslip is generated correctly after payroll approval
- [ ] Employee can view and download their payslip as PDF
- [ ] BIR Form 2316 is generated correctly per employee
- [ ] SSS remittance report is generated in the correct format
- [ ] PhilHealth remittance report is generated in the correct format
- [ ] Pag-IBIG remittance report is generated in the correct format
- [ ] 13th-month pay is computed correctly per PD 851
- [ ] Night differential is applied at the correct rate
- [ ] Holiday pay multiplier is applied at the correct rate
- [ ] Final pay is computed correctly per DOLE rules
- [ ] TRAIN Law tax bracket is applied correctly to taxable income
- [ ] Year-end annualization reconciles withholding tax correctly
- [ ] Recruitment pipeline can be created with job openings
- [ ] Applicant can be added and moved through pipeline stages
- [ ] Performance review cycle can be created and assigned
- [ ] Manager-employee review workflow completes correctly
- [ ] Training record can be added with expiry date
- [ ] Expiry reminder triggers before certification expires
- [ ] Benefits enrollment record can be created per employee
- [ ] Organizational chart renders correctly from reporting lines
- [ ] Multiple pay group calendars can be configured (semi-monthly, daily, hourly, piece-rate)

### 3. Files and Documents

- [ ] File can be uploaded from any module
- [ ] File can be attached to a sales order record
- [ ] File can be attached to a payslip record
- [ ] File can be attached to a journal entry record
- [ ] File can be attached to a purchase order record
- [ ] File can be attached to a customer profile
- [ ] Image file previews correctly in-browser
- [ ] PDF file previews correctly in-browser
- [ ] Office file previews correctly in-browser
- [ ] New upload creates a new version and previous version is retrievable
- [ ] Folder can be created and files can be organized into it
- [ ] Tag can be applied to a file
- [ ] Full-text search returns correct results by file name
- [ ] Full-text search returns correct results by tag
- [ ] Audit trail records upload, view, download, and deletion events with user and timestamp
- [ ] Storage usage is displayed correctly per module
- [ ] OCR processing makes scanned document content searchable
- [ ] E-signature request can be sent from the platform
- [ ] Document template with merge fields populates correctly from platform data
- [ ] Shareable link is generated with an expiry date and works for external access

### 4. Inventory Management

- [ ] Item can be created with name, category, and unit of measure
- [ ] Variants (size, color, etc.) can be added to an item
- [ ] Barcode can be assigned to an item
- [ ] Multiple images can be uploaded per item
- [ ] Primary image can be designated
- [ ] Stock levels are tracked independently per warehouse
- [ ] Inter-warehouse transfer can be created and confirmed
- [ ] Stock adjustment can be recorded with a reason
- [ ] Write-off can be recorded
- [ ] Cycle count can be initiated and variances recorded
- [ ] Physical inventory count can be completed and posted
- [ ] FIFO costing computes COGS correctly
- [ ] LIFO costing computes COGS correctly
- [ ] AVCO costing computes COGS correctly
- [ ] Landed cost can be allocated across a goods receipt
- [ ] Cost revaluation is reflected in the item's valuation
- [ ] Serial number can be assigned to an item and tracked
- [ ] Batch tracking is applied with expiry date enforcement
- [ ] Reorder rule triggers an alert at the minimum stock level
- [ ] Stock projection is calculated and displayed correctly
- [ ] Negative stock policy is enforced when configured
- [ ] Price list can be created and assigned to a branch or customer group
- [ ] Stock is reserved when a sales order is confirmed
- [ ] Backorder is fulfilled automatically when stock arrives
- [ ] Bill of Materials can be created with components and quantities
- [ ] Assembly transaction posts correctly with cost rollup
- [ ] RMA workflow can be initiated and completed
- [ ] Pre-order can be placed against expected inbound stock
- [ ] ABC classification runs correctly on rolling data
- [ ] Consignment stock is tracked and payment triggers on consumption
- [ ] Warranty period is recorded and visible at point of sale

### 5. Point of Sale

- [x] POS terminal can be created and configured
- [x] Cashier session can be opened and closed
- [x] Cash payment is processed correctly
- [ ] Card payment is processed correctly
- [ ] E-wallet payment is processed correctly
- [ ] Multiple payment methods can be split in one transaction
- [ ] Printed receipt is generated correctly
- [ ] Email receipt is sent successfully
- [ ] Digital receipt is displayed correctly
- [ ] Loyalty points are awarded on a completed transaction
- [ ] Loyalty points can be redeemed against a purchase
- [ ] Gift card can be issued and redeemed
- [ ] Promotional code applies the correct discount
- [x] Sale can be parked and resumed
- [ ] Transaction can be voided with a reason
- [ ] Refund can be processed and recorded
- [ ] Cash drawer opens on sale completion
- [ ] Drawer event log records all open/close events
- [ ] POS sale posts automatically to the correct GL accounts
- [ ] VAT is computed and displayed correctly on the receipt
- [ ] Senior Citizen 20% discount applies with ID number capture
- [ ] PWD 20% discount applies with ID number capture
- [x] Restaurant mode activates the floor plan view
- [x] Tables can be assigned to an order
- [ ] Waitlist can be managed from the POS
- [x] Reservation can be created and linked to a table
- [x] Kitchen display screen receives and displays orders in real time
- [x] Tab can be opened, updated, and closed
- [ ] Receipt template renders correctly on 58mm paper
- [ ] Receipt template renders correctly on 80mm paper
- [ ] Receipt template renders correctly on A4
- [ ] BIR-required fields (TIN, PTU, MIN, POS serial) appear on the receipt
- [ ] Payment methods can be configured differently per branch

### 6. Sales and Orders

- [ ] Quotation can be created with line items, pricing, and discounts
- [ ] Quotation can be sent to a customer
- [ ] Quotation can be converted to a sales order
- [ ] Sales order can be created directly
- [ ] Delivery can be created from a sales order
- [ ] Partial delivery can be processed leaving open balance on the order
- [ ] Sales return can be created against a completed order
- [ ] Customer credit limit is enforced on order creation
- [ ] Order routes to Credit Hold when the customer's limit is exceeded
- [ ] Recurring sales order generates automatically on schedule
- [ ] Commission is tracked and computed per representative on invoice payment
- [ ] Sales target can be set per representative, branch, and product category
- [ ] Performance vs target is visible in the dashboard
- [ ] Customer self-service portal allows order placement
- [ ] Customer can view their invoices in the portal
- [ ] Customer can make payments through the portal
- [ ] Sales dashboard displays revenue, volume, and order status in real time

### 7. Accounting and Finance

- [ ] Chart of accounts loads with Philippine-standard structure
- [ ] Custom accounts can be added to the chart
- [ ] Journal entry can be created with multiple debit and credit lines
- [ ] Journal entry posts and updates the general ledger
- [ ] General ledger drill-through navigates to the source transaction
- [ ] Customer invoice can be created and sent
- [ ] Customer payment can be recorded against an open invoice
- [ ] AR aging report is accurate
- [ ] Supplier bill can be recorded
- [ ] Supplier payment can be processed against an open bill
- [ ] AP aging report is accurate
- [ ] Bank account can be created
- [ ] Bank transactions can be imported or entered
- [ ] Bank reconciliation matches platform transactions to bank statement
- [ ] Fiscal period can be closed
- [ ] Closed period rejects backdated posting
- [ ] Closed period can be reopened by an authorized user
- [ ] Fixed asset can be created with acquisition details
- [ ] Depreciation schedule is computed correctly
- [ ] Asset disposal is recorded and the asset is removed from the register
- [ ] Recurring journal entry posts automatically on schedule
- [ ] Foreign exchange rate can be set
- [ ] FX revaluation posts the correct adjustment entries
- [ ] 12% VAT applies correctly to taxable transactions
- [ ] Withholding tax computes and posts correctly
- [ ] Budget can be set per account or department
- [ ] Actual vs budget variance is displayed in real time
- [ ] Cash flow forecast is accurate based on open AR and AP
- [ ] POS sale auto-posts to the ledger without a manual journal
- [ ] Customer invoice auto-posts to the ledger
- [ ] Supplier bill auto-posts to the ledger
- [ ] Goods receipt auto-posts to the ledger
- [ ] Accounting dashboard KPIs are accurate and real time
- [ ] Multi-entity books are maintained separately per entity
- [ ] Consolidated financial statement combines all entities correctly

### 8. Procurement

- [ ] Purchase request can be created with line items
- [ ] Purchase request routes through the multi-level approval workflow
- [ ] Approved purchase request can be converted to a purchase order
- [ ] Purchase order can be created directly with line items, variants, and quantities
- [ ] Purchase order is sent or communicated to the supplier
- [ ] Goods receipt can be created against an open purchase order
- [ ] Inventory stock levels update automatically on goods receipt confirmation
- [ ] Supplier profile can be created with contact details
- [ ] Multiple bank accounts can be added to a supplier
- [ ] Documents can be attached to a supplier profile
- [ ] Supplier performance scorecard updates on delivery accuracy, lead time, and quality
- [ ] RFQ can be sent to multiple suppliers simultaneously
- [ ] Supplier RFQ responses can be compared side by side
- [ ] Blanket purchase order can be created with a total value cap
- [ ] Draw-down against the blanket PO reduces the available balance correctly
- [ ] Return to Vendor transaction can be created
- [ ] Supplier debit note is generated on RTV confirmation
- [ ] Inventory deducts automatically on RTV confirmation
- [ ] Spend analysis report breaks down spend by supplier, category, and period
- [ ] Supplier self-service portal allows PO viewing and invoice upload
- [ ] Supplier can respond to an RFQ through the portal
- [ ] Drop-ship order routes the PO to the supplier for direct customer delivery

### 9. Customer Relationship Management

- [ ] Customer profile can be created with full contact details
- [ ] Customer can be tagged with a segment label
- [ ] Lead can be created and assigned to a pipeline stage
- [ ] Lead can be moved between pipeline stages
- [ ] Lead scoring rule can be configured and scores update correctly
- [ ] Opportunity can be created as a separate entity from the lead
- [ ] Opportunity closed-lost reason can be recorded
- [ ] Call can be logged against a customer or lead record
- [ ] Email can be logged against a customer or lead record
- [ ] Meeting can be logged against a customer or lead record
- [ ] Follow-up reminder can be set and triggers at the correct time
- [ ] Lead nurture sequence can be configured with multiple steps
- [ ] Nurture sequence triggers and advances automatically
- [ ] Email campaign can be created with a template
- [ ] Campaign is sent to the correct customer segment
- [ ] Email open tracking records correctly
- [ ] Unsubscribe link removes the contact from future campaigns
- [ ] Support ticket can be created for a customer
- [ ] Ticket status workflow advances correctly through stages
- [ ] SLA target is set and tracked per ticket
- [ ] NPS survey triggers automatically on ticket close
- [ ] CSAT survey triggers automatically on order delivery
- [ ] Unified activity timeline displays emails, orders, tickets, and payments in order
- [ ] Bulk lead import from CSV completes without errors
- [ ] Imported leads appear correctly in the pipeline

### 10. Queue Management

- [ ] Queue category can be created
- [ ] Numbered ticket can be issued to a customer
- [ ] Public customer display screen shows current queue status
- [ ] Ticket is called and marked as served
- [ ] Queue dashboard displays throughput and wait times in real time
- [ ] Restaurant waitlist can be managed from the queue screen
- [ ] Walk-in can be added to the waitlist
- [ ] Table assignment is updated when the customer is seated
- [ ] Reservation can be created and linked to the queue
- [ ] SMS notification is sent when the ticket is the configured number of positions away
- [ ] Remote queue joining works via QR code scan
- [ ] Remote queue joining works via public link
- [ ] Post-service satisfaction survey is triggered when the ticket is marked served

---

_Last updated: June 7, 2026_
_Prepared by: Chloe Belle Estilo_
