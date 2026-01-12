
import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Minus, Plus, Search, X, 
  UtensilsCrossed, ArrowRight, ChefHat, Coffee, 
  Moon, Sun, ChevronLeft, Receipt, CheckCircle2,
  ShieldCheck, AlertCircle, Loader2, Lock, ShieldAlert,
  Phone, CreditCard, ExternalLink
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  isVeg?: boolean;
  image?: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  instructions: string;
}

const MENU_DATA: MenuItem[] = [
  { id: '1', name: 'Masala Omelette', price: 240, description: 'Three eggs, onions, tomatoes, green chilies, served with toast.', category: 'Breakfast', isVeg: false },
  { id: '2', name: 'Aloo Paratha', price: 200, description: 'Stuffed potato flatbread served with fresh curd and pickle.', category: 'Breakfast', isVeg: true },
  { id: '3', name: 'Pancakes Stack', price: 320, description: 'Fluffy pancakes with maple syrup and whipped cream.', category: 'Breakfast', isVeg: true },
  { id: '4', name: 'Butter Chicken', price: 450, description: 'Classic tandoori chicken in rich tomato gravy.', category: 'Lunch', isVeg: false },
  { id: '5', name: 'Paneer Tikka Masala', price: 380, description: 'Grilled cottage cheese cubes in spicy gravy.', category: 'Lunch', isVeg: true },
  { id: '6', name: 'Dal Makhani', price: 320, description: 'Black lentils slow-cooked overnight with cream and butter.', category: 'Lunch', isVeg: true },
  { id: '7', name: 'Club Sandwich', price: 280, description: 'Triple-decker sandwich with chicken, egg, lettuce, and cheese.', category: 'Dinner', isVeg: false },
  { id: '8', name: 'Veg Burger', price: 220, description: 'Crispy vegetable patty with cheese and house sauce.', category: 'Dinner', isVeg: true },
  { id: '9', name: 'Hakka Noodles', price: 260, description: 'Wok-tossed noodles with fresh vegetables.', category: 'Dinner', isVeg: true },
];

const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner'];

interface GuestMenuProps {
  roomNumber: string;
  onValidateGuest?: (room: string, lastName: string) => Promise<string | null>;
  onPlaceOrder?: (room: string, items: {name: string, price: number}[]) => void;
  onSecurityAlert?: (room: string) => void;
}

