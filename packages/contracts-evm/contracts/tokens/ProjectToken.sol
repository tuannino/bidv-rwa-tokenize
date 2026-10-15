// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20Snapshotable} from "../extensions/ERC20Snapshotable.sol";
import {IERC3643Token} from "../interfaces/IERC3643Token.sol";
import {IERC3643Compliance} from "../interfaces/IERC3643Compliance.sol";
import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";

/**
 * @title ProjectToken (WPT — Wind Power Token)
 * @notice ERC-3643-shaped security token core for the WPT PoC.
 * @dev Role mapping: MINTER_ROLE issues only to the SC-02 SPV wallet; AGENT_ROLE is
 * the ERC-3643 agent for freeze, forced transfer and agent burn; SNAPSHOT_ROLE closes
 * profit periods; PAUSER_ROLE pauses token movement. The PoC intentionally omits
 * recoveryAddress, batchMint, batchBurn, setName, setSymbol and ONCHAINID claims.
 * Snapshot and one-time SPV issuance remain project-specific extensions.
 */
contract ProjectToken is
    ERC20Burnable,
    ERC20Snapshotable,
    AccessControl,
    IERC3643Token
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    mapping(address => bool) public override isFrozen;
    mapping(address => uint256) private _frozenTokens;
    IIdentityRegistry private _identityRegistry;
    IERC3643Compliance private _compliance;
    address private _onchainID;
    bool private _paused;
    bool private _forcedMove;

    address public spvWallet;
    bool public initialSupplyMinted;
    uint8 private immutable _customDecimals;

    event InitialSupplyMinted(address indexed spvWallet, uint256 amount, address indexed operator);

    error InitialSupplyAlreadyMinted();
    error InitialSupplyNotMinted();
    error MintTargetNotSpv(address to, address spv);
    error ZeroAddress();
    error ZeroAmount();
    error ArrayLengthMismatch();
    error TokenAlreadyPaused();
    error TokenNotPaused();
    error TokenPaused();
    error WalletFrozen(address wallet);
    error IdentityRegistryNotSet();
    error ComplianceNotSet();
    error IdentityNotVerified(address wallet);
    error ComplianceRejected(address from, address to, uint256 amount);
    error InsufficientUnfrozenTokens(address wallet, uint256 available, uint256 requested);
    error FreezeAmountExceedsBalance(address wallet, uint256 balance, uint256 requestedTotal);
    error UnfreezeAmountExceedsFrozen(address wallet, uint256 frozen, uint256 requested);

    constructor(string memory name_, string memory symbol_, uint8 decimals_, address admin)
        ERC20(name_, symbol_)
    {
        if (admin == address(0)) revert ZeroAddress();
        _customDecimals = decimals_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(AGENT_ROLE, admin);
        _grantRole(SNAPSHOT_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    function version() external pure override returns (string memory) {
        return "4.1.6-poc";
    }

    function onchainID() external view override returns (address) {
        return _onchainID;
    }

    function setOnchainID(address onchainID_) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        _onchainID = onchainID_;
    }

    function identityRegistry() public view override returns (IIdentityRegistry) {
        return _identityRegistry;
    }

    function compliance() public view override returns (IERC3643Compliance) {
        return _compliance;
    }

    function setIdentityRegistry(address identityRegistry_)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (identityRegistry_ == address(0)) revert ZeroAddress();
        _identityRegistry = IIdentityRegistry(identityRegistry_);
        emit IdentityRegistryAdded(identityRegistry_);
    }

    function setCompliance(address compliance_) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (compliance_ == address(0)) revert ZeroAddress();
        _compliance = IERC3643Compliance(compliance_);
        emit ComplianceAdded(compliance_);
    }

    function paused() external view override returns (bool) {
        return _paused;
    }

    function pause() external override onlyRole(PAUSER_ROLE) {
        if (_paused) revert TokenAlreadyPaused();
        _paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external override onlyRole(PAUSER_ROLE) {
        if (!_paused) revert TokenNotPaused();
        _paused = false;
        emit Unpaused(msg.sender);
    }

    function setAddressFrozen(address userAddress, bool freeze)
        external
        override
        onlyRole(AGENT_ROLE)
    {
        isFrozen[userAddress] = freeze;
        emit AddressFrozen(userAddress, freeze, msg.sender);
    }

    function batchSetAddressFrozen(address[] calldata userAddresses, bool[] calldata freeze)
        external
        override
        onlyRole(AGENT_ROLE)
    {
        if (userAddresses.length != freeze.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < userAddresses.length; ++i) {
            isFrozen[userAddresses[i]] = freeze[i];
            emit AddressFrozen(userAddresses[i], freeze[i], msg.sender);
        }
    }

    function freezePartialTokens(address userAddress, uint256 amount)
        external
        override
        onlyRole(AGENT_ROLE)
    {
        uint256 requestedTotal = _frozenTokens[userAddress] + amount;
        uint256 balance = balanceOf(userAddress);
        if (requestedTotal > balance) {
            revert FreezeAmountExceedsBalance(userAddress, balance, requestedTotal);
        }
        _frozenTokens[userAddress] = requestedTotal;
        emit TokensFrozen(userAddress, amount);
    }

    function unfreezePartialTokens(address userAddress, uint256 amount)
        external
        override
        onlyRole(AGENT_ROLE)
    {
        uint256 frozen = _frozenTokens[userAddress];
        if (amount > frozen) revert UnfreezeAmountExceedsFrozen(userAddress, frozen, amount);
        _frozenTokens[userAddress] = frozen - amount;
        emit TokensUnfrozen(userAddress, amount);
    }

    function getFrozenTokens(address userAddress) external view override returns (uint256) {
        return _frozenTokens[userAddress];
    }

    function mintInitialSupply(address spv, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (spv == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (initialSupplyMinted) revert InitialSupplyAlreadyMinted();

        spvWallet = spv;
        initialSupplyMinted = true;
        _mint(spv, amount);
        emit InitialSupplyMinted(spv, amount, msg.sender);
    }

    function mint(address to, uint256 amount) external override onlyRole(MINTER_ROLE) {
        if (!initialSupplyMinted) revert InitialSupplyNotMinted();
        if (to != spvWallet) revert MintTargetNotSpv(to, spvWallet);
        _mint(to, amount);
    }

    /** @notice ERC-3643 agent burn. ERC20Burnable burn(uint256) remains holder self-burn. */
    function burn(address userAddress, uint256 amount) external override onlyRole(AGENT_ROLE) {
        _releaseFrozenForForcedMove(userAddress, amount);
        _forcedMove = true;
        _burn(userAddress, amount);
        _forcedMove = false;
    }

    function snapshot() external onlyRole(SNAPSHOT_ROLE) returns (uint256) {
        return _snapshot();
    }

    function forcedTransfer(address from, address to, uint256 amount)
        external
        override
        onlyRole(AGENT_ROLE)
        returns (bool)
    {
        IIdentityRegistry registry = _requireIdentityRegistry();
        if (!registry.isVerified(to)) revert IdentityNotVerified(to);
        _releaseFrozenForForcedMove(from, amount);
        _forcedMove = true;
        _transfer(from, to, amount);
        _forcedMove = false;
        return true;
    }

    function batchTransfer(address[] calldata toList, uint256[] calldata amounts) external override {
        if (toList.length != amounts.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < toList.length; ++i) {
            _transfer(msg.sender, toList[i], amounts[i]);
        }
    }

    function batchForcedTransfer(
        address[] calldata fromList,
        address[] calldata toList,
        uint256[] calldata amounts
    ) external override onlyRole(AGENT_ROLE) {
        if (fromList.length != toList.length || fromList.length != amounts.length) {
            revert ArrayLengthMismatch();
        }
        IIdentityRegistry registry = _requireIdentityRegistry();
        for (uint256 i = 0; i < fromList.length; ++i) {
            if (!registry.isVerified(toList[i])) revert IdentityNotVerified(toList[i]);
            _releaseFrozenForForcedMove(fromList[i], amounts[i]);
            _forcedMove = true;
            _transfer(fromList[i], toList[i], amounts[i]);
            _forcedMove = false;
        }
    }

    function _releaseFrozenForForcedMove(address from, uint256 amount) private {
        uint256 balance = balanceOf(from);
        uint256 frozen = _frozenTokens[from];
        if (amount <= balance && amount > balance - frozen) {
            uint256 released = amount - (balance - frozen);
            _frozenTokens[from] = frozen - released;
            emit TokensUnfrozen(from, released);
        }
    }

    function _requireIdentityRegistry() private view returns (IIdentityRegistry registry) {
        registry = _identityRegistry;
        if (address(registry) == address(0)) revert IdentityRegistryNotSet();
    }

    function _requireCompliance() private view returns (IERC3643Compliance compliance_) {
        compliance_ = _compliance;
        if (address(compliance_) == address(0)) revert ComplianceNotSet();
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Snapshotable)
    {
        if (_forcedMove) {
            super._update(from, to, value);
            return;
        }

        if (_paused) revert TokenPaused();
        if (from != address(0) && isFrozen[from]) revert WalletFrozen(from);
        if (to != address(0) && isFrozen[to]) revert WalletFrozen(to);

        IIdentityRegistry registry = _requireIdentityRegistry();
        IERC3643Compliance compliance_ = _requireCompliance();

        if (from != address(0)) {
            uint256 available = balanceOf(from) - _frozenTokens[from];
            if (value > available) revert InsufficientUnfrozenTokens(from, available, value);
        }

        if (from == address(0)) {
            if (!registry.isVerified(to)) revert IdentityNotVerified(to);
            if (!compliance_.canTransfer(from, to, value)) {
                revert ComplianceRejected(from, to, value);
            }
        } else if (to != address(0)) {
            if (!registry.isVerified(from)) revert IdentityNotVerified(from);
            if (!registry.isVerified(to)) revert IdentityNotVerified(to);
            if (!compliance_.canTransfer(from, to, value)) {
                revert ComplianceRejected(from, to, value);
            }
        }

        super._update(from, to, value);

        if (from == address(0)) compliance_.created(to, value);
        else if (to == address(0)) compliance_.destroyed(from, value);
        else compliance_.transferred(from, to, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
