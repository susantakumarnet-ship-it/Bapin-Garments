# WhatsApp Business Cloud API Setup

Bapin Garments uses WhatsApp in two ways:

| Feature | How it works | Setup needed |
|---|---|---|
| Floating chat button, product enquiry buttons, "contact store" links | `wa.me` click-to-chat links. The customer's own WhatsApp opens with a pre-filled message (product name, code, size, colour, price, URL). | Only the **WhatsApp number** in *Admin → Settings → Store Information* |
| **Automatic owner notification** when a customer submits the contact/enquiry form | The **server** calls the Meta WhatsApp Cloud API | The steps below |

The access token is used **only on the server**. It is never sent to the browser.

## 1. Create the Meta app and phone number

1. Go to https://developers.facebook.com/apps → **Create App** → type **Business** → add the **WhatsApp** product.
2. Under **WhatsApp → API Setup**, note the **Phone number ID** and the **WhatsApp Business Account ID**.
3. Add and verify your business phone number (or use the free test number while developing). With the test number, add the owner's number as a recipient.

## 2. Create a permanent access token

The temporary token on the API Setup page expires in 24 hours. For production:

1. **Business Settings → Users → System users → Add** (role: Admin).
2. **Add assets** → assign your WhatsApp app and WhatsApp account with full control.
3. **Generate new token**: select the app, set expiry to *Never*, and tick the `whatsapp_business_messaging` and `whatsapp_business_management` permissions.
4. Copy the token.

## 3. Register the message template

WhatsApp only allows businesses to *start* a conversation with an **approved template**. In **WhatsApp Manager → Message templates → Create template**:

- **Category:** Utility
- **Name:** `new_customer_enquiry`
- **Language:** English (`en`)
- **Body:**

```
NEW CUSTOMER ENQUIRY – BAPIN GARMENTS

Customer Name: {{1}}
Mobile: {{2}}
Product: {{3}}
Message: {{4}}

Please contact the customer.
```

Sample values: `Rahul Kumar`, `9876543210`, `Men's Casual Shirt`, `I want to know the price and available sizes.`

Submit it and wait for approval, usually a few minutes.

> **Text mode:** if you turn off "Send using approved message template" in Settings, the server sends a plain text message. WhatsApp only delivers that if the owner's number messaged the business number within the last 24 hours, so template mode is recommended.

## 4. Configure Bapin Garments

**Preferred:** set server environment variables. They override the admin settings.

```
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_API_VERSION=v21.0
```

**Or** in *Admin → Settings → WhatsApp API*, enter the Phone Number ID, Business Account ID and access token. The token is encrypted with AES-256-GCM before it is stored and is never shown again.

Then in *Admin → Settings → Notifications*:

1. Turn on **Send a WhatsApp notification to the owner**.
2. Enter the **owner's WhatsApp number** with country code, e.g. `919876543210`.
3. Click **Save Settings**, then **Send test notification**.

## 5. Monitoring

- *Admin → WhatsApp Logs* shows every notification attempt with status **sent**, **failed** (with Meta's error message) or **skipped** (disabled or not configured).
- Each enquiry's detail view also shows its notification status.
- The customer's enquiry is **always saved**, even when the WhatsApp call fails.

## Consent and policy

- The enquiry form includes a consent checkbox, stored on the customer record (`customers.whatsapp_consent`).
- Notifications go to the **store owner's own number**. Don't use this integration to send promotional messages to customers without opt-in. Follow the WhatsApp Business Messaging Policy.

## Common errors

| Error | Fix |
|---|---|
| `(#131030) Recipient phone number not in allowed list` | Test number: add the owner's number under API Setup → recipients |
| `Template name does not exist in the translation` | Template name or language code doesn't match the approved template |
| `Invalid OAuth access token` | Token expired or wrong. Generate a permanent System User token. |
| `(#132000) Number of parameters does not match` | The template body must have exactly 4 variables `{{1}}`–`{{4}}` |
