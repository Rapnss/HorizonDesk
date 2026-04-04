import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, Box, Settings, Monitor, Puzzle, LogOut, Users, MessageSquare, MoreHorizontal, Clock } from 'lucide-react';

const CORE_ITEMS = [
    { id: 'home',     icon: LayoutGrid,    label: 'Home' },
    { id: 'teams',    icon: Users,         label: 'Teams' },
    { id: 'plugins',  icon: Puzzle,        label: 'Plugins' },
    { id: 'history',  icon: Clock,         label: 'History' },
    { id: 'monitor',  icon: Monitor,       label: 'Monitor' },
    { id: 'settings', icon: Settings,      label: 'Settings' },
    { id: 'feedback', icon: MessageSquare, label: 'Feedback' },
];

const MAX_VISIBLE = 7;

const Sidebar = ({ activeTab, setActiveTab, pluginTabs = [], customItems = null }) => {
    const [overflowOpen, setOverflowOpen] = useState(false);
    const overflowRef = useRef(null);

    // use customItems if provided (user reordered list from settings)
    const baseList = customItems ? customItems : CORE_ITEMS;

    console.log("[Sidebar] pluginTabs received:", pluginTabs);
    console.log("[Sidebar] customItems (baseList):", baseList.map(i => i.id));

    // Combine current core items (ordered) + plugin tabs; first MAX_VISIBLE visible, rest in overflow
    const allItems = [
        ...baseList.map(item => {
            const coreMatch = CORE_ITEMS.find(c => c.id === item.id);
            return {
                ...item,
                icon: item.icon || coreMatch?.icon || Puzzle // Fallback to Puzzle if no icon
            };
        }),
        ...pluginTabs.filter(p => {
            const isMatch = p.custom_ui && !baseList.some(b => b.id === `plugin_${p.folder_name}`);
            console.log(`[Sidebar] Filter check for ${p.name}: custom_ui=${p.custom_ui}, in_baseList=${baseList.some(b => b.id === "plugin_" + p.folder_name)}, result=${isMatch}`);
            return isMatch;
        }).map(p => ({ 
            id: `plugin_${p.folder_name}`, 
            label: p.name, 
            icon: null, 
            pluginIcon: p.icon_url || null, 
            isPlugin: true 
        }))
    ];
    
    console.log("[Sidebar] Final allItems:", allItems.map(i => i.id));
    
    // Respect visibility
    const visiblePool = allItems.filter(i => i.visible !== false);
    const hiddenPool = allItems.filter(i => i.visible === false);

    const visibleItems = visiblePool.slice(0, MAX_VISIBLE);
    const overflowItems = [...visiblePool.slice(MAX_VISIBLE), ...hiddenPool];

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (overflowRef.current && !overflowRef.current.contains(e.target)) {
                setOverflowOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const renderItem = (item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
            <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setOverflowOpen(false); }}
                title={item.label}
                style={{
                    width: '40px', height: '40px', borderRadius: '8px',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    color: isActive ? 'var(--text-main)' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'var(--bg-app)' : 'transparent',
                    transition: 'all 0.2s ease', border: 'none', cursor: 'pointer', flexShrink: 0,
                }}
            >
                {Icon
                    ? <Icon size={20} strokeWidth={1.5} />
                    : item.pluginIcon
                        ? <img src={item.pluginIcon} alt={item.label} style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} />
                        : <Puzzle size={20} strokeWidth={1.5} />
                }
            </button>
        );
    };

    return (
        <div style={{
            width: '60px', height: '100%', backgroundColor: 'var(--bg-panel)',
            borderRight: '1px solid var(--border-subtle)', display: 'flex',
            flexDirection: 'column', alignItems: 'center', 
            paddingTop: 'var(--padding-base)', 
            gap: 'var(--gap-base)', 
            position: 'relative'
        }}>
            {/* Logo */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ width: 32, height: 32, display: 'flex', justifyContent: 'center', alignItems: 'center' }} title="Horizon Desk">
                    <img src="logo.ico" alt="Horizon Desk" style={{ width: 32, height: 32 }} />
                </div>
            </div>

            {/* Visible items */}
            {visibleItems.map(renderItem)}

            {/* Overflow "..." button */}
            {overflowItems.length > 0 && (
                <div ref={overflowRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setOverflowOpen(v => !v)}
                        title="More tabs"
                        style={{
                            width: 40, height: 40, borderRadius: 8, display: 'flex',
                            justifyContent: 'center', alignItems: 'center',
                            color: overflowOpen ? 'var(--text-main)' : 'var(--text-secondary)',
                            backgroundColor: overflowOpen ? 'var(--bg-app)' : 'transparent',
                            border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        <MoreHorizontal size={20} strokeWidth={1.5} />
                    </button>

                    {/* Flyout panel */}
                    {overflowOpen && (
                        <div style={{
                            position: 'absolute', left: '52px', top: 0, zIndex: 999,
                            background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)',
                            borderRadius: 12, padding: '8px', display: 'flex', flexDirection: 'column',
                            gap: 4, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
                        }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 1 }}>More Tabs</div>
                            {overflowItems.map(item => {
                                const Icon = item.icon;
                                const isActive = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => { setActiveTab(item.id); setOverflowOpen(false); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '8px 12px', borderRadius: 8, cursor: 'pointer', border: 'none',
                                            background: isActive ? 'var(--bg-app)' : 'transparent',
                                            color: isActive ? 'var(--text-main)' : 'var(--text-secondary)',
                                            fontWeight: isActive ? 600 : 500, fontSize: 14, width: '100%', textAlign: 'left'
                                        }}
                                    >
                                        {Icon
                                            ? <Icon size={16} strokeWidth={1.5} />
                                            : item.pluginIcon
                                                ? <img src={item.pluginIcon} alt={item.label} style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'cover' }} />
                                                : <Puzzle size={16} strokeWidth={1.5} />
                                        }
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Exit button at bottom */}
            <div style={{ marginTop: 'auto', marginBottom: 20 }}>
                <button
                    title="Exit"
                    onClick={() => window.pywebview?.api?.close()}
                    style={{
                        width: 40, height: 40, borderRadius: 8,
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        color: 'var(--text-secondary)', border: 'none', cursor: 'pointer',
                        background: 'transparent', transition: 'all 0.2s'
                    }}
                >
                    <LogOut size={20} strokeWidth={1.5} />
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
