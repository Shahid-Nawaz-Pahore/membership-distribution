import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MembershipDistribution } from "../target/types/membership_distribution";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config(); 

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .MembershipDistribution as Program<MembershipDistribution>;

  // LOAD DISTRIBUTION ADDRESS
  const distributionAddress = new PublicKey(
    fs.readFileSync("distribution_address.txt", "utf-8")
  );

  // PLACEHOLDER RECIPIENT WALLETS (replace later)
  const recipientWallets = [
    new PublicKey("AUHuA5cyvWQ4hzHe6YHNfE4eQpHvEtnDKHqVY9gbgDWi"),
    new PublicKey("mooGAJGD4gF3HP9b5nRZDh9GFFHYMHNhXij3VLPWzkX"),
    new PublicKey("2YKBqu5ejfjx3PoeAiX4piCXKK3FKn5HNTYTEL9ArMv2"),
    new PublicKey("Bd7F9XJT9GNGbgfnQVW3RewdEsek51KuCXR6XJyWYAZs"),
    new PublicKey("6ENXhky3QwqvXSFSDsHxfCXwgAbHGMHZqJqFUNimjq8L"),
  ];

  // TOTAL SUPPLY & EQUAL ALLOCATION
  const TOTAL_SUPPLY = 250_000;
  const MAX_RECIPIENTS = recipientWallets.length;
  const ALLOCATION_WHOLE = TOTAL_SUPPLY / MAX_RECIPIENTS; // 50,000 each

  // CONVERT TO SMALLEST UNIT (mint decimals = 6)
  const ALLOCATION = new anchor.BN(ALLOCATION_WHOLE).mul(
    new anchor.BN(10).pow(new anchor.BN(6))
  );

  // LOOP TO REGISTER EACH RECIPIENT
  for (let i = 0; i < recipientWallets.length; i++) {
    const recipientWallet = recipientWallets[i];

    // Derive PDA for recipient account
    const [recipientPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("recipient"),
        distributionAddress.toBuffer(),
        recipientWallet.toBuffer(),
      ],
      program.programId
    );

    console.log(`Registering recipient ${i + 1}`);
    console.log("Recipient PDA:", recipientPda.toBase58());
    console.log("Recipient Wallet (placeholder):", recipientWallet.toBase58());
    console.log("Allocation (smallest unit):", ALLOCATION.toString());

    try {
      const tx = await program.methods
        .registerRecipient(recipientWallet, ALLOCATION)
        .accountsStrict({
          distribution: distributionAddress,
          recipient: recipientPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Recipient ${i + 1} registered successfully!`);
      console.log("Transaction Signature:", tx);
    } catch (err) {
      console.error(`❌ Failed to register recipient ${i + 1}`);
      console.error(err);
    }

    console.log("-------------------------------");
  }
}

main().catch((err) => {
  console.error("Script failed");
  console.error(err);
});