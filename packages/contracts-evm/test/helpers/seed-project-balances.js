/**
 * Dựng số dư WPT theo đúng luật SC-02: phát hành vào một ví SPV rồi chuyển hết
 * sang các nhà đầu tư. Helper không để lại WPT trong SPV để tổng cung tại
 * snapshot vẫn đúng mẫu số mà các bộ P7/P12 đang kiểm.
 */
async function seedProjectBalances(project, admin, spv, allocations) {
  const total = allocations.reduce((sum, { amount }) => sum + BigInt(amount), 0n);
  if (total <= 0n) throw new Error("Tổng WPT dựng phải lớn hơn 0.");

  const spvAddress = spv.address ?? spv;
  await project.connect(admin).setWhitelisted(spvAddress, true);

  if (await project.initialSupplyMinted()) {
    await project.connect(admin).mint(spvAddress, total);
  } else {
    await project.connect(admin).mintInitialSupply(spvAddress, total);
  }

  for (const { wallet, amount } of allocations) {
    await project.connect(spv).transfer(wallet.address ?? wallet, amount);
  }

  const remaining = await project.balanceOf(spvAddress);
  if (remaining !== 0n) {
    throw new Error(`Helper SC-02 phải chuyển hết WPT khỏi SPV, còn ${remaining}.`);
  }
}

module.exports = { seedProjectBalances };
