
import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, Minus, Plus, Search, X,
  UtensilsCrossed, ArrowRight, ChefHat, Coffee,
  Moon, Sun, ChevronLeft, Receipt, CheckCircle2,
  ShieldCheck, AlertCircle, Loader2, Lock, ShieldAlert,
  Phone, CreditCard, ExternalLink, Star, Heart, Clock
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  isVeg?: boolean;
  image?: string;
  rating?: number;
  time?: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  instructions: string;
}

const MENU_DATA: MenuItem[] = [
  // Breakfast
  { id: '1', name: 'Masala Omelette', price: 240, description: 'Three eggs, onions, tomatoes, green chilies, served with toast.', category: 'Breakfast', isVeg: false, rating: 4.8, time: '15 min' },
  { id: '2', name: 'Aloo Paratha', price: 200, description: 'Two stuffed parathas with fresh butter, curd and pickle.', category: 'Breakfast', isVeg: true, rating: 4.5, time: '20 min' },
  { id: '3', name: 'Pancakes Stack', price: 320, description: 'Fluffy pancakes with maple syrup and whipped cream.', category: 'Breakfast', isVeg: true, rating: 4.9, time: '15 min' },

  // Lunch / Main Course
  { id: '4', name: 'Butter Chicken', price: 450, description: 'Charcoal grilled chicken in rich, creamy tomato gravy.', category: 'Main Course', isVeg: false, rating: 4.9, time: '25 min' },
  { id: '5', name: 'Paneer Tikka Masala', price: 380, description: 'Grilled cottage cheese cubes in spicy onion-tomato gravy.', category: 'Main Course', isVeg: true, rating: 4.7, time: '20 min' },
  { id: '6', name: 'Dal Makhani', price: 320, description: 'Black lentils slow-cooked overnight with cream and butter.', category: 'Main Course', isVeg: true, rating: 4.8, time: '30 min' },

  // Snacks & Beverages
  { id: '7', name: 'Club Sandwich', price: 280, description: 'Triple-decker with grilled chicken, egg, lettuce, and cheese.', category: 'Snacks', isVeg: false, rating: 4.6, time: '15 min' },
  { id: '8', name: 'Cold Coffee with Ice Cream', price: 180, description: 'Rich blended coffee topped with vanilla ice cream.', category: 'Snacks', isVeg: true, rating: 4.7, time: '10 min' },
  { id: '9', name: 'Hakka Noodles', price: 260, description: 'Wok-tossed noodles with garden fresh vegetables.', category: 'Snacks', isVeg: true, rating: 4.5, time: '15 min' },
];

const CATEGORIES = ['All', 'Breakfast', 'Main Course', 'Snacks'];

interface GuestMenuProps {
  roomNumber: string;
  onValidateGuest?: (room: string, lastName: string) => Promise<string | null>;
  onPlaceOrder?: (room: string, items: { name: string, price: number }[]) => void;
  onSecurityAlert?: (room: string) => void;
}

