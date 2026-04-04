import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { ShoppingBag, Save, Image, ChevronDown, Upload, X, Plus, Package, Zap } from 'lucide-react';

const TIGRIS_UPLOADER = 'https://sufy-uploader.api-rapnss.workers.dev/tigris-upload';

async function uploadToTigris(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('filename', file.name);
    const res = await fetch(TIGRIS_UPLOADER, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Upload failed');
    return (await res.json()).url;
}

const CATEGORIES = ['general', 'developer', 'media', 'productivity', 'ai', 'data', 'automation'];

export default function StoreListing() {
    const { developerInfo, user, refreshDeveloperInfo, API_BASE } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedId, setSelectedId] = useState(searchParams.get('id') || '');
    const [form, setForm] = useState({ name: '', description: '', fullDescription: '', category: 'general', version: '' });
    const [iconPreview, setIconPreview] = useState(null);
    const [iconFile, setIconFile] = useState(null);
    const [screenshots, setScreenshots] = useState([]);
    const [uploadingScreenshots, setUploadingScreenshots] = useState(false);
    
    // Release update states
    const [updateFile, setUpdateFile] = useState(null);
    const [updateVersion, setUpdateVersion] = useState('');
    const [releasing, setReleasing] = useState(false);

    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState('');
    const iconRef = useRef();
    const screenshotRef = useRef();
    const releaseRef = useRef();

    useEffect(() => { if (user?.id) refreshDeveloperInfo(user.id); }, [user]);

    const plugins = developerInfo?.plugins || [];
    const selected = plugins.find(p => p.id === selectedId);

    useEffect(() => {
        if (selected) {
            setForm({
                name: selected.name || '',
                description: selected.description || '',
                fullDescription: selected.full_description || '',
                category: selected.category || 'general',
                version: selected.version || '1.0.0'
            });
            setIconPreview(selected.icon_url || null);
            setIconFile(null);
            try {
                const ss = selected.screenshots ? (typeof selected.screenshots === 'string' ? JSON.parse(selected.screenshots) : selected.screenshots) : [];
                setScreenshots(Array.isArray(ss) ? ss : []);
            } catch (e) {
                setScreenshots([]);
            }
            setUpdateVersion(selected.version || '1.0.0');
            setUpdateFile(null);
        }
    }, [selectedId, developerInfo]);

    const handleIconChange = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setIconFile(f);
        setIconPreview(URL.createObjectURL(f));
    };

    const handleAddScreenshot = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingScreenshots(true);
        try {
            const url = await uploadToTigris(file);
            setScreenshots([...screenshots, url]);
        } catch (e) {
            alert("Screenshot upload failed: " + e.message);
        } finally {
            setUploadingScreenshots(false);
        }
    };

    const removeScreenshot = (index) => {
        setScreenshots(screenshots.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!selectedId) return;
        setSaving(true);
        try {
            let iconUrl = undefined;
            if (iconFile) {
                iconUrl = await uploadToTigris(iconFile);
            }

            const res = await fetch(`${API_BASE}/api/dev/plugins/${selectedId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, iconUrl, screenshots })
            });
            const data = await res.json();
            if (data.success) {
                setFlash('Store listing updated successfully!');
                if (user?.id) refreshDeveloperInfo(user.id);
                setTimeout(() => setFlash(''), 3000);
            }
        } catch (e) {
            console.error('Save failed', e);
            alert("Save failed: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleReleaseUpdate = async () => {
        if (!updateFile || !updateVersion) return;
        setReleasing(true);
        try {
            const tigrisUrl = await uploadToTigris(updateFile);
            const res = await fetch(`${API_BASE}/api/dev/plugins/${selectedId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version: updateVersion, tigrisUrl })
            });
            const data = await res.json();
            if (data.success) {
                setFlash(`Released version ${updateVersion} successfully!`);
                setUpdateFile(null);
                if (user?.id) refreshDeveloperInfo(user.id);
                setTimeout(() => setFlash(''), 3000);
            }
        } catch (e) {
            alert("Release failed: " + e.message);
        } finally {
            setReleasing(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 400 }}>Store Listing</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Configure how your plugin appears in the Horizon Store</p>
            </div>

            {flash && <div className="banner-success">{flash}</div>}

            {/* Plugin Selector */}
            <div className="glass-panel" style={{ marginBottom: '24px' }}>
                <label className="input-label">Select plugin to edit</label>
                <div style={{ position: 'relative' }}>
                    <select className="input-field" value={selectedId} onChange={e => setSelectedId(e.target.value)}
                        style={{ appearance: 'none', paddingRight: '32px' }}>
                        <option value="">— Choose a plugin —</option>
                        {plugins.map(p => <option key={p.id} value={p.id}>{p.name} (v{p.version})</option>)}
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                </div>
            </div>

            {!selectedId ? (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '64px 24px' }}>
                    <ShoppingBag size={48} color="var(--border)" style={{ marginBottom: '16px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>Select a plugin above to edit its store listing.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        
                        {/* Listing Info Card */}
                        <div className="glass-panel">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                                <ShoppingBag size={18} color="var(--accent)" />
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 500 }}>Listing Details</h2>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
                                    <div>
                                        <label className="input-label">Plugin name</label>
                                        <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={60} />
                                    </div>
                                    <div>
                                        <label className="input-label">Version</label>
                                        <input className="input-field" value={form.version} disabled title="Update version in 'Release Update' section" style={{ opacity: 0.7 }} />
                                    </div>
                                </div>
                                <div>
                                    <label className="input-label">Short description (Store card tagline)</label>
                                    <input className="input-field" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={80} />
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{form.description.length}/80 characters</div>
                                </div>
                                <div>
                                    <label className="input-label">Full description (Store page info)</label>
                                    <textarea className="input-field" rows={6} value={form.fullDescription}
                                        onChange={e => setForm({ ...form, fullDescription: e.target.value })}
                                        placeholder="Detailed description of features, usage instructions..." />
                                </div>
                                <div>
                                    <label className="input-label">Category</label>
                                    <select className="input-field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Screenshots Card */}
                        <div className="glass-panel">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Image size={18} color="var(--accent)" />
                                    <h2 style={{ fontSize: '1.1rem', fontWeight: 500 }}>App Screenshots</h2>
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{screenshots.length}/5 images</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                                {screenshots.map((url, i) => (
                                    <div key={i} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '16/9', background: 'var(--bg-card)' }}>
                                        <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <button onClick={() => removeScreenshot(i)} className="btn-icon" style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px' }}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                                
                                {screenshots.length < 5 && (
                                    <div onClick={() => screenshotRef.current?.click()} style={{ 
                                        borderRadius: '12px', border: '2px dashed var(--border)', aspectRatio: '16/9', 
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', color: 'var(--text-muted)', gap: '4px', background: 'var(--bg-panel)',
                                        transition: 'all 0.2s',
                                        ':hover': { borderColor: 'var(--accent)', color: 'var(--accent)' }
                                    }}>
                                        <Plus size={24} />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Add Image</span>
                                        <input type="file" ref={screenshotRef} hidden accept="image/*" onChange={handleAddScreenshot} />
                                    </div>
                                )}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '16px' }}>Recommended: 1280×720 or higher. PNG/JPG files.</p>
                        </div>

                        {/* Update Release Card */}
                        <div className="glass-panel" style={{ border: '1px solid var(--accent-light)', background: 'rgba(16, 185, 129, 0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                                <Zap size={18} color="var(--accent)" />
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Release New Update</h2>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                                Upload a new `.raf` file to push an update to your users. 
                            </p>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '16px', alignItems: 'flex-end' }}>
                                <div>
                                    <label className="input-label">New Plugin File (.raf)</label>
                                    <div onClick={() => releaseRef.current?.click()} className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: 'var(--bg)', borderStyle: updateFile ? 'solid' : 'dashed' }}>
                                        <Upload size={16} />
                                        <span style={{ color: updateFile ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                            {updateFile ? updateFile.name : 'Select updated horizon-plugin.raf'}
                                        </span>
                                        <input type="file" ref={releaseRef} hidden accept=".raf,.py" onChange={e => setUpdateFile(e.target.files?.[0])} />
                                    </div>
                                </div>
                                <div>
                                    <label className="input-label">New Version</label>
                                    <input className="input-field" placeholder="1.0.1" value={updateVersion} onChange={e => setUpdateVersion(e.target.value)} />
                                </div>
                            </div>

                            <button className="btn-primary" onClick={handleReleaseUpdate} disabled={!updateFile || !updateVersion || releasing} style={{ marginTop: '24px', width: '100%', justifyContent: 'center', height: '44px' }}>
                                <Package size={18} />
                                <span>{releasing ? 'Uploading update...' : 'Publish Update'}</span>
                            </button>
                        </div>

                        <div style={{ height: '20px' }} />
                    </div>

                    {/* Right Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Icon Card */}
                        <div className="glass-panel">
                            <h2 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '16px' }}>Store Icon</h2>
                            <div style={{ width: '100%', aspectRatio: '1', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '16px' }}>
                                {iconPreview ? <img src={iconPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Image size={48} color="var(--border)" />}
                            </div>
                            <input type="file" ref={iconRef} accept="image/*" onChange={handleIconChange} style={{ display: 'none' }} />
                            <button className="btn-secondary" onClick={() => iconRef.current?.click()} style={{ width: '100%' }}>
                                {iconFile ? 'Change icon' : 'Upload icon'}
                            </button>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>512×512 PNG or JPG recommended. Max 1MB.</p>
                        </div>

                        {/* Status Card */}
                        <div className="glass-panel">
                            <h2 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '16px' }}>Status</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span className={`badge ${selected.status === 'published' ? 'success' : 'pending'}`} style={{ padding: '6px 12px', fontSize: '12px' }}>
                                    {selected.status === 'published' ? 'Live on Store' : 'Pending Review'}
                                </span>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.4 }}>
                                {selected.status === 'published' 
                                    ? 'Your plugin is visible to all Horizon Desk users.' 
                                    : 'Our team is currently reviewing your latest submission. This usually takes 24-48 hours.'}
                            </p>
                        </div>

                        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: '100%', height: '48px', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
                            <Save size={18} /> {saving ? 'Saving...' : 'Save All Changes'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
