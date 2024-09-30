import React, { useEffect, useState } from 'react';
import { ethers, keccak256, AbiCoder } from 'ethers';
import './App.css';
import abi from './abis/MemberFundManagement.json';

const App = () => {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [members, setMembers] = useState([]);
  const [newMember, setNewMember] = useState('');
  const [amount, setAmount] = useState('');
  const [distributedAmounts, setDistributedAmounts] = useState({});
  const [approvalStatus, setApprovalStatus] = useState({});
  const [approvalsReceived, setApprovalsReceived] = useState(0);
  const [transferAddress, setTransferAddress] = useState('');

  useEffect(() => {
    const loadBlockchainData = async () => {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contractAddress = '0xA55bD5d17Bf9A3486ee842eE394283Bb488Dc585';

        try {
          const contract = new ethers.Contract(contractAddress, abi.abi, signer);
          setContract(contract);
          await loadMembers(contract);
        } catch (error) {
          console.error('Error creating contract:', error);
        }
      } else {
        alert('Please install MetaMask!');
      }
    };

    loadBlockchainData();
  }, []);

  const loadMembers = async (contract) => {
    try {
      const memberCount = await contract.getMemberCount();
      const loadedMembers = [];
      const updatedApprovalStatus = {};

      for (let i = 0; i < memberCount; i++) {
        const member = await contract.getMember(i);
        loadedMembers.push(member);
        updatedApprovalStatus[member] = await contract.approvals(member);
      }

      setMembers(loadedMembers);
      setApprovalStatus(updatedApprovalStatus);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const connectWallet = async () => {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setAccount(accounts[0]);
  };

  const addMember = async () => {
    if (!newMember) return;

    try {
      const tx = await contract.addMember(newMember);
      await tx.wait();

      setMembers([...members, newMember]);
      setApprovalStatus({ ...approvalStatus, [newMember]: false });
      setNewMember('');
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const distributeFunds = (totalAmount) => {
    const amountPerMember = totalAmount / members.length;
    const updatedDistributedAmounts = {};

    members.forEach((member) => {
      updatedDistributedAmounts[member] = amountPerMember;
    });

    setDistributedAmounts(updatedDistributedAmounts);
  };


  const setTotalAmount = async () => {
    if (!amount) return;

    try {
      const amountInWei = ethers.parseUnits(amount, 'ether'); // Adjusted usage
      const tx = await contract.setTotalAmount(amountInWei);
      await tx.wait();

      alert(`Total amount set to ${amount} Ether.`);
      distributeFunds(Number(amount));
      setAmount('');
    } catch (error) {
      console.error('Error setting total amount:', error);
    }
  };

  const approveTransaction = async () => {
    try {
      const totalAmount = await contract.totalAmount();
      const memberCount = await contract.getMemberCount();
      const amountPerMember = totalAmount / memberCount;

      const nonce = await contract.nonces(account);
      
      // Create an instance of AbiCoder
      const abiCoder = new AbiCoder();
      const encodedParams = abiCoder.encode(
        ["address", "uint256", "uint256"],
        [account, amountPerMember, nonce]
      );

      const message = keccak256(encodedParams);

      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, account]
      });

      const tx = await contract.approveWithSignature(account, ethers.parseUnits(amountPerMember.toString(), 'wei'), signature, {
        gasLimit: 300000,
      });

      await tx.wait();
      alert('Transaction approved successfully!');

      setApprovalStatus({ ...approvalStatus, [account]: true });
      setApprovalsReceived((prev) => prev + 1);

      setDistributedAmounts((prev) => {
        const updatedAmounts = { ...prev };
        updatedAmounts[account] = 0;
        return updatedAmounts;
      });
    } catch (error) {
      console.error('Error approving transaction:', error);
    }
  };

  const transferFunds = async () => {
    if (!transferAddress) {
      alert('Please enter a transfer address!');
      return;
    }

    try {
      const approvalsCount = await contract.approvalsCount();
      const memberCount = await contract.getMemberCount();

      if (approvalsCount !== memberCount) {
        alert('Not all members have approved!');
        return;
      }

      const tx = await contract.transferFunds(transferAddress);
      await tx.wait();
      alert('Funds transferred successfully!');
      resetTransaction();
    } catch (error) {
      console.error('Error transferring funds:', error);
    }
  };

  const resetTransaction = () => {
    setAmount('');
    setMembers([]);
    setApprovalStatus({});
    setApprovalsReceived(0);
    setTransferAddress('');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Member Fund Management</h1>
        {account ? (
          <div>
            <p>Connected Account: {account}</p>

            <div>
              <h2>Set Total Amount</h2>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount in Ether"
              />
              <button onClick={setTotalAmount}>Set Total Amount</button>
            </div>

            <div>
              <h2>Add Member</h2>
              <input
                type="text"
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                placeholder="Member Address"
              />
              <button onClick={addMember}>Add Member</button>
            </div>

            <div>
              <h2>Members</h2>
              <ul>
                {members.map((member, index) => (
                  <li key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{member}</span>
                    {!approvalStatus[member] ? (
                      <button onClick={approveTransaction}>Approve</button>
                    ) : (
                      <span style={{ color: 'green' }}> Approved</span>
                    )}
                  </li>
                ))}
              </ul>
              <p>Approvals received: {approvalsReceived}/{members.length}</p>
            </div>

            <div>
              <h2>Transfer Funds</h2>
              <input
                type="text"
                value={transferAddress}
                onChange={(e) => setTransferAddress(e.target.value)}
                placeholder="Transfer to Address"
              />
              <button onClick={transferFunds}>Transfer Funds</button>
            </div>
          </div>
        ) : (
          <button onClick={connectWallet}>Connect Wallet</button>
        )}
      </header>
    </div>
  );
};

export default App;
