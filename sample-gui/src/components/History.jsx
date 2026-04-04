import React, { useState, useEffect } from 'react';
import { Clock, Trash2, Search, Calendar, MessageSquare, Cpu, User, ChevronRight, RefreshCw } from 'lucide-react';

const History = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDate, setFilterDate] = useState('all');

    const fetchHistory = async () => {
        setLoading(true);
        if (window.pywebview?.api?.get_chat_history) {
            try {
                const res = await window.pywebview.api.get_chat_history(200);
                if (res.success) {
                    setHistory(res.history || []);
                }
            } catch (e) {
                console.error("Failed to fetch history:", e);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleClear = async () => {
        if (!confirm("Are you sure you want to clear all chat history? This cannot be undone.")) return;
        
        if (window.pywebview?.api?.clear_chat_history) {
            try {
                const res = await window.pywebview.api.clear_chat_history();
                if (res.success) {
                    setHistory([]);
                }
            } catch (e) {
                console.error("Failed to clear history:", e);
            }
        }
    };

    // Filter logic
    const filteredHistory = history.filter(item => {
        const matchesSearch = item.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             item.pane_id.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    // Grouping by date (simplified)
    const groupedHistory = filteredHistory.reduce((groups, item) => {
        const date = item.date.split(' ')[0]; // YYYY-MM-DD
        if (!groups[date]) groups[date] = [];
        groups[date].push(item);
        return groups;
    }, {});

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-app)',
            color: 'var(--text-main)',
            overflow: 'hidden',
            padding: '24px'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Clock size={28} color="var(--accent)" /> Chat History
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
                        Review your past conversations and agent tasks.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                   <button 
                        onClick={fetchHistory}
                        style={{
                            padding: '10px 16px', borderRadius: '10px', backgroundColor: 'var(--bg-panel)',
                            border: '1px solid var(--border-subtle)', color: 'var(--text-main)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                    <button 
                        onClick={handleClear}
                        style={{
                            padding: '10px 16px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                            fontWeight: 600, transition: 'all 0.2s'
                        }}
                    >
                        <Trash2 size={16} /> Clear All
                    </button>
                </div>
            </div>

            {/* Controls */}
            <div style={{ 
                display: 'flex', gap: '16px', marginBottom: '24px',
                backgroundColor: 'var(--bg-panel)', padding: '16px', borderRadius: '16px',
                border: '1px solid var(--border-subtle)'
            }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                    <input 
                        type="text" 
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 12px 10px 40px', borderRadius: '10px',
                            backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)', outline: 'none', fontSize: '14px'
                        }}
                    />
                </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }} className="custom-scroll">
                {loading ? (
                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RefreshCw size={32} color="var(--accent)" className="spin" />
                    </div>
                ) : Object.keys(groupedHistory).length === 0 ? (
                    <div style={{ 
                        height: '300px', display: 'flex', flexDirection: 'column', 
                        alignItems: 'center', justifyContent: 'center', opacity: 0.5 
                    }}>
                        <MessageSquare size={48} style={{ marginBottom: '16px' }} />
                        <p>No chat history found.</p>
                    </div>
                ) : (
                    Object.entries(groupedHistory).sort((a,b) => b[0].localeCompare(a[0])).map(([date, items]) => (
                        <div key={date} style={{ marginBottom: '32px' }}>
                            <div style={{ 
                                display: 'flex', alignItems: 'center', gap: '10px', 
                                marginBottom: '16px', fontSize: '13px', fontWeight: 700,
                                color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px'
                            }}>
                                <Calendar size={14} /> {date === new Date().toISOString().split('T')[0] ? 'Today' : date}
                                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)', opacity: 0.5 }}></div>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {items.map((item, i) => (
                                    <div key={i} style={{
                                        backgroundColor: 'var(--bg-panel)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        border: '1px solid var(--border-subtle)',
                                        display: 'flex',
                                        gap: '16px',
                                        transition: 'transform 0.2s',
                                        cursor: 'default'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '8px',
                                            backgroundColor: item.role === 'user' ? 'var(--accent)' : '#10a37f',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', flexShrink: 0
                                        }}>
                                            {item.role === 'user' ? <User size={18} /> : <Cpu size={18} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.7 }}>
                                                    {item.role === 'user' ? 'YOU' : 'HORIZON AGENT'} 
                                                    <span style={{ margin: '0 8px', opacity: 0.3 }}>•</span> 
                                                    <span style={{ fontWeight: 400 }}>{item.pane_id}</span>
                                                </span>
                                                <span style={{ fontSize: '11px', opacity: 0.4 }}>{item.date.split(' ')[1]}</span>
                                            </div>
                                            <div style={{ 
                                                fontSize: '14px', lineHeight: '1.6', color: 'var(--text-main)',
                                                maxHeight: '100px', overflow: 'hidden', position: 'relative'
                                            }}>
                                                {item.content}
                                                {item.content.length > 200 && (
                                                    <div style={{ 
                                                        position: 'absolute', bottom: 0, left: 0, right: 0, 
                                                        height: '24px', background: 'linear-gradient(to bottom, transparent, var(--bg-panel))'
                                                    }}></div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', opacity: 0.3 }}>
                                            <ChevronRight size={20} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <style>{`
                .custom-scroll::-webkit-scrollbar { width: 6px; }
                .custom-scroll::-webkit-scrollbar-track { background: transparent; }
                .custom-scroll::-webkit-scrollbar-thumb { 
                    background: var(--border-subtle); 
                    border-radius: 10px; 
                }
                .custom-scroll::-webkit-scrollbar-thumb:hover { background: var(--text-secondary); }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default History;
