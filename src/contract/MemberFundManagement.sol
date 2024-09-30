// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MemberFundManagement {
    address public owner;
    mapping(address => bool) public members;
    mapping(address => bool) public approvals;
    address[] public memberList;
    uint256 public totalAmount;
    uint256 public approvalsCount;
    uint256 public totalDeposited; 

    event MemberAdded(address indexed member);
    event Approved(address indexed member, uint256 value);
    event FundsTransferred(address indexed to, uint256 amount);
    event TotalAmountSet(uint256 amount);

    constructor() {
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

    function getMember(uint256 index) external view returns (address) {
        require(index < memberList.length, "Index out of bounds");
        return memberList[index]; 
    }

    function getAllMembers() external view returns (address[] memory) {
        return memberList;
    }

    function setTotalAmount(uint256 _amount) external {
        require(msg.sender == owner, "Only owner can set the amount");
        totalAmount = _amount;
        emit TotalAmountSet(_amount);
    }

    function approve() external payable {
        require(members[msg.sender], "Only members can approve");
        require(!approvals[msg.sender], "Already approved");

        uint256 requiredShare = totalAmount / memberList.length;

        require(msg.value > 0, "Must send some Ether");
        require(msg.value == requiredShare, "Must send the correct Ether to approve");

        approvals[msg.sender] = true;
        approvalsCount++;
        totalDeposited += msg.value; 
        emit Approved(msg.sender, msg.value);
    }

    function transferFunds(address payable _to) external {
        require(approvalsCount == memberList.length, "Not all members approved");
        require(totalDeposited > 0, "No funds to transfer");

        _to.transfer(totalDeposited);
        emit FundsTransferred(_to, totalDeposited);

        for (uint256 i = 0; i < memberList.length; i++) {
            approvals[memberList[i]] = false; 
            members[memberList[i]] = false;
        }

        totalAmount = 0;
        approvalsCount = 0; 
        totalDeposited = 0; 
        delete memberList; 
    }

    receive() external payable {}
}