const GuestMenu: React.FC<GuestMenuProps> = ({ roomNumber, onValidateGuest, onPlaceOrder, onSecurityAlert }) => {
  const [activeCategory, setActiveCategory] = useState('Breakfast');
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
      
      // Check for persistent lockout on mount
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

  const filteredItems = MENU_DATA.filter(item => 
    item.category === activeCategory && 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProcessOrder = async () => {
    if (isLocked) return;

    setValidationError(null);
    if (!lastName) {
      setValidationError("Primary Guest last name is required.");
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
        setValidationError("Security Alert: This room has been locked by the hotel.");
      } else if (token) {
        setSessionToken(token);
        if (onPlaceOrder) {
          onPlaceOrder(roomNumber, cart.map(i => ({ name: i.name, price: i.price * i.quantity })));
        }
        setOrderPlaced(true);
        setAttempts(0); // Reset on success
      } else {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        
        if (nextAttempts >= 3) {
          setIsLocked(true);
          localStorage.setItem(`lockout_room_${roomNumber}`, 'true');
          // Signal back to PMS that this room is high risk
          onSecurityAlert?.(roomNumber);
          setValidationError("Maximum verification attempts reached.");
        } else {
          setValidationError(`Verification failed. ${3 - nextAttempts} attempts remaining.`);
        }
      }
    } catch (error) {
      setValidationError("Authentication server timeout. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleDirectPayment = () => {
    alert("Bypassing Folio Charge... Redirecting to Razorpay for immediate payment.");
  };

  const handleCallFrontDesk = () => {
    window.location.href = 'tel:0123456789';
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-sm border border-emerald-200">
          <CheckCircle2 className="w-12 h-12 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Order Authenticated!</h2>
        <p className="text-slate-500 mb-8 max-w-xs">Verified session for <span className="font-bold text-slate-800">Room {roomNumber}</span>. Kitchen is preparing your order.</p>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 w-full max-w-sm">
           <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Charged to Folio</span>
              <span className="text-xl font-black text-slate-900">₹{Math.round(cartTotal * 1.05)}</span>
           </div>
           <button 
             onClick={() => { setOrderPlaced(false); setCart([]); setIsCartOpen(false); setLastName(''); setSessionToken(null); }}
             className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-black transition-all"
           >
             Order More Items
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-inter pb-24 md:pb-0">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">In-Room Dining</p>
            <h1 className="text-lg font-black text-slate-900">Room {roomNumber}</h1>
          </div>
          <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
        </div>
        
        <div className="flex gap-4 mt-6 overflow-x-auto pb-2 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`
                px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all
                ${activeCategory === cat 
                  ? 'bg-slate-900 text-white shadow-lg' 
                  : 'bg-white border border-slate-200 text-slate-600'}
              `}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <main className="p-6 space-y-6 max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder={`Search ${activeCategory}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="space-y-4">
          {filteredItems.map(item => {
            const inCart = cart.find(i => i.id === item.id);
            return (
              <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-slate-900">{item.name}</h3>
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${item.isVeg ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{item.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-black text-slate-900">₹{item.price}</span>
                    
                    {inCart ? (
                      <div className="flex items-center bg-slate-900 text-white rounded-lg px-1">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-white/20 rounded"><Minus className="w-3 h-3" /></button>
                        <span className="w-6 text-center text-xs font-bold">{inCart.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 hover:bg-white/20 rounded"><Plus className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => addToCart(item)}
                        className="px-4 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-black uppercase tracking-wide transition-colors"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {cartCount > 0 && (
        <div className="fixed bottom-6 left-6 right-6 max-w-2xl mx-auto z-40">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 px-3 py-1 rounded-lg text-xs font-bold">{cartCount} items</div>
              <span className="text-sm font-medium">Checkout Order</span>
            </div>
            <div className="flex items-center gap-2 font-black">
              ₹{cartTotal} <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* SECURITY LOCKOUT POPUP */}
      {isLocked && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 text-white animate-in fade-in duration-500">
           <div className="bg-slate-800 border border-slate-700 w-full max-w-sm rounded-[3rem] p-10 flex flex-col items-center text-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-10 animate-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-red-600/20 rounded-full flex items-center justify-center border-4 border-red-500/30">
                 <Lock className="w-12 h-12 text-red-500 animate-pulse" />
              </div>
              <div className="space-y-4">
                 <h2 className="text-2xl font-black tracking-tight uppercase leading-tight">Maximum Attempts Reached</h2>
                 <p className="text-slate-400 text-sm font-medium leading-relaxed px-4">
                    For your security, automated verification for <span className="text-white font-bold underline underline-offset-4 decoration-red-500/50">Room {roomNumber}</span> has been suspended.
                 </p>
              </div>
              
              <div className="w-full space-y-4">
                 <button 
                   onClick={handleCallFrontDesk}
                   className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-600/20 active:scale-95"
                 >
                    <Phone className="w-5 h-5" />
                    Call Front Desk (Ext. 9)
                 </button>
                 <button 
                   onClick={handleDirectPayment}
                   className="w-full py-5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 border border-slate-600 active:scale-95"
                 >
                    <CreditCard className="w-5 h-5" />
                    Pay Directly (Bypass)
                 </button>
              </div>
              
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                 <ShieldAlert className="w-3.5 h-3.5" />
                 Encrypted Identity Safe
              </div>
           </div>
        </div>
      )}

      {isCartOpen && !isLocked && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-black text-slate-900">Guest Verification</h2>
              <button onClick={() => setIsCartOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
               <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex items-center gap-4">
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                    <Lock className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Assigned Unit</p>
                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Room {roomNumber}</p>
                  </div>
               </div>

               <div className="space-y-4">
                 <p className="text-xs font-bold text-slate-500 px-1">Verify Selections:</p>
                 {cart.map(item => (
                   <div key={item.id} className="flex gap-4 group">
                      <div className="flex flex-col items-center gap-1 bg-slate-50 p-1 rounded-lg h-fit border border-slate-100">
                         <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-white rounded transition-colors"><Plus className="w-3 h-3 text-slate-600" /></button>
                         <span className="text-xs font-black text-slate-900">{item.quantity}</span>
                         <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-white rounded transition-colors"><Minus className="w-3 h-3 text-slate-600" /></button>
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between mb-1">
                            <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                            <span className="font-bold text-slate-600 text-sm">₹{item.price * item.quantity}</span>
                         </div>
                         <input 
                           type="text" 
                           placeholder="Any instructions for the chef?"
                           value={item.instructions}
                           onChange={(e) => updateInstructions(item.id, e.target.value)}
                           className="w-full text-[11px] border-b border-slate-100 py-1 focus:border-indigo-500 outline-none bg-transparent placeholder:text-slate-300"
                         />
                      </div>
                   </div>
                 ))}
               </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-[2.5rem] space-y-4 shrink-0">
               <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900">₹{cartTotal}</span>
               </div>
               <div className="flex justify-between items-center text-lg pt-4 border-t border-slate-200">
                  <span className="font-black text-slate-900">Total Due</span>
                  <span className="font-black text-indigo-600">₹{Math.round(cartTotal * 1.05)}</span>
               </div>

               {/* VERIFICATION SECTION */}
               <div className={`p-5 bg-white border-2 rounded-[1.5rem] space-y-4 shadow-inner transition-all ${attempts > 0 ? 'border-amber-300 bg-amber-50/10' : 'border-slate-200'}`}>
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-800">
                      <ShieldCheck className={`w-4 h-4 ${attempts > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Identity Gate</span>
                    </div>
                    {attempts > 0 && (
                      <span className="text-[8px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-black uppercase">
                        Attempt {attempts}/3
                      </span>
                    )}
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 block ml-1 uppercase tracking-wider">Primary Guest Last Name</label>
                   <input 
                      type="text" 
                      placeholder="e.g. Malhotra"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={isValidating}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 transition-all placeholder:text-slate-300"
                   />
                 </div>
                 {validationError && (
                    <div className="flex items-start gap-2 text-red-600 p-3 bg-red-50 rounded-xl border border-red-100 animate-in shake duration-500">
                       <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                       <p className="text-[11px] font-bold leading-tight">{validationError}</p>
                    </div>
                 )}
               </div>

               <button 
                 onClick={handleProcessOrder}
                 disabled={isValidating || !lastName || cartCount === 0}
                 className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-[0.15em] shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-40 disabled:grayscale flex items-center justify-center gap-3"
               >
                 {isValidating ? (
                   <>
                     <Loader2 className="w-5 h-5 animate-spin" /> Verifying...
                   </>
                 ) : (
                   <>
                     Confirm & Order
                     <ArrowRight className="w-4 h-4" />
                   </>
                 )}
               </button>
               <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-wider">Zero-Trust Ordering Pipeline Active</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestMenu;
