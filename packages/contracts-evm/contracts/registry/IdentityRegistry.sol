// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";

/**
 * @title IdentityRegistry
 * @notice ERC-3643-shaped identity registry for the PoC, without ONCHAINID or claims.
 * @dev Read selectors match T-REX v4.1.6. Write functions intentionally accept only
 * wallet and country because this PoC has no ONCHAINID identity contract.
 */
contract IdentityRegistry is AccessControl, IIdentityRegistry {
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    struct Investor {
        bool registered;
        uint16 country;
    }

    mapping(address => Investor) private _investors;

    event IdentityRegistered(address indexed investorAddress, uint16 indexed country);
    event IdentityRemoved(address indexed investorAddress);
    event CountryUpdated(address indexed investorAddress, uint16 indexed country);

    error ZeroAddress();
    error ArrayLengthMismatch();
    error IdentityNotRegistered(address investorAddress);

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(AGENT_ROLE, admin);
    }

    function registerIdentity(address userAddress, uint16 country) public onlyRole(AGENT_ROLE) {
        if (userAddress == address(0)) revert ZeroAddress();
        Investor storage investor = _investors[userAddress];
        if (investor.registered) {
            investor.country = country;
            emit CountryUpdated(userAddress, country);
            return;
        }
        investor.registered = true;
        investor.country = country;
        emit IdentityRegistered(userAddress, country);
    }

    function batchRegisterIdentity(address[] calldata userAddresses, uint16[] calldata countries)
        external
        onlyRole(AGENT_ROLE)
    {
        if (userAddresses.length != countries.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < userAddresses.length; ++i) {
            registerIdentity(userAddresses[i], countries[i]);
        }
    }

    function deleteIdentity(address userAddress) external onlyRole(AGENT_ROLE) {
        if (!_investors[userAddress].registered) revert IdentityNotRegistered(userAddress);
        delete _investors[userAddress];
        emit IdentityRemoved(userAddress);
    }

    function updateCountry(address userAddress, uint16 country) external onlyRole(AGENT_ROLE) {
        if (!_investors[userAddress].registered) revert IdentityNotRegistered(userAddress);
        _investors[userAddress].country = country;
        emit CountryUpdated(userAddress, country);
    }

    function contains(address userAddress) external view override returns (bool) {
        return _investors[userAddress].registered;
    }

    function isVerified(address userAddress) external view override returns (bool) {
        return _investors[userAddress].registered;
    }

    function investorCountry(address userAddress) external view override returns (uint16) {
        return _investors[userAddress].country;
    }
}