const GuestMenu: React.FC<GuestMenuProps> = ({ roomNumber, onValidateGuest, onPlaceOrder, onSecurityAlert }) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Verification Gate State
  const [lastName, setLastName] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Security Lockout Logic
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (roomNumber) {
      localStorage.setItem('guest_room_identity', roomNumber);
      const lockKey = `lockout_room_${roomNumber}`;
      if (localStorage.getItem(lockKey) === 'true') {
        setIsLocked(true);
      }
    }
  }, [roomNumber]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1, instructions: '' }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const updateInstructions = (id: string, text: string) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, instructions: text } : item));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredItems = MENU_DATA.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleProcessOrder = async () => {
    if (isLocked) return;
    setValidationError(null);
    if (!lastName) {
      setValidationError("Primary Guest last name is required for verification.");
      return;
    }
    setIsValidating(true);

    try {
      let token = null;
      if (onValidateGuest) {
        token = await onValidateGuest(roomNumber, lastName);
      }

      if (token === "LOCKED") {
        setIsLocked(true);
        localStorage.setItem(`lockout_room_${roomNumber}`, 'true');
        setValidationError("Security Alert: This room has been locked for digital services.");
      } else if (token) {
        setSessionToken(token);
        if (onPlaceOrder) {
          // Pass individual items with their quantities plus a 5% service charge
          const items = cart.map(i => ({ name: i.name, price: i.price * i.quantity }));
          const subtotal = items.reduce((sum, i) => sum + i.price, 0);
          const serviceCharge = Math.round(subtotal * 0.05);
          if (serviceCharge > 0) {
            items.push({ name: 'Service Charge (5%)', price: serviceCharge });
          }
          onPlaceOrder(roomNumber, items);
        }
        setOrderPlaced(true);
        setAttempts(0);
      } else {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        if (nextAttempts >= 3) {
          setIsLocked(true);
          localStorage.setItem(`lockout_room_${roomNumber}`, 'true');
          onSecurityAlert?.(roomNumber);
          setValidationError("Maximum verification attempts reached.");
        } else {
          setValidationError(`Identity mismatch. ${3 - nextAttempts} attempts remaining.`);
        }
      }
    } catch (error) {
      setValidationError("Connection timeout. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleCallFrontDesk = () => {
    window.location.href = 'tel:100'; // Standard extension
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-xl border-4 border-white">
          <CheckCircle2 className="w-12 h-12 text-emerald-600" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-2">Order Confirmed!</h2>
        <p className="text-slate-500 mb-8 max-w-xs">Verified session for <span className="font-bold text-indigo-600 underline">Room {roomNumber}</span>. Your order is being prepared.</p>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-sm">
          <div className="flex justify-between items-center mb-6 pb-6 border-b border-dashed border-slate-200">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Added to Room Folio</span>
            <span className="text-2xl font-black text-slate-900">₹{Math.round(cartTotal * 1.05)}</span>
          </div>
          <button
            onClick={() => { setOrderPlaced(false); setCart([]); setIsCartOpen(false); setLastName(''); setSessionToken(null); }}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-black transition-all"
          >
            Order More
          </button>
        </div>
        <p className="text-[10px] font-black text-slate-300 mt-12 uppercase tracking-[0.3em]">SyncGuard Smart Concierge</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-inter pb-32">
      {/* Premium Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl px-6 pt-8 pb-6 border-b border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Concierge</p>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Room {roomNumber}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCallFrontDesk} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all">
              <Phone className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`
                px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-2
                ${activeCategory === cat
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100'
                  : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'}
              `}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <main className="px-6 py-8 space-y-8 max-w-2xl mx-auto">
        {/* Search & Promotions */}
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-[1.5rem] text-sm font-bold text-slate-900 outline-none focus:border-indigo-100 focus:bg-white transition-all placeholder:text-slate-300"
            />
          </div>

          <div
            className="p-6 rounded-[2rem] shadow-xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: '#ffffff'
            }}
          >
            <div className="relative z-10">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ opacity: 0.8 }}>Guest Special</span>
              <h3 className="text-xl font-black mt-1">20% OFF on Beverages</h3>
              <p className="text-xs font-medium mt-1" style={{ opacity: 0.8 }}>Use while checking out today!</p>
            </div>
            <div className="absolute top-0 right-0 p-4" style={{ opacity: 0.1 }}>
              <ChefHat className="w-24 h-24" />
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 gap-6">
          {filteredItems.map(item => {
            const inCart = cart.find(i => i.id === item.id);
            return (
              <div key={item.id} className="group bg-white rounded-[2rem] border border-slate-100 p-5 flex gap-5 hover:border-indigo-200 hover:shadow-xl hover:shadow-slate-100 transition-all duration-300 animate-in slide-in-from-bottom-4">
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full border ${item.isVeg ? 'bg-emerald-500 border-emerald-200' : 'bg-rose-500 border-rose-200'}`}></div>
                        <h3 className="font-black text-slate-900 tracking-tight">{item.name}</h3>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="w-3 h-3 fill-amber-500" />
                        <span className="text-[10px] font-black">{item.rating}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 pr-4">{item.description}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Price</span>
                      <span className="font-black text-lg text-slate-900">₹{item.price}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1 mr-2"><Clock className="w-3 h-3" /> {item.time}</span>
                      {inCart ? (
                        <div className="flex items-center bg-slate-900 text-white rounded-xl px-1 py-1 shadow-lg">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-2 hover:bg-white/20 rounded-lg transition-colors"><Minus className="w-4 h-4" /></button>
                          <span className="w-8 text-center text-sm font-black">{inCart.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-2 hover:bg-white/20 rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          className="px-6 py-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-indigo-100/50"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Persistent Cart Button */}
      {cartCount > 0 && (
        <div className="fixed bottom-8 left-6 right-6 max-w-lg mx-auto z-40 transform animate-in slide-in-from-bottom-8 duration-500">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-slate-900 text-white p-5 rounded-[2.5rem] shadow-2xl flex items-center justify-between hover:scale-[1.02] active:scale-[0.98] transition-all group overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:rotate-12 transition-transform">
              <ShoppingBag className="w-12 h-12" />
            </div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="bg-indigo-600 w-10 h-10 flex border-2 border-indigo-400 items-center justify-center rounded-2xl text-xs font-black shadow-lg shadow-indigo-900/40">{cartCount}</div>
              <span className="text-sm font-black uppercase tracking-widest">Review Selections</span>
            </div>
            <div className="flex items-center gap-3 font-black text-lg relative z-10 pr-2 italic">
              ₹{cartTotal} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      )}

      {/* Security Overlays */}
      {isLocked && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6 text-white animate-in fade-in duration-500">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-[3.5rem] p-10 flex flex-col items-center text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] space-y-10">
            <div className="w-24 h-24 bg-rose-600/20 rounded-full flex items-center justify-center border-4 border-rose-500/20 relative">
              <Lock className="w-12 h-12 text-rose-500 animate-pulse" />
              <div className="absolute inset-0 bg-rose-500/10 rounded-full animate-ping"></div>
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl font-black tracking-tighter uppercase leading-tight italic">Digital Access Suspened</h2>
              <p className="text-slate-400 text-xs font-bold leading-relaxed px-4 opacity-80 uppercase tracking-widest">
                Manual verification required for Room {roomNumber}.
              </p>
            </div>

            <div className="w-full space-y-4">
              <button
                onClick={handleCallFrontDesk}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-600/40 active:scale-95"
              >
                <Phone className="w-4 h-4" />
                Connect to Front Desk
              </button>
            </div>

            <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-800 px-4 py-2 rounded-full border border-slate-700">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              Identity Lockdown Active
            </div>
          </div>
        </div>
      )}

      {/* Cart & Verification Modal */}
      {isCartOpen && !isLocked && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-500">
            <div className="p-8 pb-4 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter">My Selection</h2>
                <p className="text-xs font-black text-slate-300 uppercase tracking-widest mt-1">Room {roomNumber} Portal</p>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-3 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>

            <div className="p-8 pt-4 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
              <div className="space-y-6">
                {cart.map(item => (
                  <div key={item.id} className="flex gap-5 group">
                    <div className="flex flex-col items-center gap-2 bg-slate-50 p-1.5 rounded-2xl h-fit border border-slate-100">
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 bg-white text-slate-900 rounded-xl shadow-sm hover:scale-110 transition-transform"><Plus className="w-3.5 h-3.5" /></button>
                      <span className="text-xs font-black text-slate-900">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 bg-white text-slate-900 rounded-xl shadow-sm hover:scale-110 transition-transform"><Minus className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex justify-between items-start">
                        <h4 className="font-black text-slate-900 text-sm tracking-tight">{item.name}</h4>
                        <span className="font-black text-slate-900 text-sm">₹{item.price * item.quantity}</span>
                      </div>
                      <div className="mt-2 relative">
                        <input
                          type="text"
                          placeholder="Any special requests? (No onions, spicy...)"
                          value={item.instructions}
                          onChange={(e) => updateInstructions(item.id, e.target.value)}
                          className="w-full text-[10px] font-bold border-b border-slate-100 py-2 focus:border-indigo-400 outline-none bg-transparent placeholder:text-slate-300 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 pt-4 border-t border-slate-100 bg-slate-50/50 rounded-b-[3rem] space-y-6 shrink-0">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <span>Subtotal Items</span>
                  <span className="text-slate-900">₹{cartTotal}</span>
                </div>
                <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-2xl">
                  <span className="font-black text-xs uppercase tracking-widest text-indigo-400">Total Billable</span>
                  <span className="font-black text-xl text-indigo-600">₹{Math.round(cartTotal * 1.05)}</span>
                </div>
              </div>

              {/* VERIFICATION SECTION */}
              <div className={`p-6 bg-white border-2 rounded-[2rem] space-y-5 shadow-sm transition-all ${attempts > 0 ? 'border-rose-100 bg-rose-50/20' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`w-4 h-4 ${attempts > 0 ? 'text-rose-400' : 'text-emerald-500'}`} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Identity Check</span>
                  </div>
                  {attempts > 0 && (
                    <span className="text-[10px] font-black text-rose-500 uppercase">
                      Attempt {attempts}/3
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 block ml-1 uppercase pr-4">Primary Guest Last Name</label>
                  <input
                    type="text"
                    placeholder="Enter Surname (e.g. Chopra)"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isValidating}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-sm font-black text-slate-900 outline-none focus:border-indigo-200 focus:bg-white transition-all placeholder:text-slate-300"
                  />
                </div>
                {validationError && (
                  <div className="flex items-start gap-3 text-rose-600 p-4 bg-rose-50 rounded-2xl border border-rose-100 animate-in shake">
                    <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-xs font-black leading-tight">{validationError}</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleProcessOrder}
                disabled={isValidating || !lastName || cartCount === 0}
                className="w-full py-5 bg-slate-900 hover:bg-black text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.25em] shadow-2xl transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-3"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    Process Order
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
              <p className="text-[9px] text-center text-slate-300 font-bold uppercase tracking-[0.3em]">Encrypted Folio Pipeline Active</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestMenu;
