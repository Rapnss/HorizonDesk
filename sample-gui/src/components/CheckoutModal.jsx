import React, { useState } from 'react';
import { CreditCard, Smartphone, ShieldCheck, X } from 'lucide-react';

const CheckoutModal = ({ isOpen, onClose, plugin, userCountry, onConfirm }) => {
    const [provider, setProvider] = useState('card');
    
    if (!isOpen || !plugin) return null;

    const amount = plugin.price || 0;
    const currency = userCountry === 'India' ? 'INR' : 'USD';
    const displayPrice = userCountry === 'India' 
        ? `₹${plugin.price_inr > 0 ? plugin.price_inr : Math.round(amount * 83)}` 
        : `$${amount}`;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(20px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.3s ease'
        }}>
            <div className="checkout-card" style={{
                width: '360px', height: '640px',
                backgroundColor: '#fff', borderRadius: '25px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                padding: '24px', display: 'flex',
                flexDirection: 'column', justifyContent: 'space-between',
                position: 'relative',
                color: '#111'
            }}>
                {/* Close Button */}
                <button onClick={onClose} style={{
                    position: 'absolute', top: 20, right: 20,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#999'
                }}>
                    <X size={24} />
                </button>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                    <img 
                        src={plugin.icon_url || "https://images-rapnss.t3.tigrisfiles.io/512-icon-9.png"} 
                        alt="Logo" 
                        style={{ width: '66px', height: '66px', borderRadius: '15px' }} 
                    />
                </div>

                {/* Plugin Info */}
                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <h2 style={{ fontSize: '19px', fontWeight: 700 }}>{plugin.name}</h2>
                    <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '5px' }}>{displayPrice}</div>
                </div>

                {/* Payment Options */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <div 
                        onClick={() => setProvider('card')}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '12px',
                            border: '1px solid #eee', textAlign: 'center',
                            cursor: 'pointer', transition: '0.2s',
                            backgroundColor: provider === 'card' ? '#000' : '#fcfcfc',
                            color: provider === 'card' ? '#fff' : '#555'
                        }}
                    >
                        <CreditCard size={18} style={{ display: 'block', margin: '0 auto 5px auto' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Card</span>
                    </div>
                    <div 
                        onClick={() => setProvider('upi')}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '12px',
                            border: '1px solid #eee', textAlign: 'center',
                            cursor: 'pointer', transition: '0.2s',
                            backgroundColor: provider === 'upi' ? '#000' : '#fcfcfc',
                            color: provider === 'upi' ? '#fff' : '#555'
                        }}
                    >
                        <Smartphone size={18} style={{ display: 'block', margin: '0 auto 5px auto' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>UPI</span>
                    </div>
                </div>

                {/* Breakdown */}
                <div style={{
                    backgroundColor: '#f7f8fa', padding: '14px',
                    borderRadius: '12px', marginTop: '20px', fontSize: '13px',
                    border: '1px solid #f0f0f0'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#666' }}>
                        <span>Horizon Desk Fee</span>
                        <span>0%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#666' }}>
                        <span>Provider Fee</span>
                        <span>4%</span>
                    </div>
                    <div style={{ 
                        marginTop: '10px', paddingTop: '10px', 
                        borderTop: '1px dashed #ddd', fontWeight: 700, 
                        display: 'flex', justifyContent: 'space-between' 
                    }}>
                        <span>Developer Receives</span>
                        <span>96%</span>
                    </div>
                </div>

                {/* Pay Button */}
                <button 
                    onClick={() => onConfirm(provider)}
                    style={{
                        width: '100%', padding: '16px', borderRadius: '14px',
                        border: 'none', backgroundColor: '#000', color: '#fff',
                        fontSize: '16px', fontWeight: 600, cursor: 'pointer',
                        marginTop: '20px'
                    }}
                >
                    Continue to Payment
                </button>

                {/* Footer */}
                <div style={{ marginTop: 'auto' }}>
                    <div style={{ textAlign: 'center', fontSize: '11px', opacity: 0.7, fontWeight: 500 }}>
                        Powered by RiskPay • Horizon Desk Infra
                    </div>
                    <div style={{ 
                        fontSize: '10px', textAlign: 'center', opacity: 0.5,
                        marginTop: '8px', lineHeight: '1.4', padding: '0 10px'
                    }}>
                        This is a direct transfer between user and developer. Horizon Desk charges 0%. 
                        Infra provided by RiskPay.
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default CheckoutModal;
