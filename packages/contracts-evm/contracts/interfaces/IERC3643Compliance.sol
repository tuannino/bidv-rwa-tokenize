// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Local implemented subset of T-REX v4.1.6 IModularCompliance.
 * Source: package tokenysolutions/t-rex, contracts/compliance/modular/IModularCompliance.sol.
 */
interface IERC3643Compliance {
    event TokenBound(address _token);
    event TokenUnbound(address _token);
    event ModuleAdded(address indexed _module);
    event ModuleRemoved(address indexed _module);

    function bindToken(address _token) external;
    function unbindToken(address _token) external;
    function addModule(address _module) external;
    function removeModule(address _module) external;
    function transferred(address _from, address _to, uint256 _amount) external;
    function created(address _to, uint256 _amount) external;
    function destroyed(address _from, uint256 _amount) external;
    function canTransfer(address _from, address _to, uint256 _amount) external view returns (bool);
    function getModules() external view returns (address[] memory);
    function getTokenBound() external view returns (address);
    function isModuleBound(address _module) external view returns (bool);
}
