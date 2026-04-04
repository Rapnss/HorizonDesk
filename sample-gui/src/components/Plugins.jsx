import React, { useState, useEffect } from 'react';
import { Search, Star, DownloadCloud, Zap, ChevronRight, Activity, Globe, Puzzle, ArrowRight, ShieldCheck, Download, Calendar, Mail, CheckCircle2 } from 'lucide-react';
import { usePostHog } from '@posthog/react';
import CheckoutModal from './CheckoutModal';

const PLATFORM_WALLET = '0xa031E2b68C9e4F4e87c377fE9AC7759c8F6aCD66';

const Plugins = () => {
    const posthog = usePostHog();
    const [installed, setInstalled] = useState([]);
    const [localPlugins, setLocalPlugins] = useState([]);
    const [plugins, setPlugins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [installing, setInstalling] = useState(null);
    const [error, setError] = useState(null);
    const [selectedPlugin, setSelectedPlugin] = useState(null);
    const [activeTab, setActiveTab] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [screenshotIndex, setScreenshotIndex] = useState(0);
    const [buying, setBuying] = useState(null);
    const [showCheckout, setShowCheckout] = useState(false);
    const [checkoutPlugin, setCheckoutPlugin] = useState(null);

    const trackEvent = async (pluginId, eventType, amount = 0, currency = 'USD') => {
        try {
            await fetch('https://horizon-online.api-rapnss.workers.dev/api/plugins/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pluginId, eventType, amount, currency })
            });
        } catch (e) { console.error("Tracking failed", e); }
    };
    const [userCountry, setUserCountry] = useState('United States');

    useEffect(() => {
        const fetchSettings = async () => {
            if (window.pywebview?.api?.get_settings) {
                const s = await window.pywebview.api.get_settings();
                if (s && s.country) setUserCountry(s.country);
            }
        };
        fetchSettings();
    }, []);

    const formatPrice = (p) => {
        if (p.pricing_model === 'free') return 'FREE';
        const usdPrice = p.price || 0;
        
        if (userCountry === 'India') {
            const inr = p.price_inr > 0 ? p.price_inr : Math.round(usdPrice * 83);
            return `₹${inr}`;
        }
        if (userCountry === 'Canada' && p.price_cad > 0) {
            return `C$${p.price_cad}`;
        }
        const euCountries = ['Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Sweden', 'Poland', 'Ireland'];
        if (euCountries.includes(userCountry) && p.price_eur > 0) {
            return `€${p.price_eur}`;
        }
        
        return `$${usdPrice}`;
    };

    useEffect(() => {
        const fetchLocalPlugins = async () => {
            try {
                if (window.pywebview && window.pywebview.api) {
                    const local = await window.pywebview.api.get_installed_plugins();
                    const localFormatted = (local || []).map(p => ({
                        ...p,
                        isLocal: true,
                        iconBg: '#10b981'
                    }));
                    setLocalPlugins(localFormatted);
                    setInstalled(localFormatted.map(p => p.name));
                }
            } catch (e) {
                console.error("Local plugins fetch error:", e);
            }
        };

        const fetchPlugins = async () => {
            try {
                const response = await fetch('https://horizon-online.api-rapnss.workers.dev/api/plugins');
                if (!response.ok) throw new Error('Failed to fetch plugins');
                const data = await response.json();
                
                const enriched = (data.plugins || []).map((p, i) => {
                    let screenshots = [];
                    try {
                        screenshots = p.screenshots ? (typeof p.screenshots === 'string' ? JSON.parse(p.screenshots) : p.screenshots) : [];
                    } catch (e) {
                        console.error("Failed to parse screenshots for", p.name, e);
                    }
                    return {
                        ...p, 
                        screenshots: Array.isArray(screenshots) ? screenshots : [],
                        iconBg: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'][i % 5]
                    };
                });
                
                setPlugins(enriched);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPlugins();
        if (window.pywebview) {
            fetchLocalPlugins();
        } else {
            window.addEventListener('pywebviewready', fetchLocalPlugins);
        }
    }, []);

    const DEMO_IMG = 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1000&auto=format&fit=crop';
    const AD_DEMO_IMG = 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000&auto=format&fit=crop';

    const featured = plugins.length > 0 ? plugins.slice(0, 3).map((p, i) => ({
        ...p,
        title: p.name,
        subtitle: p.description?.substring(0, 40) + '...',
        category: p.category || 'FEATURED',
        color: ['linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'][i % 3],
        price: formatPrice(p),
        icon: <Zap size={14}/>,
        bgImg: DEMO_IMG,
        isDynamic: !!p.dynamic_pricing
    })) : [
        { id: 'f1', title: 'Skyline AI', subtitle: 'Advanced automation for your desktop...', category: 'FEATURED', color: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', price: 'FREE', icon: <Zap size={14}/>, bgImg: DEMO_IMG },
        { id: 'f2', title: 'Nexus Dev', subtitle: 'The ultimate toolset for modern devs...', category: 'POWER USER', color: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', price: 'FREE', icon: <Activity size={14}/>, bgImg: AD_DEMO_IMG }
    ];

    const sponsored = plugins.length > 3 ? plugins.slice(3, 5).map((p, i) => ({
        ...p,
        title: p.name,
        subtitle: p.description?.substring(0, 50) + '...',
        price: p.pricing_model === 'free' ? 'GET' : `$${p.price}`,
        tag: 'SPONSORED',
        color: ['linear-gradient(90deg, #f97316 0%, #f59e0b 100%)', 'linear-gradient(90deg, #ef4444 0%, #fca5a5 100%)'][i % 2],
        logo: p.icon_url ? <img src={p.icon_url} alt="" style={{width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover'}} /> : '🚀'
    })) : [
        { id: 's1', title: 'Ad Space Available', subtitle: 'Promote your plugin here with Ad Studio', price: 'JOIN', tag: 'AD', color: 'linear-gradient(90deg, #475569 0%, #1e293b 100%)', logo: '📢' }
    ];

    const topPlugins = plugins.slice(0, 5).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 3).map((p, i) => ({
        ...p,
        rank: i + 1,
        title: p.name,
        author: p.author
    }));

    const handleBuy = (plugin) => {
        if (plugin.pricing_model === 'free') return;
        setCheckoutPlugin(plugin);
        setShowCheckout(true);
    };

    const handleConfirmPayment = async (providerType) => {
        const plugin = checkoutPlugin;
        if (!plugin) return;
        
        setShowCheckout(false);
        setBuying(plugin.name);

        try {
            // Gumroad logic
            if (plugin.gumroad_url) {
                const gumroadUrl = plugin.gumroad_url;
                const finalUrl = gumroadUrl.includes('?') ? `${gumroadUrl}&a=9567637` : `${gumroadUrl}?a=9567637`;
                if (window.pywebview?.api?.open_payment_window) {
                    window.pywebview.api.open_payment_window(finalUrl);
                } else {
                    window.open(finalUrl, '_blank');
                }
                return;
            }

            // White-Label Worker Logic (checkout.horizondesk.in)
            const provider = providerType === 'upi' ? 'upi' : 'stripe';
            const currency = userCountry === 'India' ? 'INR' : 'USD';
            const amountValue = (userCountry === 'India' 
                ? (plugin.price_inr > 0 ? plugin.price_inr : plugin.price * 83) 
                : plugin.price).toString();
            const email = localStorage.getItem('horizon_user_email') || '';

            // This URL points to the worker's /api/pay/page endpoint which handles
            // wallet creation and redirecting server-side.
            const checkoutUrl = `https://checkout.horizondesk.in/api/pay/page?amount=${amountValue}&currency=${currency}&provider=${provider}&plugin=${encodeURIComponent(plugin.name)}&email=${encodeURIComponent(email)}`;
            
            trackEvent(plugin.id, 'purchase_intent', parseFloat(amountValue), currency);
            
            if (window.pywebview?.api?.open_payment_window) {
                window.pywebview.api.open_payment_window(checkoutUrl);
            } else {
                window.open(checkoutUrl, '_blank');
            }
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setBuying(null);
        }
    };

    const handleInstall = async (plugin) => {
        if (!installed.includes(plugin.name)) {
            // Check if it's a paid plugin that hasn't been bought yet
            if (plugin.pricing_model !== 'free' && !plugin.is_purchased) {
                handleBuy(plugin);
                return;
            }

            if (plugin.tigris_url) {
                setInstalling(plugin.name);
                try {
                    const res = await window.pywebview.api.install_plugin(plugin.tigris_url, plugin.name);
                    if (res.success) {
                        setInstalled([...installed, plugin.name]);
                        trackEvent(plugin.id, 'install');
                    } else {
                        alert("Failed to install plugin: " + (res?.error || "Unknown error"));
                    }
                } catch (e) {
                    alert("Error communicating with backend: " + e.message);
                    console.error(e);
                } finally {
                    setInstalling(null);
                }
            } else {
                alert("No download URL available for this plugin.");
            }
        } else {
            setInstalled(installed.filter(i => i !== plugin.name));
            posthog.capture('plugin_uninstalled', { plugin_name: plugin.name });
        }
    };

    const handleOpenFolder = async (folderName) => {
        try {
            await window.pywebview.api.open_plugin_folder(folderName);
        } catch (e) {
            alert("Error opening folder: " + e.message);
        }
    };

    const categories = ['All', 'Installed', 'AI Tools', 'Automation', 'Developer', 'Productivity', 'Communication', 'More >'];

    const filteredPlugins = (() => {
        let base = activeTab === 'All'
            ? plugins
            : activeTab === 'Installed'
                ? localPlugins
                : plugins.filter(p => (p.category || 'General').toLowerCase().includes(activeTab.toLowerCase()));
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            base = base.filter(p =>
                p.name?.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q) ||
                p.author?.toLowerCase().includes(q)
            );
        }
        return base;
    })();

    // --- PLUGIN DETAILS PAGE ---
    useEffect(() => {
        if (selectedPlugin) {
            setScreenshotIndex(0);
            trackEvent(selectedPlugin.id, 'view');
        }
    }, [selectedPlugin]);
    if (selectedPlugin) {
        const isInstalled = installed.includes(selectedPlugin.name) || selectedPlugin.isLocal;
        return (
            <div style={{ padding: '0px 20px 40px 20px', maxWidth: '1200px', margin: '0 auto', height: '100%', overflowY: 'auto' }}>
                {/* Breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '30px' }}>
                    <span style={{ cursor: 'pointer', fontWeight: 500 }} onClick={() => setSelectedPlugin(null)}>Plugin Store</span>
                    <ChevronRight size={14} />
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{selectedPlugin.name}</span>
                </div>

                <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
                    
                    {/* Main Content Area */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        {/* Title & Install Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '20px' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '18px', backgroundColor: selectedPlugin.icon_url ? 'transparent' : (selectedPlugin.iconBg || '#3b82f6'), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                                    {selectedPlugin.icon_url ? <img src={selectedPlugin.icon_url} alt={selectedPlugin.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <Puzzle size={40} />}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>{selectedPlugin.name}</h1>
                                    <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                        {selectedPlugin.author} • v{selectedPlugin.version || '1.0'}
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                        <span style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>+ {selectedPlugin.category || 'PRODUCTIVITY'}</span>
                                        {selectedPlugin.isLocal && <span style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, color: '#10b981' }}>INSTALLED</span>}
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '15px' }}>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {selectedPlugin.isLocal && (
                                        <button 
                                            onClick={() => handleOpenFolder(selectedPlugin.folder_name)}
                                            style={{ 
                                                backgroundColor: 'var(--bg-panel)',
                                                color: 'var(--text-main)',
                                                border: '1px solid var(--border-subtle)',
                                                padding: '10px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '15px', 
                                                cursor: 'pointer'
                                            }}>
                                            Open Folder
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => {
                                            if (!isInstalled && selectedPlugin.pricing_model !== 'free' && !selectedPlugin.is_purchased) {
                                                handleBuy(selectedPlugin);
                                            } else {
                                                handleInstall(selectedPlugin);
                                            }
                                        }}
                                        disabled={installing === selectedPlugin.name || buying === selectedPlugin.name}
                                        style={{ 
                                            backgroundColor: isInstalled ? (selectedPlugin.isLocal ? 'var(--bg-selected)' : 'var(--bg-panel)') : 'var(--accent)',
                                            color: isInstalled ? 'var(--text-main)' : 'white',
                                            border: isInstalled ? '1px solid var(--border-subtle)' : 'none',
                                            padding: '10px 40px', borderRadius: '8px', fontWeight: 600, fontSize: '15px', 
                                            cursor: (installing === selectedPlugin.name) ? 'default' : 'pointer',
                                            opacity: (installing === selectedPlugin.name || buying === selectedPlugin.name) ? 0.7 : 1,
                                            boxShadow: isInstalled ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
                                        }}>
                                        {buying === selectedPlugin.name ? 'Redirecting...' : 
                                         installing === selectedPlugin.name ? 'Installing...' : 
                                         (isInstalled ? (selectedPlugin.isLocal ? 'Local Plugin' : 'Uninstall') : 
                                         (selectedPlugin.pricing_model === 'free' ? 'Install' : `Buy ${formatPrice(selectedPlugin)}`))}
                                    </button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Download size={14} /> <span>{selectedPlugin.install_count || 0} installs</span>
                                    </div>
                                    {selectedPlugin.dynamic_pricing === 1 && (
                                        <div style={{ padding: '2px 8px', borderRadius: '4px', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: '10px', fontWeight: 600 }}>
                                            🔥 DYNAMIC PRICING
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                    <ShieldCheck size={14} color="#10b981" /> <span>Secure Checkout via RiskPay</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                    <div style={{ display: 'flex', color: '#f59e0b' }}>
                                        <Star size={14} fill="currentColor" stroke="none" />
                                        <Star size={14} fill="currentColor" stroke="none" />
                                        <Star size={14} fill="currentColor" stroke="none" />
                                        <Star size={14} fill="currentColor" stroke="none" />
                                        <Star size={14} fill="currentColor" stroke="none" opacity={0.5} />
                                    </div>
                                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>4.7</span>
                                    <span>(302 reviews)</span>
                                </div>
                            </div>
                        </div>

                        <p style={{ fontSize: '16px', lineHeight: 1.6, marginTop: '10px', color: 'var(--text-main)' }}>
                            {selectedPlugin.description || `Allows your agent to seamlessly integrate with ${selectedPlugin.name}. Boost your productivity and automate workflows instantly.`}
                        </p>

                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: '30px', borderBottom: '1px solid var(--border-subtle)', marginTop: '10px' }}>
                            <div style={{ paddingBottom: '10px', fontWeight: 600, borderBottom: '2px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer' }}>Overview</div>
                            <div style={{ paddingBottom: '10px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>Reviews (302)</div>
                            <div style={{ paddingBottom: '10px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>Changelog</div>
                        </div>

                        {/* Screenshots Carousel */}
                        {(() => {
                            const shots = selectedPlugin.screenshots || [];
                            if (shots.length > 0) {
                                const idx = screenshotIndex % shots.length;
                                return (
                                    <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', position: 'relative', background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)' }}>
                                        <img src={shots[idx]} alt={`Screenshot ${idx + 1}`} style={{ width: '100%', height: '300px', objectFit: 'cover', display: 'block' }} />
                                        {shots.length > 1 && (
                                            <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                                                {shots.map((_, i) => (
                                                    <div key={i} onClick={() => setScreenshotIndex(i)}
                                                        style={{ width: i === idx ? 20 : 8, height: 8, borderRadius: 4, background: i === idx ? 'white' : 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'all 0.3s' }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        <button onClick={() => setScreenshotIndex(p => (p - 1 + shots.length) % shots.length)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', color: 'white', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                                        <button onClick={() => setScreenshotIndex(p => (p + 1) % shots.length)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', color: 'white', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                                    </div>
                                );
                            } else {
                                // Placeholder when no screenshots
                                return (
                                    <div style={{ width: '100%', height: '200px', background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: 8 }}>
                                        <Puzzle size={40} strokeWidth={1} />
                                        <div style={{ fontSize: 13 }}>No screenshots available yet.</div>
                                    </div>
                                );
                            }
                        })()}

                        {/* Recommendations */}
                        <div style={{ marginTop: '20px', marginBottom: '40px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '15px' }}>Recommendations</h3>
                            <div style={{ display: 'flex', gap: '20px' }}>
                                {plugins.filter(p => p.id !== selectedPlugin.id).slice(0, 2).map((app, idx) => (
                                    <div key={idx} onClick={() => setSelectedPlugin(app)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                                        <div style={{ width: '45px', height: '45px', borderRadius: '10px', backgroundColor: app.icon_url ? 'transparent' : (app.iconBg || '#3b82f6'), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                            {app.icon_url ? <img src={app.icon_url} alt="" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <Puzzle size={20} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{app.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{app.author}</div>
                                        </div>
                                        <button style={{ backgroundColor: 'var(--bg-app)', color: 'var(--accent)', border: '1px solid var(--border-subtle)', padding: '4px 16px', borderRadius: '100px', fontSize: '12px', fontWeight: 700 }}>GET</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar Details */}
                    <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'linear-gradient(135deg, #2a5298, #1e3c72)', margin: '0 auto 15px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                                R
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '16px' }}>{selectedPlugin.author}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginTop: '5px' }}>
                                <ShieldCheck size={14} color="var(--accent)"/> Verified Developer
                            </div>
                        </div>

                        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
                            <h4 style={{ margin: '0 0 15px 0', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>Stats</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontSize: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Download size={16} color="var(--text-secondary)"/> <strong>{selectedPlugin.downloads || '1.2k'}</strong> <span style={{ color: 'var(--text-secondary)' }}>Installs</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Activity size={16} color="var(--accent)"/> <strong style={{ color: 'var(--accent)' }}>+120</strong> <span style={{ color: 'var(--text-secondary)' }}>This Week</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <CheckCircle2 size={16} color="var(--accent)"/> <strong>v{selectedPlugin.version || '1.0'}</strong> <span style={{ color: 'var(--text-secondary)' }}>Latest Version</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
                            <h4 style={{ margin: '0 0 15px 0', color: 'var(--text-main)', fontWeight: 600, fontSize: '15px' }}>Key Features</h4>
                            <ul style={{ margin: 0, padding: 0, paddingLeft: '15px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                <li>Seamless integration with the host application.</li>
                                <li>Background processing capability.</li>
                                <li>Custom workspace control hooks.</li>
                            </ul>
                            <div style={{ textAlign: 'right', marginTop: '15px' }}>
                                <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>See Documentaton &gt;</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- MAIN STORE HOMEPAGE ---
    return (
        <div style={{ padding: '0px 20px 40px 20px', maxWidth: '1200px', margin: '0 auto', height: '100%', overflowY: 'auto' }}>
            
            {/* Header + Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px', marginBottom: 25 }}>
                <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>HORIZON DESK</div>
                    <h1 style={{ fontSize: '36px', fontWeight: 800, margin: '5px 0 0 0' }}>Plugin Store</h1>
                </div>
                <div style={{ position: 'relative', width: 280 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search plugins..."
                        style={{
                            width: '100%', padding: '10px 12px 10px 36px',
                            background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)',
                            borderRadius: 10, color: 'var(--text-main)', fontSize: 14,
                            outline: 'none'
                        }}
                    />
                </div>
            </div>

            {/* Display: Top Section (Hero Cards + Top Chart Sidebar) */}
            <div style={{ display: 'flex', gap: '30px' }}>
                
                {/* Left side: Heroes + Sponsored */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Heroes */}
                    <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '20px', scrollbarWidth: 'none' }}>
                        {featured.map(item => (
                            <div key={item.id} onClick={() => { if(item.name) { setSelectedPlugin(item); setScreenshotIndex(0); } }} style={{
                                flex: 1, minWidth: '240px', height: '160px', borderRadius: '16px', background: item.color,
                                padding: '20px', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', cursor: 'pointer', position: 'relative', overflow: 'hidden'
                            }}>
                                {item.bgImg && <img src={item.bgImg} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4, zIndex: 0 }} />}
                                <div style={{ zIndex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '4px', borderRadius: '50%', display: 'flex' }}>{item.icon}</div>
                                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{item.category}</span>
                                </div>
                                <div style={{ zIndex: 1 }}>
                                    <h2 style={{ margin: '0 0 5px 0', fontSize: '22px', fontWeight: 700 }}>{item.title}</h2>
                                    <div style={{ fontSize: '13px', fontWeight: 500, opacity: 0.9 }}>{item.subtitle}</div>
                                </div>
                                <div style={{ zIndex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (item.pricing_model !== 'free') {
                                                handleBuy(item);
                                            } else {
                                                handleInstall(item);
                                            }
                                        }}
                                        style={{ backgroundColor: 'white', color: '#111', border: 'none', padding: '6px 20px', borderRadius: '20px', fontWeight: 700, fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                        {item.price}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Sponsored */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Sponsored</h3>
                        <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>See All &gt;</span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
                        {sponsored.map(item => (
                            <div key={item.id} style={{
                                flex: 1, height: '90px', borderRadius: '12px', background: item.color, color: 'white',
                                padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden'
                            }}>
                                <div onClick={() => { if(item.name) { setSelectedPlugin(item); setScreenshotIndex(0); } }} style={{ display: 'flex', alignItems: 'center', gap: '15px', zIndex: 1, cursor: 'pointer' }}>
                                    <div style={{ fontSize: '32px', background: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{item.logo}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{item.title}</h3>
                                        </div>
                                        <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.subtitle}</div>
                                    </div>
                                </div>
                                {item.bgImg && <img src={item.bgImg} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.2, zIndex: 0 }} />}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', zIndex: 1 }}>
                                    <span 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (item.pricing_model !== 'free') {
                                                handleBuy(item);
                                            } else {
                                                handleInstall(item);
                                            }
                                        }}
                                        style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                                        {item.price}
                                    </span>
                                    <span style={{ background: '#fef08a', color: '#854d0e', padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>{item.tag}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Discover Grid */}
                    <div style={{ marginBottom: '15px' }}>
                        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Discover Plugins</h2>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '15px', borderBottom: '1px solid var(--border-subtle)' }}>
                            {categories.map(cat => (
                                <div key={cat} onClick={() => setActiveTab(cat)} style={{
                                    paddingBottom: '10px', fontSize: '14px', cursor: 'pointer',
                                    fontWeight: activeTab === cat ? 600 : 500,
                                    color: activeTab === cat ? (cat === 'All' ? 'white' : 'var(--text-main)') : 'var(--text-secondary)',
                                    background: activeTab === cat && cat === 'All' ? 'var(--accent)' : 'transparent',
                                    padding: activeTab === cat && cat === 'All' ? '4px 12px' : '0 0',
                                    borderRadius: activeTab === cat && cat === 'All' ? '100px' : '0',
                                    marginBottom: activeTab === cat && cat === 'All' ? '5px' : '0',
                                }}>{cat}</div>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                        {filteredPlugins.map((app, i) => (
                            <div key={i} onClick={() => { setSelectedPlugin(app); setScreenshotIndex(0); }} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: app.is_sponsored ? '1px solid var(--accent)' : '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'box-shadow 0.2s', position: 'relative' }}>
                                {app.is_sponsored && <div style={{ position: 'absolute', top: 8, right: 10, background: 'var(--accent)', color: 'white', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4, letterSpacing: 1 }}>AD</div>}
                                <div style={{ width: '50px', height: '50px', borderRadius: '12px', backgroundColor: app.icon_url ? 'transparent' : (app.iconBg || '#3b82f6'), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                    {app.icon_url ? <img src={app.icon_url} alt="" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <Puzzle size={24} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{app.author} {app.version ? `v${app.version}` : ''}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.description}</div>
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (app.isLocal) {
                                            handleOpenFolder(app.folder_name);
                                        } else if (app.pricing_model !== 'free' && !app.is_purchased) {
                                            handleBuy(app);
                                        } else {
                                            handleInstall(app);
                                        }
                                    }}
                                    style={{ backgroundColor: app.isLocal ? 'var(--bg-app)' : 'var(--accent)', color: app.isLocal ? 'var(--accent)' : 'white', border: app.isLocal ? '1px solid var(--accent)' : 'none', padding: '6px 20px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                                    {app.isLocal ? 'OPEN' : formatPrice(app)}
                                </button>
                            </div>
                        ))}
                    </div>

                </div>

                {/* Right side: Top Charts sidebar */}
                <div style={{ width: '280px' }}>
                    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
                        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600 }}>Top Plugins of the Day</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {topPlugins.map(tp => (
                                <div key={tp.id} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ fontSize: '20px', fontWeight: 300, color: 'var(--text-secondary)', width: '15px' }}>{tp.rank}</div>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: tp.icon_url ? 'transparent' : (tp.iconBg || '#3b82f6'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden', flexShrink: 0 }}>
                                        {tp.icon_url ? <img src={tp.icon_url} alt="" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <Puzzle size={18}/>}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tp.title}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tp.author}</div>
                                    </div>
                                    <button style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: '100px', padding: '4px 12px', fontSize: '12px', fontWeight: 700 }}>GET</button>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '30px', borderTop: '1px solid var(--border-subtle)', paddingTop: '15px' }}>
                            <span style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>See Top Charts &gt;</span>
                        </div>
                    </div>
                </div>
            </div>
            <CheckoutModal 
                isOpen={showCheckout} 
                onClose={() => setShowCheckout(false)} 
                plugin={checkoutPlugin} 
                userCountry={userCountry}
                onConfirm={handleConfirmPayment}
            />
        </div>
    );
};

export default Plugins;
