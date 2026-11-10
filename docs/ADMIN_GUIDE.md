# Admin User Guide

This guide is for the shop owner and staff of **Bapin Garments**.

## Logging in

1. Open `https://<your-website>/admin`, or click **Admin Login** in the website footer.
2. Enter your **username or email** and **password**.
3. Forgot your password? Click **Forgot password?**, enter your email, and open the reset link (valid for 30 minutes).
4. For security, an account is **locked for 15 minutes after 5 wrong passwords**.
5. To change your password, click the **key icon** at the top right.

## Roles

| Role | Can do |
|---|---|
| **Super Admin** | Everything, including adding and removing admin users |
| **Admin** | Products, prices, categories, stock, enquiries, reports and settings |
| **Staff** | View products, record Stock In/Out, handle enquiries, download reports. Cannot delete products or change settings. |

## Dashboard

- **Cards:** total products, categories, garments in stock, out-of-stock products, low-stock products, total and new enquiries, featured products. Click a card to open the matching list.
- **Charts:** stock by department or category, stock availability, products added per month, monthly stock in vs stock out, most viewed products, most enquired products, and enquiries over the last 30 days.
- **Filters:** category, product, stock status and date range. Dates apply to the enquiry figures.
- **Low Stock Alerts** lists the variants to reorder first.

## Products

### Add a product
1. **Products → Add Product**.
2. **Basic information:** name, a unique **SKU** (e.g. `BG-MSH-010`), category, fabric and description.
3. **Pricing:** MRP, plus a discounted price if the item is on offer. The discount % is calculated automatically.
4. **Sizes:** click a quick-add group (Adult, Waist, Kids, Baby, Free) or type a custom size and press Enter.
5. **Colours:** click a preset colour or type a name and pick its shade.
6. **Stock grid:** enter the quantity for each size × colour. On a new product, this is recorded as *Opening stock*.
7. **Images:** drag in or select up to 12 photos (JPG, PNG or WEBP, max 5 MB each). The first photo is the main image.
8. **Labels:** New Arrival, Featured, Best Seller, Trending, and *Visible on website*.
9. Click **Create Product**. It appears on the website immediately.

### Edit a product
- Click the product name or the ✏️ icon. Changes go live as soon as you click **Save Changes**.
- To change the main photo, hover over an image and click ⭐. Click 🗑 to delete an image.
- Changing a quantity in the stock grid records an *Adjustment* in Stock History.
- To hide a product without deleting it, turn off **Visible on website**.

### Quick price change
On the product list, click the **₹** icon, enter the new MRP and discounted price, and save.

## Inventory (daily stock work)

**Inventory** lists one row per size and colour, with the current quantity, minimum level and status.

| Button | Use it when |
|---|---|
| **In** (Stock In) | New stock arrives from a supplier, or a customer returns an item |
| **Out** (Stock Out) | You make a sale, an item is damaged, or you return goods to a supplier |
| ⚙ (Set Exact Qty) | A physical stock count doesn't match the system |

Choose a reason and, optionally, a reference such as a bill or PO number. The screen shows the new quantity before you confirm, and stock can never go below zero.

**Stock History** shows every movement: date, product, variant, type, change, balance after, reason, reference and who made it. You can filter by type, dates or product.

### Low-stock threshold
- Store-wide default: **Settings → Inventory**. For example, 5 means 5 or fewer units shows as *Low Stock*.
- Per-product override: in the product form, **Stock Alert → Minimum stock threshold**.

## Categories

**Categories** shows the full tree. Use **Add Category** to create a top-level department or a sub-category (choose a parent). You can edit the name, URL slug, image, description, display order and visibility. A category can only be deleted when it has no products or sub-categories.

## Customer Enquiries

New enquiries from the website appear here, and the owner also gets a WhatsApp alert.

1. Use the status tabs (**New**, **Contacted**, **Pending**, **Closed**) or search by name or mobile, and filter by date.
2. Click an enquiry to see its full details, the customer's earlier enquiries, and the WhatsApp alert status.
3. Click **WhatsApp** to reply with a pre-filled message, or **Call**.
4. Update the **status** and add **internal remarks**. Customers never see remarks.
5. **Export Excel** downloads the current filtered list.

## Reports

**Reports** offers 7 reports. Each has **Preview**, **Excel** and **PDF** buttons:

1. Complete Product List
2. Category-wise Inventory (with stock value)
3. Available Stock (size/colour level)
4. Low Stock
5. Out of Stock
6. Customer Enquiries (filter by dates or status)
7. Monthly Inventory (opening, stock in, stock out, adjustments and closing for the month you choose)

Use the filter bar at the top to limit by category, month or dates.

## Settings

- **Store Information:** shop name, tagline, address, phone, WhatsApp number (for click-to-chat), email, business hours, Google Maps embed and directions links, announcement bar, About text, social links. These appear across the website immediately.
- **Inventory:** default low-stock threshold.
- **WhatsApp API:** Phone Number ID, Business Account ID, access token (stored encrypted), template settings. See `docs/WHATSAPP_SETUP.md`.
- **Notifications:** turn owner alerts on or off, set the owner's WhatsApp number, and send a test message.

**WhatsApp Logs** shows whether each alert was *sent*, *failed* (with the reason) or *skipped*.

## Admin Users (Super Admin only)

Add staff with their own login, choose a role, reset a password, or disable an account. Disabling an account or changing its role signs that person out immediately. The system always keeps at least one active Super Admin.

## Good practice

- Change the default passwords on day one.
- Give each staff member their own login, so Stock History shows who did what.
- Record every sale as **Stock Out** so website stock stays accurate.
- Check **Low Stock Alerts** on the dashboard every morning.
- Download the **Monthly Inventory Report** at the end of each month for your records.
