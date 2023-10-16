// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity 0.8.19;

import "fhevm/lib/TFHE.sol";
import { EIP712WithModifier } from "fhevm/abstracts/EIP712WithModifier.sol";
import { IERC20Encrypted } from "./interfaces/IERC20Encrypted.sol";

contract EncryptedCPMM is EIP712WithModifier {
    /// ==========================================
    /// =========== State variables ==============
    /// ==========================================
    IERC20Encrypted public immutable token0;
    IERC20Encrypted public immutable token1;

    euint16 private reserve0;
    euint16 private reserve1;

    euint16 private totalSupply;
    mapping(address userAddress => euint16 encryptedBalance) private balances;

    constructor(address _token0, address _token1) EIP712WithModifier("Authorization token", "1") {
        token0 = IERC20Encrypted(_token0);
        token1 = IERC20Encrypted(_token1);
    }

    /// ==========================================
    /// ========== Private Methods ===============
    /// ==========================================

    function _mint(address _to, euint16 _amount) private {
        totalSupply = totalSupply + _amount;
        balances[_to] = balances[_to] + _amount;
    }

    function _burn(address _from, euint16 _amount) private {
        totalSupply = totalSupply - _amount;
        balances[_from] = balances[_from] - _amount;
    }

    function _update(euint16 _encryptedRes0, euint16 _encryptedRes1) private {
        reserve0 = _encryptedRes0;
        reserve1 = _encryptedRes1;
    }

    /// ==========================================
    /// ========== Public Methods ================
    /// ==========================================

    function swap(address _tokenIn, bytes calldata _encryptedAmountIn) external returns (euint16 amountOut) {
        require(_tokenIn == address(token0) || _tokenIn == address(token1), "token not available");
        euint16 amountIn = TFHE.asEuint16(_encryptedAmountIn);
        // ebool amountInMoreThanZero = TFHE.gt(amountIn, 0);
        // TFHE.optReq(amountInMoreThanZero);
        require(TFHE.decrypt(TFHE.gt(amountIn, 0)), "amount in = 0");

        bool isToken0 = _tokenIn == address(token0);
        (IERC20Encrypted tokenIn, IERC20Encrypted tokenOut, euint16 reserveIn, euint16 reserveOut) = isToken0
            ? (token0, token1, reserve0, reserve1)
            : (token1, token0, reserve1, reserve0);

        tokenIn.transferFrom(msg.sender, address(this), _encryptedAmountIn);
        // 1% fee
        euint16 amountInWithFee = TFHE.div(amountIn * TFHE.asEuint16(990), 1000);
        euint16 reserveOutMulWithFee = TFHE.mul(reserveOut, amountInWithFee);
        euint16 reserveInAddFee = TFHE.add(reserveIn, amountInWithFee);
        amountOut = TFHE.div(reserveOutMulWithFee, TFHE.decrypt(reserveInAddFee));
        tokenOut.transfer(msg.sender, amountOut);

        _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));
    }

    function addLiquidity(
        bytes calldata _encryptedAmount0,
        bytes calldata _encryptedAmount1
    ) external returns (euint16 shares) {
        token0.transferFrom(msg.sender, address(this), _encryptedAmount0);
        token1.transferFrom(msg.sender, address(this), _encryptedAmount1);

        euint16 bal0 = token0.balanceOf(address(this));
        euint16 bal1 = token1.balanceOf(address(this));

        euint16 d0 = bal0 - reserve0;
        euint16 d1 = bal1 - reserve1;

        // Note: For some reason the below does not work and had to use next block for shares calculation
        // euint16 sumOfDs = d0 + d1;
        // shares = TFHE.cmux(
        //     TFHE.gt(totalSupply, 0),
        //     TFHE.div(sumOfDs * totalSupply, TFHE.decrypt(reserve0 + reserve1)),
        //     sumOfDs
        // );
        shares = d0 + d1;
        if (TFHE.decrypt(TFHE.gt(totalSupply, 0))) {
            shares = TFHE.div(TFHE.mul(shares, totalSupply), TFHE.decrypt(reserve0 + reserve1));
        }

        ebool sharesMoreThanZero = TFHE.gt(shares, 0);
        TFHE.optReq(sharesMoreThanZero);
        _mint(msg.sender, shares);

        _update(bal0, bal1);
    }

    function removeLiquidity(bytes calldata _encryptedShares) external returns (euint16 amount0, euint16 amount1) {
        euint16 bal0 = token0.balanceOf(address(this));
        euint16 bal1 = token1.balanceOf(address(this));

        euint16 shares = TFHE.asEuint16(_encryptedShares);
        uint16 decryptedTotalSupply = TFHE.decrypt(totalSupply);
        amount0 = TFHE.div(TFHE.mul(shares, bal0), decryptedTotalSupply);
        amount1 = TFHE.div(TFHE.mul(shares, bal1), decryptedTotalSupply);

        require(TFHE.decrypt(TFHE.gt(amount0, 0)), "amount0 = 0");
        require(TFHE.decrypt(TFHE.gt(amount1, 0)), "amount1 = 0");

        _burn(msg.sender, shares);
        _update(TFHE.sub(bal0, amount0), TFHE.sub(bal1, amount1));

        token0.transfer(msg.sender, amount0);
        token1.transfer(msg.sender, amount1);
    }

    /// ==========================================
    /// ========== Getter Methods ================
    /// ==========================================

    function balanceOf(
        bytes32 publicKey,
        bytes calldata signature
    ) public view onlySignedPublicKey(publicKey, signature) returns (bytes memory) {
        return TFHE.reencrypt(balances[msg.sender], publicKey, 0);
    }

    function getTotalSupply(
        bytes32 publicKey,
        bytes calldata signature
    ) public view onlySignedPublicKey(publicKey, signature) returns (bytes memory) {
        return TFHE.reencrypt(totalSupply, publicKey, 0);
    }

    function getReserves(
        bytes32 publicKey,
        bytes calldata signature
    ) public view onlySignedPublicKey(publicKey, signature) returns (bytes memory res0, bytes memory res1) {
        res0 = TFHE.reencrypt(reserve0, publicKey, 0);
        res1 = TFHE.reencrypt(reserve1, publicKey, 0);
    }
}
