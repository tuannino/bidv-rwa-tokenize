// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Local implemented subset of T-REX v4.1.6 IModule.
 * Source: package tokenysolutions/t-rex, contracts/compliance/modular/modules/IModule.sol.
 */
interface IERC3643Module {
    function moduleTransferAction(address _from, address _to, uint256 _value) external;
    function moduleMintAction(address _to, uint256 _value) external;
    function moduleBurnAction(address _from, uint256 _value) external;
    function moduleCheck(address _from, address _to, uint256 _value, address _compliance)
        external
        view
        returns (bool);
    function name() external pure returns (string memory _name);
}
