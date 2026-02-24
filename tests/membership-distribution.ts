import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";

describe("membership-distribution", () => {
  const RECIPIENT_SEED = Buffer.from("recipient");
  const VAULT_AUTHORITY_SEED = Buffer.from("vault-authority");
  const DECIMALS = 6;
  const RECIPIENT_COUNT = 120;
  const TOTAL_WHOLE_TOKENS = 250_000;
  const BASE_WHOLE_ALLOCATION = 2_000;

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const wallet = provider.wallet as anchor.Wallet & { payer: Keypair };
  const workspace = anchor.workspace as Record<string, any>;
  const program = (workspace.MembershipDistribution ??
    workspace.membershipDistribution) as any;

  if (!program) {
    throw new Error("Program handle not found in anchor workspace");
  }

  const tokenScale = new BN(10).pow(new BN(DECIMALS));
  const totalCap = new BN(TOTAL_WHOLE_TOKENS).mul(tokenScale);

  let mint: PublicKey;
  let authorityTokenAccount: PublicKey;
  let distribution: Keypair;
  let vaultAuthority: PublicKey;
  let vault: PublicKey;

  const recipients: Keypair[] = [];
  const allocations: BN[] = [];

  const airdropSol = async (
    address: PublicKey,
    lamports = LAMPORTS_PER_SOL
  ) => {
    const signature = await provider.connection.requestAirdrop(
      address,
      lamports
    );
    await provider.connection.confirmTransaction(signature, "confirmed");
  };

  const deriveRecipientPda = (
    distributionKey: PublicKey,
    walletKey: PublicKey
  ) =>
    PublicKey.findProgramAddressSync(
      [RECIPIENT_SEED, distributionKey.toBuffer(), walletKey.toBuffer()],
      program.programId
    )[0];

  before(
    "initialize distribution, register 120 recipients, lock and fund vault",
    async () => {
      mint = await createMint(
        provider.connection,
        wallet.payer,
        wallet.publicKey,
        null,
        DECIMALS
      );
      const authorityAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        mint,
        wallet.publicKey
      );
      authorityTokenAccount = authorityAta.address;

      distribution = Keypair.generate();
      [vaultAuthority] = PublicKey.findProgramAddressSync(
        [VAULT_AUTHORITY_SEED, distribution.publicKey.toBuffer()],
        program.programId
      );
      vault = getAssociatedTokenAddressSync(mint, vaultAuthority, true);

      const expiryTs = new BN(Math.floor(Date.now() / 1000) + 3600);
      await program.methods
        .initializeDistribution(RECIPIENT_COUNT, totalCap, expiryTs)
        .accounts({
          distribution: distribution.publicKey,
          authority: wallet.publicKey,
          mint,
          vaultAuthority,
          vault,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([distribution])
        .rpc();

      for (let i = 0; i < RECIPIENT_COUNT; i += 1) {
        recipients.push(Keypair.generate());
        const wholeAmount =
          i === RECIPIENT_COUNT - 1
            ? TOTAL_WHOLE_TOKENS - BASE_WHOLE_ALLOCATION * (RECIPIENT_COUNT - 1)
            : BASE_WHOLE_ALLOCATION;
        allocations.push(new BN(wholeAmount).mul(tokenScale));
      }

      for (let i = 0; i < RECIPIENT_COUNT; i += 1) {
        const recipientWallet = recipients[i].publicKey;
        const recipient = deriveRecipientPda(
          distribution.publicKey,
          recipientWallet
        );
        await program.methods
          .registerRecipient(recipientWallet, allocations[i])
          .accounts({
            distribution: distribution.publicKey,
            recipient,
            authority: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      }

      await program.methods
        .lockDistribution()
        .accounts({
          distribution: distribution.publicKey,
          authority: wallet.publicKey,
        })
        .rpc();

      await mintTo(
        provider.connection,
        wallet.payer,
        mint,
        authorityTokenAccount,
        wallet.publicKey,
        BigInt(totalCap.toString())
      );

      await program.methods
        .fundVault(totalCap)
        .accounts({
          distribution: distribution.publicKey,
          authority: wallet.publicKey,
          mint,
          sourceTokenAccount: authorityTokenAccount,
          vault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const distributionAccount = await program.account.distributionState.fetch(
        distribution.publicKey
      );
      expect(distributionAccount.totalRecipients).to.eq(RECIPIENT_COUNT);
      expect(distributionAccount.totalAllocated.toString()).to.eq(
        totalCap.toString()
      );
    }
  );

  it("allows a recipient to claim tokens directly", async () => {
    const claimant = recipients[0];
    const recipient = deriveRecipientPda(
      distribution.publicKey,
      claimant.publicKey
    );
    const claimantAta = getAssociatedTokenAddressSync(mint, claimant.publicKey);

    await airdropSol(claimant.publicKey);

    await program.methods
      .claim()
      .accounts({
        distribution: distribution.publicKey,
        recipient,
        claimant: claimant.publicKey,
        mint,
        vaultAuthority,
        vault,
        claimantTokenAccount: claimantAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([claimant])
      .rpc();

    const claimantBalance = await getAccount(provider.connection, claimantAta);
    expect(claimantBalance.amount.toString()).to.eq(allocations[0].toString());

    const recipientState = await program.account.recipientState.fetch(
      recipient
    );
    expect(recipientState.claimed).to.eq(true);
    expect(recipientState.active).to.eq(false);
  });

  it("allows authority to admin-distribute to a recipient", async () => {
    const target = recipients[1];
    const recipient = deriveRecipientPda(
      distribution.publicKey,
      target.publicKey
    );
    const targetAta = getAssociatedTokenAddressSync(mint, target.publicKey);

    await program.methods
      .adminDistribute()
      .accounts({
        distribution: distribution.publicKey,
        recipient,
        authority: wallet.publicKey,
        recipientWallet: target.publicKey,
        mint,
        vaultAuthority,
        vault,
        recipientTokenAccount: targetAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const targetBalance = await getAccount(provider.connection, targetAta);
    expect(targetBalance.amount.toString()).to.eq(allocations[1].toString());

    const distributionState = await program.account.distributionState.fetch(
      distribution.publicKey
    );
    expect(distributionState.claimedRecipients).to.eq(2);
  });

  it("blocks claims after expiry and supports explicit expiry invalidation", async () => {
    const shortDistribution = Keypair.generate();
    const [shortVaultAuthority] = PublicKey.findProgramAddressSync(
      [VAULT_AUTHORITY_SEED, shortDistribution.publicKey.toBuffer()],
      program.programId
    );
    const shortVault = getAssociatedTokenAddressSync(
      mint,
      shortVaultAuthority,
      true
    );
    const shortTotal = new BN(100).mul(tokenScale);
    const shortExpiry = new BN(Math.floor(Date.now() / 1000) + 2);
    const shortRecipientWallet = Keypair.generate();
    const shortRecipient = deriveRecipientPda(
      shortDistribution.publicKey,
      shortRecipientWallet.publicKey
    );
    const shortRecipientAta = getAssociatedTokenAddressSync(
      mint,
      shortRecipientWallet.publicKey
    );

    await program.methods
      .initializeDistribution(1, shortTotal, shortExpiry)
      .accounts({
        distribution: shortDistribution.publicKey,
        authority: wallet.publicKey,
        mint,
        vaultAuthority: shortVaultAuthority,
        vault: shortVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([shortDistribution])
      .rpc();

    await program.methods
      .registerRecipient(shortRecipientWallet.publicKey, shortTotal)
      .accounts({
        distribution: shortDistribution.publicKey,
        recipient: shortRecipient,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .lockDistribution()
      .accounts({
        distribution: shortDistribution.publicKey,
        authority: wallet.publicKey,
      })
      .rpc();

    await mintTo(
      provider.connection,
      wallet.payer,
      mint,
      authorityTokenAccount,
      wallet.publicKey,
      BigInt(shortTotal.toString())
    );

    await program.methods
      .fundVault(shortTotal)
      .accounts({
        distribution: shortDistribution.publicKey,
        authority: wallet.publicKey,
        mint,
        sourceTokenAccount: authorityTokenAccount,
        vault: shortVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await airdropSol(shortRecipientWallet.publicKey);
    await new Promise((resolve) => setTimeout(resolve, 4000));

    let expiredClaimBlocked = false;
    try {
      await program.methods
        .claim()
        .accounts({
          distribution: shortDistribution.publicKey,
          recipient: shortRecipient,
          claimant: shortRecipientWallet.publicKey,
          mint,
          vaultAuthority: shortVaultAuthority,
          vault: shortVault,
          claimantTokenAccount: shortRecipientAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([shortRecipientWallet])
        .rpc();
    } catch (error) {
      expiredClaimBlocked = true;
      expect(`${error}`).to.contain("DistributionExpired");
    }
    expect(expiredClaimBlocked).to.eq(true);

    await program.methods
      .expireDistribution()
      .accounts({ distribution: shortDistribution.publicKey })
      .rpc();

    const shortDistributionState =
      await program.account.distributionState.fetch(
        shortDistribution.publicKey
      );
    expect(shortDistributionState.isExpired).to.eq(true);
  });
});
