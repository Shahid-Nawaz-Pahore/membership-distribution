# 📖 Membership Distribution Program - User Guide

A comprehensive walkthrough for building, deploying, and running the **Membership Distribution program** on Solana devnet. The program manages token distributions to members with strict campaign parameters (**120 recipients**, **250,000 total tokens**, **April 11, 2026 expiry**).

## ✅ Prerequisites

Ensure you have installed:

- **[Node.js](https://nodejs.org/)** (v16 or higher)
- **[Anchor CLI](https://www.anchor-lang.com/docs/installation)** (0.32.1)
- **[Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)**
- **[Yarn](https://yarnpkg.com/)** or npm

## 🚀 Initial Setup

### 1. Clone and Install Dependencies

```bash
# Navigate to your project directory
cd membership-distribution

# Install dependencies
yarn install
# or
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Your token mint address (create one first if needed)
MINT_ADDRESS=YourTokenMintAddressHere

# Admin's token account holding the mint tokens
ADMIN_ATA_ADDRESS=YourAdminAssociatedTokenAccountHere

# Admin private key (base58 format) for withdrawal
ADMIN_SECRET_KEY=YourAdminPrivateKeyBase58Here

# Recipient private keys (base58 format) for testing claims
RECIPIENT_SECRET_KEY=YourRecipientPrivateKeyBase58Here
```

### 3. Set Solana Configuration

```bash
# Set to devnet
solana config set --url https://api.devnet.solana.com
```

### 4. Prepare Your Token Mint

You need an **SPL token with 6 decimals** for this campaign. If you don't have one:

```bash
# Create a new token with 6 decimals
spl-token create-token --decimals 6

# Create token account
spl-token create-account <TOKEN_MINT_ADDRESS> --owner <OWNER_ADDRESS> --fee-payer <FEE_PAYER_PATH>

# Mint tokens (250,000 + decimals = 250,000 * 10^6)
spl-token mint <TOKEN_MINT_ADDRESS> 250000000000 <ADMIN_ATA_ADDRESS> --fee-payer <FEE_PAYER_PATH>
```

## 🔨 Build and Deploy

### 1. Clean and Build

```bash
# Remove any previous build artifacts
anchor clean

# Build the program
anchor build
```

### 2. Deploy to Devnet

```bash
anchor deploy --provider.cluster https://api.devnet.solana.com
```

## 📋 Distribution Flow

Follow these steps **in order**. Each script must complete successfully before moving to the next.

### Step 1: Initialize Distribution

Before running the script, ensure the expiry timestamp in `lib.rs` and `initialize.ts` matches (`2026-04-11T23:59:59Z`).

```bash
npx ts-node app/initialize-distribution.ts > initialize.txt
```

✅ **Look for:** "Initialization Success" and verify the distribution address is saved.

---

### Step 2: Register Recipients

Update recipient wallets and allocations in `app/register-recipients.ts`:

```typescript
// Replace these placeholder addresses with real recipient wallets
const recipientWallets = [
  new PublicKey("Recipient1PublicKeyHere"),
  new PublicKey("Recipient2PublicKeyHere"),
  new PublicKey("Recipient3PublicKeyHere"),
  // ... up to 120 recipients
];

const ALLOCATION_WHOLE = TOTAL_SUPPLY / MAX_RECIPIENTS;
```

Then run:

```bash
npx ts-node app/register-recipients.ts
```

✅ **Expected output:** 120 successful registration messages with transaction signatures.

---

### Step 3: Lock Distribution

```bash
npx ts-node app/lock-distribution.ts
```

⚠️ **Why this matters:** The vault can only be funded after locking.

---

### Step 4: Fund the Vault

Verify your vault address in `app/fund-distribution.ts`:

```typescript
// This should match the vault ATA from initialize.ts terminal output
const vault = new anchor.web3.PublicKey("YourVaultATAFromInitializeOutput");
```

Then fund with the total campaign amount:

```bash
npx ts-node app/fund-distribution.ts
```

✅ **Verify:** Check [Solana Explorer](https://explorer.solana.com) to confirm tokens moved to the vault.

---

### Step 5: Claim Tokens (as Recipient)

To claim, you need the recipient's private key. Set it in `.env`:

```env
RECIPIENT_SECRET_KEY=Base58EncodedRecipientPrivateKey
```

Update `app/claim.ts`:

```typescript
const secretKeyBase58 = process.env.RECIPIENT_SECRET_KEY;
```

Then run:

```bash
npx ts-node app/claim.ts
```

✅ **Expected result:** The recipient receives their allocated tokens (check on Solana Explorer).

> **Note:** Run this script for each recipient with their respective private key.

---


### Step 6: Withdraw Unclaimed Tokens (After Expiry)

After campaign expiry, the admin can withdraw any unclaimed tokens:

```bash
npx ts-node app/withdraw-unclaimed.ts
```

**Requirements:**
- ✅ Campaign must be expired
- ✅ Admin private key must be set in `.env`
- ✅ Withdraws full vault balance by default


