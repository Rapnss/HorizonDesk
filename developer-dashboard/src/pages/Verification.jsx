import { useState } from 'react';
import { ShieldCheck, Upload, Clock, CheckCircle, AlertCircle, User, Globe, Twitter, Github } from 'lucide-react';

export default function Verification() {
  const [form, setForm] = useState({ full_name: '', website: '', twitter: '', github: '', reason: '' });
  const [idFile, setIdFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.full_name || !form.reason) {
      setError('Full name and reason are required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      if (idFile) body.append('id_document', idFile);
      
      const res = await fetch('https://horizon-online.api-rapnss.workers.dev/api/developer/verify', {
        method: 'POST',
        body,
      });
      if (!res.ok) throw new Error('Submission failed. Please try again later.');
      setSubmitted(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="page-content">
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <Clock size={64} style={{ color: '#f59e0b', margin: '0 auto 20px auto', display: 'block' }} />
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Verification Under Review</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto' }}>
            Your developer verification request has been submitted. The Rapnss team will review it within 2–5 business days. You'll receive an email once approved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-left">
          <ShieldCheck size={28} className="page-header-icon" />
          <div>
            <h1 className="page-title">Developer Verification</h1>
            <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
              Verify your identity to unlock paid plugins, ad campaigns, and a trusted badge
            </p>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { icon: <CheckCircle size={20} style={{ color: '#10b981' }} />, title: 'Verified Badge', desc: 'A shield badge appears on all your plugins in the store.' },
          { icon: <ShieldCheck size={20} style={{ color: '#3b82f6' }} />, title: 'Paid Plugins', desc: 'Unlock monetization — charge monthly or one-time via Gumroad.' },
          { icon: <CheckCircle size={20} style={{ color: '#f59e0b' }} />, title: 'Ad Campaigns', desc: 'Run sponsored ads in the Plugin Store with full metrics.' },
        ].map((b, i) => (
          <div key={i} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 16 }}>
            {b.icon}
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{b.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{b.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Verification Request Form</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Full Legal Name *</label>
            <input value={form.full_name} onChange={e => handleChange('full_name', e.target.value)}
              placeholder="As on your government ID"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}><Globe size={13} style={{ verticalAlign: -2 }} /> Website / Portfolio</label>
              <input value={form.website} onChange={e => handleChange('website', e.target.value)}
                placeholder="https://yoursite.com"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}><Github size={13} style={{ verticalAlign: -2 }} /> GitHub Username</label>
              <input value={form.github} onChange={e => handleChange('github', e.target.value)}
                placeholder="@username"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Why do you want verification? *</label>
            <textarea value={form.reason} onChange={e => handleChange('reason', e.target.value)}
              placeholder="Briefly describe your work, your plugins, and why you need a verified account..."
              rows={4}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 14, outline: 'none', resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Government ID (optional but speeds up review)</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer', background: 'var(--bg-secondary)' }}>
              <Upload size={16} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{idFile ? idFile.name : 'Upload ID, passport, or driver\'s license (PDF/PNG)'}</span>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setIdFile(e.target.files[0])} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', fontWeight: 600, marginTop: 16, display: 'flex', gap: 6, alignItems: 'center' }}><AlertCircle size={16} />{error}</div>}

        <button className="btn-primary" disabled={submitting} onClick={handleSubmit} style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} />
          {submitting ? 'Submitting...' : 'Submit Verification Request'}
        </button>
      </div>
    </div>
  );
}
