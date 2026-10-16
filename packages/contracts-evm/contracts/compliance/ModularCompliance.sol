// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC3643Compliance} from "../interfaces/IERC3643Compliance.sol";
import {IERC3643Module} from "../interfaces/IERC3643Module.sol";

/** @notice Minimal modular-compliance core compatible with the implemented T-REX selectors. */
contract ModularCompliance is AccessControl, IERC3643Compliance {
    uint256 private constant MAX_MODULES = 25;

    address private _tokenBound;
    address[] private _modules;
    mapping(address => bool) private _moduleBound;

    error ZeroAddress();
    error TokenAlreadyBound(address token);
    error TokenNotBound(address token);
    error OnlyBoundToken(address caller);
    error ModuleAlreadyBound(address module);
    error ModuleNotBound(address module);
    error TooManyModules();

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    modifier onlyBoundToken() {
        if (msg.sender != _tokenBound || _tokenBound == address(0)) revert OnlyBoundToken(msg.sender);
        _;
    }

    function bindToken(address token) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        if (_tokenBound != address(0)) revert TokenAlreadyBound(_tokenBound);
        _tokenBound = token;
        emit TokenBound(token);
    }

    function unbindToken(address token) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token != _tokenBound || token == address(0)) revert TokenNotBound(token);
        _tokenBound = address(0);
        emit TokenUnbound(token);
    }

    function addModule(address module) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (module == address(0)) revert ZeroAddress();
        if (_moduleBound[module]) revert ModuleAlreadyBound(module);
        if (_modules.length >= MAX_MODULES) revert TooManyModules();
        _moduleBound[module] = true;
        _modules.push(module);
        emit ModuleAdded(module);
    }

    function removeModule(address module) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_moduleBound[module]) revert ModuleNotBound(module);
        _moduleBound[module] = false;
        for (uint256 i = 0; i < _modules.length; ++i) {
            if (_modules[i] == module) {
                _modules[i] = _modules[_modules.length - 1];
                _modules.pop();
                break;
            }
        }
        emit ModuleRemoved(module);
    }

    function transferred(address from, address to, uint256 amount) external override onlyBoundToken {
        for (uint256 i = 0; i < _modules.length; ++i) {
            IERC3643Module(_modules[i]).moduleTransferAction(from, to, amount);
        }
    }

    function created(address to, uint256 amount) external override onlyBoundToken {
        for (uint256 i = 0; i < _modules.length; ++i) {
            IERC3643Module(_modules[i]).moduleMintAction(to, amount);
        }
    }

    function destroyed(address from, uint256 amount) external override onlyBoundToken {
        for (uint256 i = 0; i < _modules.length; ++i) {
            IERC3643Module(_modules[i]).moduleBurnAction(from, amount);
        }
    }

    function canTransfer(address from, address to, uint256 amount)
        external
        view
        override
        returns (bool)
    {
        for (uint256 i = 0; i < _modules.length; ++i) {
            if (!IERC3643Module(_modules[i]).moduleCheck(from, to, amount, address(this))) return false;
        }
        return true;
    }

    function getModules() external view override returns (address[] memory) {
        return _modules;
    }

    function getTokenBound() external view override returns (address) {
        return _tokenBound;
    }

    function isModuleBound(address module) external view override returns (bool) {
        return _moduleBound[module];
    }
}
