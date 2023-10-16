// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { euint16 } from "fhevm/lib/TFHE.sol";

interface IERC20Encrypted {
    function getTotalSupply(bytes32 publicKey, bytes calldata signature) external view returns (bytes memory);

    function balanceOf(bytes32 publicKey, bytes calldata signature) external view returns (bytes memory);

    function balanceOf(address contractAddress) external view returns (euint16);

    function transfer(address to, bytes calldata encryptedAmount) external;

    function transfer(address to, euint16 encryptedAmount) external;

    function allowance(
        address spender,
        bytes32 publicKey,
        bytes calldata signature
    ) external view returns (bytes memory);

    function approve(address spender, bytes calldata encryptedAmount) external;

    function transferFrom(address from, address to, bytes calldata encryptedAmount) external;
}
