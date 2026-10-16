// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Minimal identity-registry view used by the ERC-3643 token core.
 * The three selectors match T-REX v4.1.6 IIdentityRegistry. This PoC deliberately
 * omits ONCHAINID and claim-registry methods.
 */
interface IIdentityRegistry {
    function contains(address _userAddress) external view returns (bool);
    function isVerified(address _userAddress) external view returns (bool);
    function investorCountry(address _userAddress) external view returns (uint16);
}
