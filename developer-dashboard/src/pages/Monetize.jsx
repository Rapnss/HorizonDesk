import { useState, useEffect } from 'react';
import { DollarSign, Wallet, CheckCircle, Info, AlertCircle, ShieldCheck, ChevronDown, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Monetize() {
  const { developerInfo, user, refreshDeveloperInfo } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get plugin name from query string
  const queryParams = new URLSearchParams(location.search);
  const initialPluginName = queryParams.get('plugin');

  const [selectedPluginName, setSelectedPluginName] = useState(initialPluginName || '');
  const [pricingModel, setPricingModel] = useState('free');
  const [price, setPrice] = useState('0');
  const [priceInr, setPriceInr] = useState('0');
  const [priceEur, setPriceEur] = useState('0');
  const [priceCad, setPriceCad] = useState('0');
  const [dynamicPricing, setDynamicPricing] = useState(false);
  const [gumroadUrl, setGumroadUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const plugins = developerInfo?.plugins || [];

  // If plugin is in URL, ensure we update state if it changes
  useEffect(() => {
    if (initialPluginName) {
      setSelectedPluginName(initialPluginName);
      const p = plugins.find(x => x.name === initialPluginName);
      if (p) {
        setPricingModel(p.pricing_model || 'free');
        setPrice(p.price || '0');
        setPriceInr(p.price_inr || '0');
        setPriceEur(p.price_eur || '0');
        setPriceCad(p.price_cad || '0');
        setDynamicPricing(!!p.dynamic_pricing);
        setGumroadUrl(p.gumroad_url || '');
      }
    }
  }, [initialPluginName, plugins.length]);

  const handleSave = async () => {
    if (!selectedPluginName) {
      setError('Please select a plugin to monetize.');
      return;
    }
    if (pricingModel !== 'free') {
      if (!gumroadUrl) {
        setError('Please enter a valid Gumroad product URL for paid plugins.');
        return;
      }
      if (!gumroadUrl.includes('gumroad.com')) {
        setError('URL must be a valid gumroad.com link.');
        return;
      }
    }
    
    setError('');
    setSaving(true);
    try {
      const plugin = plugins.find(p => p.name === selectedPluginName);
      const res = await fetch(`https://horizon-online.api-rapnss.workers.dev/api/dev/plugins/${plugin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pricing_model: pricingModel,
          price: parseFloat(price),
          price_inr: parseFloat(priceInr),
          price_eur: parseFloat(priceEur),
          price_cad: parseFloat(priceCad),
          dynamic_pricing: dynamicPricing ? 1 : 0,
          gumroad_url: gumroadUrl
        }),
      });
      if (!res.ok) throw new Error('Failed to save settings.');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <DollarSign size={28} className="page-header-icon" />
          <div>
            <h1 className="page-title">Plugin Monetization</h1>
            <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
              Set prices for your individual plugins (Free, One-Time, or Monthly)
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, padding: 16, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, marginBottom: 24, alignItems: 'center' }}>
        <ShieldCheck size={20} style={{ color: '#10b981' }} />
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          <strong>Gumroad Payments:</strong> All sales are processed via Gumroad. 100% of your listed price (minus Gumroad fees) goes to you.
        </div>
      </div>

      {/* Plugin Selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Select Plugin</h2>
        <div style={{ position: 'relative' }}>
          <select 
            value={selectedPluginName} 
            onChange={(e) => {
                setSelectedPluginName(e.target.value);
                navigate(`/monetize?plugin=${e.target.value}`);
            }}
            style={{ width: '100%', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', appearance: 'none', cursor: 'pointer' }}
          >
            <option value="">-- Choose a plugin to configure --</option>
            {plugins.map(p => (
              <option key={p.id} value={p.name}>{p.name} (v{p.version})</option>
            ))}
          </select>
          <ChevronDown size={18} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
        </div>
      </div>

      {selectedPluginName ? (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Pricing Model for {selectedPluginName}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              {[
                { id: 'free', label: 'Free', desc: 'No charge for users. Best for open-source or community tools.' },
                { id: 'one_time', label: 'One-Time Pay', desc: 'Users pay a single fee for lifetime access to this plugin.' },
                { id: 'subscription', label: 'Monthly Payment', desc: 'Recurring monthly revenue. Users must pay once a month to keep using it.' },
              ].map(opt => (
                <label key={opt.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: 16, border: pricingModel === opt.id ? '2px solid var(--accent)' : '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', background: pricingModel === opt.id ? 'var(--accent-light)' : 'var(--surface)', transition: 'all 0.2s' }}>
                  <input type="radio" value={opt.id} checked={pricingModel === opt.id} onChange={() => setPricingModel(opt.id)} style={{ marginTop: 3, accentColor: 'var(--primary)' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{opt.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {pricingModel !== 'free' && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Payment Setup</h2>
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>Gumroad Product URL</label>
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
                  <input 
                    placeholder="https://gumroad.com/l/your-product" 
                    value={gumroadUrl} 
                    onChange={e => setGumroadUrl(e.target.value)}
                    style={{ flex: 1, padding: 12, background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none', fontSize: 14 }} 
                  />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>This link will be opened in a secure in-app window when a user clicks "Buy".</p>
              </div>
            </div>
          )}

          {error && <div style={{ color: '#ef4444', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 8, fontSize: 14 }}><AlertCircle size={16} /> {error}</div>}

          <button className="btn-primary" disabled={saving} onClick={handleSave} style={{ height: 48, minWidth: 200, fontSize: 15 }}>
            {saved ? 'Settings Saved Successfully ✅' : saving ? 'Updating settings...' : 'Apply Monetization'}
          </button>
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Package size={48} strokeWidth={1} style={{ margin: '0 auto 20px auto', opacity: 0.5 }} />
          <h3 style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>No Plugin Selected</h3>
          <p style={{ fontSize: 14 }}>Select a plugin from the dropdown above to configure its monetization model.</p>
        </div>
      )}
    </div>
  );
}
