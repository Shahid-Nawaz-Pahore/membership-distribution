# 📖 Membership Distribution Program - User Guide

## 🚀 Initial Setup

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

## 📋 Distribution Flow

### Step 1: Initialize Distribution

Before running the script, ensure the expiry timestamp in `lib.rs` and `initialize.ts` matches.

```bash
npx ts-node app/initialize-distribution.ts > initialize.txt
```


### Step 2: Register Recipients

```bash
npx ts-node app/register-recipients.ts
```


### Step 3: Lock Distribution

```bash
npx ts-node app/lock-distribution.ts
```

### Step 4: Fund the Vault

```typescript
// This should match the vault ATA from initialize.ts terminal output
const vault = new anchor.web3.PublicKey("YourVaultATAFromInitializeOutput");
```

```bash
npx ts-node app/fund-distribution.ts
```

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


### Step 6: Withdraw Unclaimed Tokens (After Expiry)

```bash
npx ts-node app/withdraw-unclaimed.ts
```

