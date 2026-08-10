// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AssetRegistry
 * @notice BIDV RWA — Quản lý niêm yết và vòng đời tài sản thực (RWA) on-chain.
 *         Hỗ trợ 3 loại token: BGT (Vàng), BRT (Bất động sản), BCT (Carbon Credit).
 *
 * Architecture:
 *  - Mỗi "listing" là một tài sản độc lập với totalSupply riêng
 *  - Admin BIDV tạo listing → mint token cho nhà đầu tư đã KYC
 *  - Oracle cập nhật giá VND định kỳ
 *  - KYC whitelist kiểm soát ai được nhận token
 */

// ─────────────────────────────────────────────────────────────────────────────
// RWA Token — ERC-20 với mint/burn kiểm soát bởi AssetRegistry
// ─────────────────────────────────────────────────────────────────────────────
contract RWAToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    address public registry; // chỉ AssetRegistry được mint/burn

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, address _registry) {
        name = _name;
        symbol = _symbol;
        registry = _registry;
    }

    modifier onlyRegistry() {
        require(msg.sender == registry, "RWAToken: caller is not registry");
        _;
    }

    function mint(address to, uint256 amount) external onlyRegistry {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external onlyRegistry {
        require(balanceOf[from] >= amount, "RWAToken: insufficient balance");
        totalSupply -= amount;
        balanceOf[from] -= amount;
        emit Transfer(from, address(0), amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "RWAToken: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "RWAToken: insufficient allowance");
        require(balanceOf[from] >= amount, "RWAToken: insufficient balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AssetRegistry — contract chính
// ─────────────────────────────────────────────────────────────────────────────
contract AssetRegistry {

    // ── Types ────────────────────────────────────────────────────────────────

    enum AssetType { GOLD, REAL_ESTATE, CARBON }
    enum AssetStatus { ACTIVE, PROCESSING, PAUSED, DELISTED }

    struct AssetListing {
        bytes32 id;           // keccak256 của assetCode
        string  assetCode;
        string  assetName;
        AssetType assetType;
        AssetStatus status;
        address tokenAddress;
        uint256 totalSupply;
        uint256 priceVnd;     // giá VND * 1e6
        string  backingRef;
        uint256 createdAt;
        uint256 updatedAt;
        address createdBy;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    address public owner;
    address public oracle;

    mapping(bytes32 => AssetListing) public listings;
    bytes32[] public listingIds;

    mapping(address => bool) public kycWhitelist;
    mapping(address => uint8) public kycLevel;    // 0=none, 1=L1, 2=L2, 3=VIP
    mapping(address => bool) public frozenWallets;

    // ── Events ────────────────────────────────────────────────────────────────

    event AssetListed(bytes32 indexed id, string assetCode, AssetType assetType, address tokenAddress);
    event AssetStatusChanged(bytes32 indexed id, AssetStatus oldStatus, AssetStatus newStatus);
    event TokensMinted(bytes32 indexed assetId, address indexed to, uint256 amount);
    event TokensBurned(bytes32 indexed assetId, address indexed from, uint256 amount);
    event PriceUpdated(bytes32 indexed assetId, uint256 oldPrice, uint256 newPrice);
    event WalletWhitelisted(address indexed wallet, uint8 kycLevel);
    event WalletFrozen(address indexed wallet, bool frozen);
    event KycLevelUpdated(address indexed wallet, uint8 oldLevel, uint8 newLevel);

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "AssetRegistry: caller is not owner");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle || msg.sender == owner, "AssetRegistry: caller is not oracle");
        _;
    }

    modifier listingExists(bytes32 id) {
        require(listings[id].createdAt != 0, "AssetRegistry: listing not found");
        _;
    }

    modifier notFrozen(address wallet) {
        require(!frozenWallets[wallet], "AssetRegistry: wallet is frozen");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        oracle = msg.sender;
    }

    // ── Asset Management ─────────────────────────────────────────────────────

    function createListing(
        string calldata assetCode,
        string calldata assetName,
        AssetType assetType,
        string calldata tokenName,
        string calldata tokenSymbol,
        uint256 initialPrice,
        string calldata backingRef
    ) external onlyOwner returns (bytes32 id) {
        id = keccak256(abi.encodePacked(assetCode));
        require(listings[id].createdAt == 0, "AssetRegistry: listing already exists");

        RWAToken token = new RWAToken(tokenName, tokenSymbol, address(this));

        listings[id] = AssetListing({
            id: id,
            assetCode: assetCode,
            assetName: assetName,
            assetType: assetType,
            status: AssetStatus.ACTIVE,
            tokenAddress: address(token),
            totalSupply: 0,
            priceVnd: initialPrice,
            backingRef: backingRef,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            createdBy: msg.sender
        });
        listingIds.push(id);

        emit AssetListed(id, assetCode, assetType, address(token));
    }

    function setListingStatus(bytes32 id, AssetStatus newStatus)
        external onlyOwner listingExists(id)
    {
        AssetStatus old = listings[id].status;
        listings[id].status = newStatus;
        listings[id].updatedAt = block.timestamp;
        emit AssetStatusChanged(id, old, newStatus);
    }

    // ── Token Operations ─────────────────────────────────────────────────────

    function mint(bytes32 assetId, address to, uint256 amount)
        external onlyOwner listingExists(assetId) notFrozen(to)
    {
        require(kycWhitelist[to], "AssetRegistry: recipient not KYC whitelisted");
        require(listings[assetId].status == AssetStatus.ACTIVE, "AssetRegistry: listing not active");

        RWAToken(listings[assetId].tokenAddress).mint(to, amount);
        listings[assetId].totalSupply += amount;
        listings[assetId].updatedAt = block.timestamp;
        emit TokensMinted(assetId, to, amount);
    }

    function burn(bytes32 assetId, address from, uint256 amount)
        external onlyOwner listingExists(assetId)
    {
        require(listings[assetId].totalSupply >= amount, "AssetRegistry: insufficient total supply");
        RWAToken(listings[assetId].tokenAddress).burn(from, amount);
        listings[assetId].totalSupply -= amount;
        listings[assetId].updatedAt = block.timestamp;
        emit TokensBurned(assetId, from, amount);
    }

    // ── Oracle Price ──────────────────────────────────────────────────────────

    function updatePrice(bytes32 assetId, uint256 priceVnd)
        external onlyOracle listingExists(assetId)
    {
        uint256 old = listings[assetId].priceVnd;
        listings[assetId].priceVnd = priceVnd;
        listings[assetId].updatedAt = block.timestamp;
        emit PriceUpdated(assetId, old, priceVnd);
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    // ── KYC Management ───────────────────────────────────────────────────────

    function setKyc(address wallet, uint8 level) external onlyOwner {
        uint8 old = kycLevel[wallet];
        kycLevel[wallet] = level;
        kycWhitelist[wallet] = level > 0;
        emit WalletWhitelisted(wallet, level);
        emit KycLevelUpdated(wallet, old, level);
    }

    function revokeKyc(address wallet) external onlyOwner {
        uint8 old = kycLevel[wallet];
        kycLevel[wallet] = 0;
        kycWhitelist[wallet] = false;
        emit KycLevelUpdated(wallet, old, 0);
    }

    function setFrozen(address wallet, bool frozen) external onlyOwner {
        frozenWallets[wallet] = frozen;
        emit WalletFrozen(wallet, frozen);
    }

    // ── View Functions ────────────────────────────────────────────────────────

    function getListing(bytes32 id) external view returns (AssetListing memory) {
        return listings[id];
    }

    function getAllListingIds() external view returns (bytes32[] memory) {
        return listingIds;
    }

    function getListingCount() external view returns (uint256) {
        return listingIds.length;
    }

    function getListingIdByCode(string calldata assetCode) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(assetCode));
    }

    function getTokenBalance(bytes32 assetId, address wallet)
        external view listingExists(assetId) returns (uint256)
    {
        return RWAToken(listings[assetId].tokenAddress).balanceOf(wallet);
    }

    function getTotalValueVnd(bytes32 assetId)
        external view listingExists(assetId) returns (uint256)
    {
        AssetListing memory l = listings[assetId];
        return (l.totalSupply * l.priceVnd) / 1e6;
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "AssetRegistry: zero address");
        owner = newOwner;
    }
}
