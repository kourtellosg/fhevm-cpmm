import { ethers } from "hardhat";

import type { EncryptedCPMM, EncryptedERC20 } from "../../types";
import { getSigners } from "../signers";

export interface CPMMDeployment {
  cpmm: EncryptedCPMM;
  token0: EncryptedERC20;
  token1: EncryptedERC20;
}

export async function deployEncryptedCPMMFixture(): Promise<CPMMDeployment> {
  const signers = await getSigners(ethers);

  const tokenFactory = await ethers.getContractFactory("EncryptedERC20");
  const token0 = await tokenFactory.connect(signers.alice).deploy("Token0", "TKN0");
  await token0.waitForDeployment();
  const token0Address = await token0.getAddress();
  const token1 = await tokenFactory.connect(signers.alice).deploy("Token1", "TKN1");
  await token1.waitForDeployment();
  const token1Address = await token1.getAddress();
  const contractFactory = await ethers.getContractFactory("EncryptedCPMM");
  const cpmm = await contractFactory.connect(signers.alice).deploy(token0Address, token1Address);
  await cpmm.waitForDeployment();

  return { cpmm, token0, token1 };
}
