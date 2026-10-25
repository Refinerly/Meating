import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { Plus, Trash2, Wallet, Receipt, TrendingDown, ShoppingCart, Image as ImageIcon } from 'lucide-react';

const DEFAULT_ACCOUNTS = ['Checking', 'Savings', 'Cash'];

export function Money() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Forms
  const [newBill, setNewBill] = useState({ name: '', amount: '', dueDate: '' });
  const [newExpense, setNewExpense] = useState({ name: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [newWishlist, setNewWishlist] = useState({ name: '', cost: '', imageUrl: '' });

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    try {
      setError('');
      // Fetch Accounts
      const [storedAccounts, billRows, expenseRows, wishRows] = await Promise.all([api.list<any>('accounts'), api.list('bills'), api.list('expenses'), api.list('wishlist')]);
      let accData = storedAccounts;
      if (accData.length === 0) accData = await Promise.all(DEFAULT_ACCOUNTS.map(name => api.create('accounts', { name, balance: 0 })));

      // Sort accounts to maintain consistent order
      accData.sort((a, b) => {
        const idxA = DEFAULT_ACCOUNTS.indexOf(a.name);
        const idxB = DEFAULT_ACCOUNTS.indexOf(b.name);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.name.localeCompare(b.name);
      });

      setAccounts(accData);

      // Fetch Bills
      setBills(billRows); setExpenses(expenseRows); setWishlist(wishRows);

    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load money data.');
    } finally {
      setLoading(false);
    }
  };

  const updateAccountBalance = async (id: string, newBalance: number) => {
    if (!user) return;
    try {
      await api.update('accounts', id, { balance: newBalance });
      setAccounts(accounts.map(a => a.id === id ? { ...a, balance: newBalance } : a));
    } catch (error) {
      console.error("Error updating balance", error);
    }
  };

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newBill.name || !newBill.amount || !newBill.dueDate) return;
    try {
      await api.create('bills', {
        name: newBill.name,
        amount: parseFloat(newBill.amount),
        dueDate: parseInt(newBill.dueDate),
        createdAt: new Date().toISOString()
      });
      setNewBill({ name: '', amount: '', dueDate: '' });
      fetchData();
    } catch (error) {
      console.error("Error adding bill", error);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newExpense.name || !newExpense.amount || !newExpense.date) return;
    try {
      await api.create('expenses', {
        name: newExpense.name,
        amount: parseFloat(newExpense.amount),
        date: newExpense.date,
        createdAt: new Date().toISOString()
      });
      setNewExpense({ name: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') });
      fetchData();
    } catch (error) {
      console.error("Error adding expense", error);
    }
  };

  const handleAddWishlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newWishlist.name || !newWishlist.cost) return;
    try {
      await api.create('wishlist', {
        name: newWishlist.name,
        cost: parseFloat(newWishlist.cost),
        imageUrl: newWishlist.imageUrl || '',
        createdAt: new Date().toISOString()
      });
      setNewWishlist({ name: '', cost: '', imageUrl: '' });
      fetchData();
    } catch (error) {
      console.error("Error adding wishlist item", error);
    }
  };

  const deleteItem = async (collectionName: string, id: string) => {
    if (!user) return;
    try {
      await api.remove(collectionName, id);
      fetchData();
    } catch (error) {
      console.error(`Error deleting ${collectionName}`, error);
    }
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  if (loading) {
    return <div className="animate-pulse h-96 bg-bg-card rounded-2xl border border-border-dark"></div>;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      {error && <p role="alert" className="text-red-400">{error}</p>}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Money</h1>
        <p className="text-zinc-400 mt-1">Manage your accounts, bills, and expenses</p>
      </header>

      {/* TOTAL BALANCE */}
      <div className="bg-gradient-to-br from-neon-green/20 to-bg-card border border-neon-green/30 p-8 rounded-3xl flex flex-col items-center justify-center text-center">
        <span className="text-neon-green font-bold tracking-wider uppercase text-sm mb-2 flex items-center gap-2">
          <Wallet className="w-4 h-4" /> Total Balance
        </span>
        <span className="text-5xl font-bold text-white">
          ┬ú{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ACCOUNTS */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-neon-green" /> Accounts
          </h2>
          <div className="space-y-3">
            {accounts.map(acc => (
              <div key={acc.id} className="bg-bg-card border border-border-dark p-4 rounded-2xl flex items-center justify-between">
                <span className="text-white font-medium">{acc.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">┬ú</span>
                  <input 
                    type="number" 
                    value={acc.balance}
                    onChange={(e) => updateAccountBalance(acc.id, parseFloat(e.target.value) || 0)}
                    className="bg-bg-dark border border-border-dark rounded-lg px-3 py-1 text-white w-24 text-right focus:outline-none focus:border-neon-green"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BILLS */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-neon-orange" /> Upcoming Bills
          </h2>
          <form onSubmit={handleAddBill} className="bg-bg-card border border-border-dark p-4 rounded-2xl flex flex-col gap-2">
            <input 
              type="text" placeholder="Bill Name" required
              value={newBill.name} onChange={e => setNewBill({...newBill, name: e.target.value})}
              className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-orange"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="number" placeholder="┬ú Amount" required step="0.01"
                value={newBill.amount} onChange={e => setNewBill({...newBill, amount: e.target.value})}
                className="flex-1 bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-orange"
              />
              <input 
                type="number" placeholder="Day (1-31)" required min="1" max="31"
                value={newBill.dueDate} onChange={e => setNewBill({...newBill, dueDate: e.target.value})}
                className="flex-1 bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-orange"
              />
              <button type="submit" className="bg-neon-orange text-black px-3 py-1.5 rounded-lg hover:bg-[#ff8533] transition-colors font-bold text-xs whitespace-nowrap">
                Add
              </button>
            </div>
          </form>
          <div className="space-y-3">
            {bills.map(bill => (
              <div key={bill.id} className="bg-bg-card border border-border-dark p-4 rounded-2xl flex items-center justify-between group">
                <div>
                  <span className="text-white font-medium block">{bill.name}</span>
                  <span className="text-xs text-neon-orange">Due on the {bill.dueDate}{
                    bill.dueDate === 1 || bill.dueDate === 21 || bill.dueDate === 31 ? 'st' :
                    bill.dueDate === 2 || bill.dueDate === 22 ? 'nd' :
                    bill.dueDate === 3 || bill.dueDate === 23 ? 'rd' : 'th'
                  }</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-white font-bold">┬ú{bill.amount.toFixed(2)}</span>
                  <button onClick={() => deleteItem('bills', bill.id)} className="text-zinc-600 hover:text-neon-orange opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {bills.length === 0 && <p className="text-zinc-500 text-sm text-center py-4">No bills added.</p>}
          </div>
        </section>

        {/* EXPENSES */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-neon-cyan" /> Upcoming Expenses
          </h2>
          <form onSubmit={handleAddExpense} className="bg-bg-card border border-border-dark p-4 rounded-2xl flex flex-col gap-2">
            <input 
              type="text" placeholder="Expense Name" required
              value={newExpense.name} onChange={e => setNewExpense({...newExpense, name: e.target.value})}
              className="w-full bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-cyan"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="number" placeholder="┬ú Amount" required step="0.01"
                value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                className="flex-1 bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-cyan"
              />
              <input 
                type="date" required
                value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                className="flex-1 bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-cyan"
              />
              <button type="submit" className="bg-neon-cyan text-black px-3 py-1.5 rounded-lg hover:bg-[#2eebe0] transition-colors font-bold text-xs whitespace-nowrap">
                Add
              </button>
            </div>
          </form>
          <div className="space-y-3">
            {expenses.map(exp => (
              <div key={exp.id} className="bg-bg-card border border-border-dark p-4 rounded-2xl flex items-center justify-between group">
                <div>
                  <span className="text-white font-medium block">{exp.name}</span>
                  <span className="text-xs text-neon-cyan">{exp.date}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-white font-bold">┬ú{exp.amount.toFixed(2)}</span>
                  <button onClick={() => deleteItem('expenses', exp.id)} className="text-zinc-600 hover:text-neon-orange opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {expenses.length === 0 && <p className="text-zinc-500 text-sm text-center py-4">No upcoming expenses.</p>}
          </div>
        </section>

        {/* THINGS TO BUY */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-neon-purple" /> Things To Buy
          </h2>
          <form onSubmit={handleAddWishlist} className="bg-bg-card border border-border-dark p-4 rounded-2xl flex flex-col gap-2">
            <div className="flex gap-2">
              <input 
                type="text" placeholder="Item Name" required
                value={newWishlist.name} onChange={e => setNewWishlist({...newWishlist, name: e.target.value})}
                className="flex-1 bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-purple"
              />
              <input 
                type="number" placeholder="┬ú Cost" required step="0.01"
                value={newWishlist.cost} onChange={e => setNewWishlist({...newWishlist, cost: e.target.value})}
                className="w-24 bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-purple"
              />
            </div>
            <div className="flex gap-2">
              <input 
                type="url" placeholder="Image URL (optional)"
                value={newWishlist.imageUrl} onChange={e => setNewWishlist({...newWishlist, imageUrl: e.target.value})}
                className="flex-1 bg-bg-dark border border-border-dark rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-purple"
              />
              <button type="submit" className="bg-neon-purple text-white px-3 py-1.5 rounded-lg hover:bg-[#a64dff] transition-colors font-bold text-xs whitespace-nowrap">
                Add
              </button>
            </div>
          </form>
          <div className="grid grid-cols-2 gap-4">
            {wishlist.map(item => (
              <div key={item.id} className="bg-bg-card border border-border-dark rounded-2xl overflow-hidden group relative">
                <button onClick={() => deleteItem('wishlist', item.id)} className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white hover:text-neon-orange opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="h-32 bg-bg-dark flex items-center justify-center relative">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-zinc-600" />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                    <span className="text-white font-bold block truncate">{item.name}</span>
                    <span className="text-neon-purple text-sm font-bold">┬ú{item.cost.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {wishlist.length === 0 && <p className="text-zinc-500 text-sm text-center py-4">No items in wishlist.</p>}
        </section>
      </div>
    </motion.div>
  );
}
