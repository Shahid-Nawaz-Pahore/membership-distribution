import * as anchor from "@coral-xyz/anchor";
import { MembershipDistribution } from "../target/types/membership_distribution";
import fs from "fs";
import * as dotenv from "dotenv";
dotenv.config(); 
async function fundVault(amount: number) {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MembershipDistribution as anchor.Program<MembershipDistribution>;

  const distributionAddress = new anchor.web3.PublicKey(
    fs.readFileSync("distribution_address.txt", "utf8")
  );

  // Replace with your actual source token account (the authority's token account holding the mint)
  const sourceTokenAccount = new anchor.web3.PublicKey(process.env.ADMIN_ATA_ADDRESS!);

  // Replace with the vault ATA printed during initialization
  const vault = new anchor.web3.PublicKey("CZir3oGuB5rgeWFAsYKSbskWijSGyihKek3ivMGBj7zB");

  // Replace with your mint address
  const mint = new anchor.web3.PublicKey(process.env.MINT_ADDRESS!);

  const tx = await program.methods
    .fundVault(new anchor.BN(amount)) // amount in smallest unit (like lamports / decimals)
    .accountsStrict({
      distribution: distributionAddress,
      authority: provider.wallet.publicKey,
      mint,
      sourceTokenAccount,
      vault,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log("Vault funded successfully:", tx);
}

// Example: fund 50 tokens with 6 decimals → 50 * 10^6 = 50000000
fundVault(250000000000).catch(console.error);