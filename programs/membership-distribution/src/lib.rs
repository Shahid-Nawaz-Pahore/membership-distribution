use anchor_lang::prelude::*;

declare_id!("54MDjjmV8xPhsgW2R2rKXVmTogyph6TJ5VKUcKgB7TYm");

#[program]
pub mod membership_distribution {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
