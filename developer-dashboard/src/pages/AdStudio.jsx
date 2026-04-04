import { useState } from 'react';
import { Megaphone, Image as ImageIcon, CheckCircle, Info, AlertCircle, ExternalLink, Zap, Globe, CreditCard, Wallet } from 'lucide-react';

const PLANS = [
  { id: 'starter', label: 'Starter Boost', duration: '7 Days', impressions: '5,000', price: 5, gumroad_url: 'https://gumroad.com/l/horizon-ad-starter' },
  { id: 'growth',  label: 'Growth Blast',  duration: '14 Days', impressions: '15,000', price: 12, gumroad_url: 'https://gumroad.com/l/horizon-ad-growth' },
  { id: 'premium', label: 'Premium Rocket', duration: '30 Days', impressions: '40,000', price: 25, gumroad_url: 'https://gumroad.com/l/horizon-ad-premium' },
];

const PROVIDERS = [
  // Bitcoin Priority
  { id: 'changenow', label: 'Bitcoin (via ChangeNow)', icon: <Wallet size={18} />, type: 'BTC', priority: true },
  { id: 'bitnovo', label: 'Bitcoin (via Bitnovo)', icon: <Wallet size={18} />, type: 'BTC', priority: true },
  { id: 'upi', label: 'UPI (India Only)', icon: <Zap size={18} color="#10b981" />, type: 'Fiat', priority: true },
  // Fiat / Cards / Apple / Google
  { id: 'stripe', label: 'Cards / Apple / Google (Stripe)', icon: <CreditCard size={18} />, type: 'Fiat' },
  { id: 'wert', label: 'Apple Pay / Cards (Wert)', icon: <CreditCard size={18} />, type: 'Fiat' },
  { id: 'transak', label: 'Google Pay / Cards (Transak)', icon: <Globe size={18} />, type: 'Global' },
  { id: 'mercuryo', label: 'Global Cards (Mercuryo)', icon: <Globe size={18} />, type: 'Global' },
  { id: 'moonpay', label: 'MoonPay (Global)', icon: <Globe size={18} />, type: 'Global' },
];

export default function AdStudio({ plugin }) {
  const [step, setStep] = useState(1); // 1=creative, 2=plan, 3=payment, 4=success
  const [adImage, setAdImage] = useState(null);
  const [adImagePreview, setAdImagePreview] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState('changenow');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    img.onload = () => {
      const ratio = img.width / img.height;
      if (Math.abs(ratio - 16 / 9) > 0.05) {
        setError(`Image must be 16:9 ratio. Yours is ${img.width}x${img.height}.`);
        URL.revokeObjectURL(url);
      } else {
        setError('');
        setAdImage(file);
        setAdImagePreview(url);
      }
    };
  };

  const handleGumroadPayment = async () => {
    if (!selectedPlan || !email || !adImage) {
      setError('Please fill in all details.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // Notify backend
      await fetch('https://horizon-online.api-rapnss.workers.dev/api/ads/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plugin_name: plugin?.name || 'unknown',
          plan: selectedPlan.id,
          provider: 'gumroad',
          email: email
        }),
      });

      const gumroadUrl = selectedPlan.gumroad_url;
      const finalUrl = gumroadUrl.includes('?') ? `${gumroadUrl}&a=9567637` : `${gumroadUrl}?a=9567637`;

      if (window.pywebview?.api?.open_payment_window) {
        // Open in professional in-app popup (frameless)
        await window.pywebview.api.open_payment_window(finalUrl);
        setStep(4);
      } else {
        // Fallback for standalone browser
        window.open(finalUrl, '_blank');
        setStep(4);
      }
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-left">
          <Megaphone size={28} className="page-header-icon" />
          <div>
            <h1 className="page-title">Advertisement Studio</h1>
            <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
              Promote your plugin in the Horizon Desk Plugin Store
            </p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32, paddingTop: 8 }}>
        {[{ n: 1, label: 'Creative' }, { n: 2, label: 'Plan' }, { n: 3, label: 'Payment' }, { n: 4, label: 'Live!' }].map((s, i, arr) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < arr.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: step >= s.n ? 'var(--accent)' : 'var(--border-light)', color: step >= s.n ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                {step > s.n ? <CheckCircle size={18} /> : s.n}
              </div>
              <span style={{ fontSize: 11, color: step >= s.n ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: step === s.n ? 700 : 500 }}>{s.label}</span>
            </div>
            {i < arr.length - 1 && <div style={{ flex: 1, height: 2, background: step > s.n ? 'var(--primary)' : 'var(--border)', margin: '0 8px', marginBottom: 20 }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="card">
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Ad Creative (16:9)</h2>
          <label style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer', background: 'var(--bg)' }}>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            {adImagePreview ? <img src={adImagePreview} style={{ maxWidth: '100%', borderRadius: 8 }} /> : <ImageIcon size={48} />}
          </label>
          {error && <div style={{ color: '#ef4444', marginTop: 12 }}>{error}</div>}
          <button className="btn-primary" disabled={!adImage} onClick={() => setStep(2)} style={{ marginTop: 24 }}>Next</button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Select Plan</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {PLANS.map(plan => (
              <div key={plan.id} onClick={() => setSelectedPlan(plan)} style={{ border: selectedPlan?.id === plan.id ? '2px solid var(--accent)' : '1px solid var(--border)', borderRadius: 12, padding: 20, cursor: 'pointer', background: 'var(--surface)', color: 'var(--text)' }}>
                <div style={{ fontWeight: 700 }}>{plan.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>${plan.price}</div>
              </div>
            ))}
          </div>
          <button className="btn-primary" disabled={!selectedPlan} onClick={() => setStep(3)}>Next</button>
        </div>
      )}

      {step === 3 && selectedPlan && (
        <div className="card">
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Checkout via Gumroad</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 16 }}>
            <input type="email" placeholder="Your Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />

            <div style={{ background: 'var(--bg)', padding: 15, borderRadius: 10, fontSize: 13, color: 'var(--text-muted)', borderLeft: '4px solid #3b82f6' }}>
              <Info size={16} style={{ marginRight: 8, color: '#3b82f6' }} />
              Ad campaigns are handled through Gumroad. Your boost will start immediately after purchase verification.
            </div>
          </div>

          {error && <div style={{ color: '#ef4444', marginTop: 16 }}>{error}</div>}
          <button className="btn-primary" disabled={submitting} onClick={handleGumroadPayment} style={{ marginTop: 24, width: '100%' }}>
            {submitting ? 'Connecting...' : `Buy ${selectedPlan.label} ($${selectedPlan.price})`}
          </button>
        </div>
      )}
    </div>
  );
}
