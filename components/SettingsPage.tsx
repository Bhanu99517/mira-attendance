import React, { useState, useEffect } from 'react';
import type { User, AppSettings } from '../types';
import { getSettings, updateSettings, updateUser, cogniCraftService, changePassword } from '../services';
import { Icons } from '../constants';
import { Modal } from '../components';

const SettingsSection: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6 border-b dark:border-slate-700 pb-4">{description}</p>
        <div className="space-y-4">{children}</div>
    </div>
);

const ToggleSwitch: React.FC<{ label: string; enabled: boolean; onChange: (enabled: boolean) => void }> = ({ label, enabled, onChange }) => (
    <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <button
            onClick={() => onChange(!enabled)}
            className={`${enabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
        >
            <span className={`${enabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
        </button>
    </div>
);

const SettingsPage: React.FC<{ user: User; theme: 'light' | 'dark'; toggleTheme: () => void; logout: () => void; }> = ({ user, theme, toggleTheme, logout }) => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [profile, setProfile] = useState({ name: user.name, email: user.email || '' });
    const [apiStatus, setApiStatus] = useState<{ isInitialized: boolean; error: string | null; }>({ isInitialized: false, error: null });
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | null; message: string | null }>({ type: null, message: null });
    
    useEffect(() => {
        getSettings(user.id).then(setSettings);
        setApiStatus(cogniCraftService.getClientStatus());
    }, [user.id]);
    
    const handleSettingsChange = async (newSettings: AppSettings) => {
        setSettings(newSettings);
        await updateSettings(user.id, newSettings);
    };

    const handleProfileChange = (field: 'name' | 'email', value: string) => {
        setProfile(p => ({ ...p, [field]: value }));
    };

    const handleProfileSave = async () => {
        await updateUser(user.id, { ...user, name: profile.name, email: profile.email });
        alert("Profile updated successfully! (Note: a page refresh might be needed to see changes in the header)");
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordStatus({ type: 'error', message: "Passwords do not match" });
            return;
        }
        if (passwordData.newPassword.length < 6) {
            setPasswordStatus({ type: 'error', message: "Password must be at least 6 characters" });
            return;
        }

        const result = await changePassword(user.id, passwordData.oldPassword, passwordData.newPassword);
        if (result.success) {
            setPasswordStatus({ type: 'success', message: result.message });
            setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => {
                setIsPasswordModalOpen(false);
                setPasswordStatus({ type: null, message: null });
            }, 2000);
        } else {
            setPasswordStatus({ type: 'error', message: result.message });
        }
    };

    const isSystemAdmin = user.pin === 'bhanu99517';

    if (!settings) {
        return <div>Loading settings...</div>;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <Icons.settings className="w-8 h-8 text-primary-500" />
                Settings
            </h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">Manage your profile, notifications, and account preferences.</p>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <SettingsSection title="Profile Settings" description="Update your personal information.">
                        <div>
                            <label className="text-sm font-medium">Full Name</label>
                            <input type="text" value={profile.name} onChange={(e) => handleProfileChange('name', e.target.value)} className="mt-1 w-full p-2 border rounded-lg bg-slate-100 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700" />
                        </div>
                         <div>
                            <label className="text-sm font-medium">Email Address</label>
                            <input type="email" value={profile.email} onChange={(e) => handleProfileChange('email', e.target.value)} className="mt-1 w-full p-2 border rounded-lg bg-slate-100 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700" />
                        </div>
                        <div className="flex justify-between items-center">
                            <button onClick={handleProfileSave} className="font-semibold py-2 px-4 rounded-lg bg-primary-600 text-white hover:bg-primary-700">Save Changes</button>
                            <button 
                                onClick={() => setIsPasswordModalOpen(true)}
                                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:underline"
                            >
                                Change Password
                            </button>
                        </div>
                    </SettingsSection>
                    
                    <SettingsSection title="Appearance" description="Customize the look and feel of the application.">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Theme</span>
                            <div className="flex items-center gap-1 rounded-lg bg-slate-200 dark:bg-slate-700 p-1">
                                <button
                                    onClick={() => { if (theme === 'dark') toggleTheme(); }}
                                    className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-2 ${theme === 'light' ? 'bg-white dark:bg-slate-600 shadow' : 'text-slate-600 dark:text-slate-300'}`}
                                >
                                    <Icons.sun className="w-4 h-4" /> Light
                                </button>
                                <button
                                    onClick={() => { if (theme === 'light') toggleTheme(); }}
                                    className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-2 ${theme === 'dark' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 dark:text-slate-300'}`}
                                >
                                    <Icons.moon className="w-4 h-4" /> Dark
                                </button>
                            </div>
                        </div>
                    </SettingsSection>
                    
                    {!isSystemAdmin && (
                        <SettingsSection title="Notification Preferences" description="Choose how you want to be notified.">
                            <h3 className="text-md font-semibold text-slate-800 dark:text-slate-100 border-b dark:border-slate-700 pb-2">Email Notifications</h3>
                            <ToggleSwitch label="Attendance Marked" enabled={settings.notifications.email.attendance} onChange={(e) => handleSettingsChange({ ...settings, notifications: { ...settings.notifications, email: { ...settings.notifications.email, attendance: e } } })}/>
                            <ToggleSwitch label="Application Status Updates" enabled={settings.notifications.email.applications} onChange={(e) => handleSettingsChange({ ...settings, notifications: { ...settings.notifications, email: { ...settings.notifications.email, applications: e } } })}/>
                            
                            <h3 className="text-md font-semibold text-slate-800 dark:text-slate-100 border-b dark:border-slate-700 pb-2 pt-4">WhatsApp Notifications</h3>
                            <ToggleSwitch label="Attendance Marked" enabled={settings.notifications.whatsapp.attendance} onChange={(e) => handleSettingsChange({ ...settings, notifications: { ...settings.notifications, whatsapp: { ...settings.notifications.whatsapp, attendance: e } } })}/>
                        </SettingsSection>
                    )}
                </div>
                <div className="space-y-8">
                     <SettingsSection title="Account" description="Manage your account data and privacy.">
                         <ToggleSwitch label="Make Profile Private" enabled={settings.profile_private} onChange={(e) => handleSettingsChange({ ...settings, profile_private: e })}/>
                         <button onClick={() => alert("Simulating data export... your data would be compiled and emailed to you.")} className="w-full text-left font-medium text-sm text-slate-700 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400">Export My Data</button>
                         <button onClick={() => alert("This is a critical action. In a real app, this would require password confirmation before deleting your account.")} className="w-full text-left font-medium text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">Delete My Account</button>
                         <div className="pt-4 border-t dark:border-slate-700 mt-4">
                            <button 
                                onClick={() => setIsLogoutModalOpen(true)} 
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border border-red-100 dark:border-red-900/30"
                            >
                                <Icons.logout className="w-5 h-5" />
                                Logout from Mira
                            </button>
                         </div>
                    </SettingsSection>
                    {!isSystemAdmin && (
                        <SettingsSection title="CogniCraft AI Status" description="Status of the connection to the CogniCraft AI service.">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">CogniCraft AI Service</span>
                                {apiStatus.isInitialized ? (
                                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300 border border-green-200 dark:border-green-500/30">
                                        Connected
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300 border border-red-200 dark:border-red-500/30">
                                        Not Configured
                                    </span>
                                )}
                            </div>
                            {!apiStatus.isInitialized && apiStatus.error && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-500/30 rounded-lg">
                                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Configuration Error</p>
                                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{apiStatus.error}</p>
                                </div>
                            )}
                        </SettingsSection>
                    )}
                </div>
            </div>

            {/* Change Password Modal */}
            <Modal 
                isOpen={isPasswordModalOpen} 
                onClose={() => {
                    setIsPasswordModalOpen(false);
                    setPasswordStatus({ type: null, message: null });
                }} 
                title="Change Password"
            >
                <form onSubmit={handlePasswordChange} className="space-y-4">
                    {passwordStatus.message && (
                        <div className={`p-3 rounded-lg text-sm ${passwordStatus.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {passwordStatus.message}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium mb-1">Old Password</label>
                        <input 
                            type="password" 
                            required
                            value={passwordData.oldPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                            className="w-full p-2 border rounded-lg bg-slate-100 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">New Password</label>
                        <input 
                            type="password" 
                            required
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            className="w-full p-2 border rounded-lg bg-slate-100 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                        <input 
                            type="password" 
                            required
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                            className="w-full p-2 border rounded-lg bg-slate-100 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700" 
                        />
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button 
                            type="button"
                            onClick={() => setIsPasswordModalOpen(false)}
                            className="flex-1 py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 py-2 px-4 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700"
                        >
                            Update Password
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Logout Confirmation Modal */}
            <Modal 
                isOpen={isLogoutModalOpen} 
                onClose={() => setIsLogoutModalOpen(false)} 
                title="Confirm Logout"
            >
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icons.logout className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">Are you sure you want to logout from your account?</p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setIsLogoutModalOpen(false)}
                            className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                setIsLogoutModalOpen(false);
                                logout();
                            }}
                            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 shadow-lg shadow-red-600/20"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SettingsPage;