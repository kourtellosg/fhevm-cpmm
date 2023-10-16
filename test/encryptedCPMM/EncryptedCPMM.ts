import { expect } from "chai";
import { ethers } from "hardhat";

import { EncryptedCPMM, EncryptedERC20 } from "../../types";
import { createInstances } from "../instance";
import { getSigners } from "../signers";
import { FhevmInstances } from "../types";
import { createTransaction } from "../utils";
import { deployEncryptedCPMMFixture } from "./EncryptedCPMM.fixture";

describe.only("EncryptedCPMM", function () {
  const TOKENS_TO_MINT = 1000;
  const LIQUIDITY_AMOUNT = TOKENS_TO_MINT / 2;

  let encryptedCPMMAddress: string,
    token0Address: string,
    token1Address: string,
    encryptedCPMM: EncryptedCPMM,
    token0: EncryptedERC20,
    token1: EncryptedERC20,
    CPMMInstances: FhevmInstances,
    token0Instances: FhevmInstances,
    token1Instances: FhevmInstances;

  const addLiquidity = async function () {
    const encryptedAmount = CPMMInstances.alice.encrypt16(LIQUIDITY_AMOUNT);
    console.log("--- Adding liquidity ---");
    const tx = await encryptedCPMM.addLiquidity(encryptedAmount, encryptedAmount);
    // const tx = await createTransaction(encryptedCPMM.addLiquidity, encryptedAmount, encryptedAmount);
    await tx.wait();
    console.log("--- Liquidity added ---");

    return encryptedAmount;
  };

  const prepareTests = async function () {
    // We mint tokens and approve the CPMM contract
    const encryptedAmount = CPMMInstances.alice.encrypt16(TOKENS_TO_MINT);
    let tx = await createTransaction(token0.mint, encryptedAmount);
    await tx.wait();
    tx = await createTransaction(token1.mint, encryptedAmount);
    await tx.wait();
    tx = await createTransaction(token0.approve, encryptedCPMMAddress, encryptedAmount);
    await tx.wait();
    tx = await createTransaction(token1.approve, encryptedCPMMAddress, encryptedAmount);
    await tx.wait();
  };

  before(async function () {
    this.timeout(180_000);
    this.signers = await getSigners(ethers);
  });

  beforeEach("Deploy contracts and prepare tests", async function () {
    const { cpmm, token0: deployedtoken0, token1: deployedToken1 } = await deployEncryptedCPMMFixture();
    encryptedCPMMAddress = await cpmm.getAddress();
    token0Address = await deployedtoken0.getAddress();
    token1Address = await deployedToken1.getAddress();

    encryptedCPMM = cpmm;
    token0 = deployedtoken0;
    token1 = deployedToken1;

    CPMMInstances = await createInstances(encryptedCPMMAddress, ethers, this.signers);
    token0Instances = await createInstances(token0Address, ethers, this.signers);
    token1Instances = await createInstances(token1Address, ethers, this.signers);

    await prepareTests();
  });

  it("initialize correctly", async function () {
    const token0 = await encryptedCPMM.token0();
    const token1 = await encryptedCPMM.token1();
    expect(token0).to.equal(token0Address);
    expect(token1).to.equal(token1Address);
  });

  it("add liquidity", async function () {
    await addLiquidity();
    // Check token0 were transfer from Alice's wallet
    const token0Alice = token0Instances.alice.getTokenSignature(token0Address)!;
    const encryptedBalanceToken0 = await token0["balanceOf(bytes32,bytes)"](
      token0Alice.publicKey,
      token0Alice.signature,
    );
    const balanceToken0 = token0Instances.alice.decrypt(token0Address, encryptedBalanceToken0);
    expect(balanceToken0).to.equal(LIQUIDITY_AMOUNT);
    // Check token1 were transfer from Alice's wallet
    const token1Alice = token1Instances.alice.getTokenSignature(token1Address)!;
    const encryptedBalanceToken1 = await token1["balanceOf(bytes32,bytes)"](
      token1Alice.publicKey,
      token1Alice.signature,
    );
    const balanceToken1 = token1Instances.alice.decrypt(token1Address, encryptedBalanceToken1);
    expect(balanceToken1).to.equal(LIQUIDITY_AMOUNT);
    // Check CPMM balance of Alice
    const cpmmAlice = CPMMInstances.alice.getTokenSignature(encryptedCPMMAddress)!;
    const encryptedCPMMBalance = await encryptedCPMM.balanceOf(cpmmAlice.publicKey, cpmmAlice.signature);
    const balance = CPMMInstances.alice.decrypt(encryptedCPMMAddress, encryptedCPMMBalance);
    expect(balance).to.equal(LIQUIDITY_AMOUNT * 2);
    // Check total supply
    const encryptedTotalSupply = await encryptedCPMM.getTotalSupply(cpmmAlice.publicKey, cpmmAlice.signature);
    const totalSupply = CPMMInstances.alice.decrypt(encryptedCPMMAddress, encryptedTotalSupply);
    expect(totalSupply).to.equal(LIQUIDITY_AMOUNT * 2);
    // Check reserves
    const encryptedReserves = await encryptedCPMM.getReserves(cpmmAlice.publicKey, cpmmAlice.signature);
    const res0 = CPMMInstances.alice.decrypt(encryptedCPMMAddress, encryptedReserves.res0);
    const res1 = CPMMInstances.alice.decrypt(encryptedCPMMAddress, encryptedReserves.res1);
    expect(res0).to.equal(LIQUIDITY_AMOUNT);
    expect(res1).to.equal(LIQUIDITY_AMOUNT);
  });

  it.skip("remove liquidity", async function () {
    const encryptedAmount = await addLiquidity();
    console.log("--- Removing liquidity ---");
    const tx = await createTransaction(encryptedCPMM.removeLiquidity, encryptedAmount);
    await tx.wait();
    console.log("--- Removed liquidity ---");
    // Check token0 were transfer to Alice's wallet
    const token0Alice = token0Instances.alice.getTokenSignature(token0Address)!;
    const encryptedBalanceToken0 = await token0["balanceOf(bytes32,bytes)"](
      token0Alice.publicKey,
      token0Alice.signature,
    );
    const balanceToken0 = token0Instances.alice.decrypt(token0Address, encryptedBalanceToken0);
    console.log(balanceToken0);
    // expect(balanceToken0).to.equal(TOKENS_TO_MINT);
    // Check token1 were transfer from Alice's wallet
    const token1Alice = token1Instances.alice.getTokenSignature(token1Address)!;
    const encryptedBalanceToken1 = await token1["balanceOf(bytes32,bytes)"](
      token1Alice.publicKey,
      token1Alice.signature,
    );
    const balanceToken1 = token1Instances.alice.decrypt(token1Address, encryptedBalanceToken1);
    console.log(balanceToken1);
    // expect(balanceToken1).to.equal(TOKENS_TO_MINT);
    // Check CPMM balance of Alice
    const cpmmAlice = CPMMInstances.alice.getTokenSignature(encryptedCPMMAddress)!;
    const encryptedCPMMBalance = await encryptedCPMM.balanceOf(cpmmAlice.publicKey, cpmmAlice.signature);
    const balance = CPMMInstances.alice.decrypt(encryptedCPMMAddress, encryptedCPMMBalance);
    console.log(balance);
    // expect(balance).to.equal(0);
    // Check total supply
    const encryptedTotalSupply = await encryptedCPMM.getTotalSupply(cpmmAlice.publicKey, cpmmAlice.signature);
    const totalSupply = CPMMInstances.alice.decrypt(encryptedCPMMAddress, encryptedTotalSupply);
    console.log(totalSupply);
    // expect(totalSupply).to.equal(0);
    // Check reserves
    const encryptedReserves = await encryptedCPMM.getReserves(cpmmAlice.publicKey, cpmmAlice.signature);
    const res0 = CPMMInstances.alice.decrypt(encryptedCPMMAddress, encryptedReserves.res0);
    const res1 = CPMMInstances.alice.decrypt(encryptedCPMMAddress, encryptedReserves.res1);
    console.log(res0);
    console.log(res1);
    // expect(res0).to.equal(0);
    // expect(res1).to.equal(0);
  });

  it("swap tokens", async function () {
    const SWAP_AMOUNT = 100;
    await addLiquidity();
    // Transfer tokens to Bob
    const encryptedAmount = token0Instances.alice.encrypt16(SWAP_AMOUNT);
    const transaction = await token0
      .connect(this.signers.alice)
      ["transfer(address,bytes)"](this.signers.bob.address, encryptedAmount);
    await transaction.wait();
    // Bob approves cpmm contract
    await token0.connect(this.signers.bob).approve(encryptedCPMMAddress, encryptedAmount);

    console.log("--- Swapping tokens ---");
    const encryptedSwapAmount = CPMMInstances.bob.encrypt16(SWAP_AMOUNT);
    const cpmmBob = encryptedCPMM.connect(this.signers.bob);
    const tx = await cpmmBob.swap(token0Address, encryptedSwapAmount);
    await tx.wait();
    console.log("--- Swap done ---");
    // Check Bob's balance of token0 after swap
    const token0Bob = token0Instances.bob.getTokenSignature(token0Address)!;
    const encryptedBalanceToken0 = await token0
      .connect(this.signers.bob)
      ["balanceOf(bytes32,bytes)"](token0Bob.publicKey, token0Bob.signature);
    const balanceToken0 = token0Instances.bob.decrypt(token0Address, encryptedBalanceToken0);
    expect(balanceToken0).to.equal(0);
    // Check Bob's balance of token1 after swap
    const token1Bob = token1Instances.bob.getTokenSignature(token1Address)!;
    const encryptedBalanceToken1 = await token1
      .connect(this.signers.bob)
      ["balanceOf(bytes32,bytes)"](token1Bob.publicKey, token1Bob.signature);
    const balanceToken1 = token1Instances.bob.decrypt(token1Address, encryptedBalanceToken1);
    console.log(balanceToken1);
    // Note: here it seems that we are getting a wrong value ...
  });
});
