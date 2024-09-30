// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract MemberFundManagement is EIP712 {
    using ECDSA for bytes32;

    address public owner;
    mapping(address => bool) public members;
    mapping(address => bool) public approvals;
    address[] public memberList;
    uint256 public totalAmount;
    uint256 public approvalsCount;
    uint256 public totalDeposited;

    string private constant SIGNING_DOMAIN = "MemberFundManagement";
    string private constant SIGNATURE_VERSION = "1";

    mapping(address => uint256) public nonces;

    event MemberAdded(address indexed member);
    event Approved(address indexed member, uint256 value);
    event FundsTransferred(address indexed to, uint256 amount);
    event TotalAmountSet(uint256 amount);

    constructor() EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {
        owner = msg.sender;
    }

    function addMember(address _member) external {
        require(msg.sender == owner, "Only owner can add members");
        require(!members[_member], "Member already added");

        members[_member] = true;
        memberList.push(_member);
        emit MemberAdded(_member);
    }

    function getMemberCount() external view returns (uint256) {
        return memberList.length;
    }

    function getAllMembers() external view returns (address[] memory) {
        return memberList;
    }

    function setTotalAmount(uint256 _amount) external {
        require(msg.sender == owner, "Only owner can set the amount");
        totalAmount = _amount;
        emit TotalAmountSet(_amount);
    }

    function approveWithSignature(
        address member,
        uint256 value,
        bytes memory signature
    ) external {
        require(members[member], "Only members can approve");
        require(!approvals[member], "Already approved");
        
        uint256 requiredShare = totalAmount / memberList.length;
        require(value == requiredShare, "Must approve the correct amount");

        bytes32 structHash = _hashTypedDataV4(
            keccak256(abi.encode(
                keccak256("Approval(address member,uint256 value,uint256 nonce)"),
                member,
                value,
                nonces[member]
            ))
        );

        address signer = ECDSA.recover(structHash, signature);
        require(signer == member, "Invalid signature");

        approvals[member] = true;
        approvalsCount++;
        totalDeposited += value;
        nonces[member]++; // Increment the nonce after successful approval

        emit Approved(member, value);
    }

    function transferFunds(address payable _to) external {
        require(approvalsCount == memberList.length, "Not all members approved");
        require(totalDeposited > 0, "No funds to transfer");

        _to.transfer(totalDeposited);
        emit FundsTransferred(_to, totalDeposited);

        // Reset approvals and member status
        for (uint256 i = 0; i < memberList.length; i++) {
            approvals[memberList[i]] = false;
        }

        // Clear memberList for gas efficiency
        delete memberList;
        totalAmount = 0;
        approvalsCount = 0;
        totalDeposited = 0;
    }

    receive() external payable {}

    function _hashApproval(address member, uint256 value) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            keccak256("Approval(address member,uint256 value,uint256 nonce)"),
            member,
            value,
            nonces[member]
        )));
    }
}
