
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../constants';
import { College, User, Role } from '../types';
import { getColleges, addCollege, updateCollege, deleteCollege, getUsers, updateUser, addUser } from '../services';
import { Modal, RolePill } from '../components';

const ManageCollegesPage: React.FC = () => {
    const navigate = useNavigate();
    const [colleges, setColleges] = useState<College[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    const [isCreatePrincipalMode, setIsCreatePrincipalMode] = useState(false);
    const [editingCollege, setEditingCollege] = useState<College | null>(null);
    const [selectedCollegeForPrincipals, setSelectedCollegeForPrincipals] = useState<College | null>(null);
    const [newPrincipalData, setNewPrincipalData] = useState({
        name: '',
        pin: '',
        password: ''
    });
    const [formData, setFormData] = useState<Omit<College, 'id'>>({
        name: '',
        code: '',
        location: '',
        latitude: 0,
        longitude: 0,
        radius: 500
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [collegeData, userData] = await Promise.all([
                getColleges(),
                getUsers()
            ]);
            setColleges(collegeData);
            setAllUsers(userData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (college?: College) => {
        if (college) {
            setEditingCollege(college);
            setFormData({
                name: college.name,
                code: college.code,
                location: college.location || '',
                latitude: college.latitude || 0,
                longitude: college.longitude || 0,
                radius: college.radius || 500
            });
        } else {
            setEditingCollege(null);
            setFormData({
                name: '',
                code: '',
                location: '',
                latitude: 0,
                longitude: 0,
                radius: 500
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCollege) {
                await updateCollege(editingCollege.id, formData);
            } else {
                await addCollege(formData);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Error saving college:", error);
            alert("Failed to save college. Please try again.");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this college? This may affect users associated with it.")) {
            try {
                await deleteCollege(id);
                fetchData();
            } catch (error) {
                console.error("Error deleting college:", error);
                alert("Failed to delete college.");
            }
        }
    };

    const handleTogglePrincipal = async (user: User, collegeId: string) => {
        const isCurrentlyPrincipal = user.role === Role.PRINCIPAL && user.collegeId === collegeId;
        
        const updatedUser: User = {
            ...user,
            role: isCurrentlyPrincipal ? Role.STUDENT : Role.PRINCIPAL,
            collegeId: isCurrentlyPrincipal ? undefined : collegeId
        };

        try {
            await updateUser(user.id, updatedUser);
            fetchData();
        } catch (error) {
            console.error("Error toggling principal status:", error);
            alert("Failed to update principal status.");
        }
    };

    const handleCreatePrincipal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCollegeForPrincipals) return;

        const newUser: User = {
            id: `new_${Date.now()}`,
            name: newPrincipalData.name,
            pin: newPrincipalData.pin,
            password: newPrincipalData.password,
            role: Role.PRINCIPAL,
            collegeId: selectedCollegeForPrincipals.id,
            branch: 'ADMIN',
            email_verified: true,
            parent_email_verified: false,
        } as User;

        try {
            await addUser(newUser);
            setNewPrincipalData({ name: '', pin: '', password: '' });
            setIsCreatePrincipalMode(false);
            fetchData();
        } catch (error) {
            console.error("Error creating principal:", error);
            alert("Failed to create principal account.");
        }
    };

    const getCollegePrincipals = (collegeId: string) => {
        return allUsers.filter(u => u.role === Role.PRINCIPAL && u.collegeId === collegeId);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Manage Colleges</h1>
                    <p className="text-slate-500 dark:text-slate-400">Add and manage educational institutions in the system.</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold shadow-lg shadow-primary-500/20 transition-all active:scale-95"
                >
                    <Icons.logo className="w-5 h-5" />
                    Add New College
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {colleges.map((college) => (
                        <div 
                            key={college.id} 
                            onClick={() => navigate(`/manage-users?collegeId=${college.id}`)}
                            className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700/50 group hover:border-primary-500/50 transition-all cursor-pointer"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-2xl text-primary-600 dark:text-primary-400">
                                    <Icons.college className="w-8 h-8" />
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenModal(college);
                                        }}
                                        className="p-2 text-slate-400 hover:text-primary-500 transition-colors"
                                        title="Edit College"
                                    >
                                        <Icons.settings className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(college.id);
                                        }}
                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                        title="Delete College"
                                    >
                                        <Icons.close className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">{college.name}</h3>
                            <p className="text-primary-600 dark:text-primary-400 font-bold font-mono text-sm mb-3">CODE: {college.code}</p>
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-2">
                                <Icons.location className="w-4 h-4" />
                                <span>{college.location || 'Location not specified'}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-4">
                                <div className="px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg text-[10px] font-bold text-slate-500">
                                    LAT: {college.latitude?.toFixed(4) || 'N/A'}
                                </div>
                                <div className="px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg text-[10px] font-bold text-slate-500">
                                    LON: {college.longitude?.toFixed(4) || 'N/A'}
                                </div>
                                <div className="px-2 py-1 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-[10px] font-bold text-primary-600">
                                    RAD: {college.radius || 500}m
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">College Principals</span>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedCollegeForPrincipals(college);
                                            setIsAdminModalOpen(true);
                                        }}
                                        className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors"
                                    >
                                        Manage
                                    </button>
                                </div>
                                <div className="flex -space-x-2 overflow-hidden">
                                    {getCollegePrincipals(college.id).length > 0 ? (
                                        getCollegePrincipals(college.id).map(principal => (
                                            <img 
                                                key={principal.id}
                                                className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800"
                                                src={principal.imageUrl || null}
                                                alt={principal.name}
                                                title={principal.name}
                                            />
                                        ))
                                    ) : (
                                        <span className="text-xs text-slate-400 italic">No principals assigned</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal 
                isOpen={isAdminModalOpen} 
                onClose={() => {
                    setIsAdminModalOpen(false);
                    setIsCreatePrincipalMode(false);
                }} 
                title={`Manage Principals - ${selectedCollegeForPrincipals?.name}`}
                maxWidthClass="max-w-2xl"
            >
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Assign or create principals for this college.
                        </p>
                        <button 
                            onClick={() => setIsCreatePrincipalMode(!isCreatePrincipalMode)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                isCreatePrincipalMode 
                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                                    : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-500/20'
                            }`}
                        >
                            {isCreatePrincipalMode ? 'Cancel' : 'Create New Principal'}
                        </button>
                    </div>

                    {isCreatePrincipalMode ? (
                        <form onSubmit={handleCreatePrincipal} className="p-6 bg-primary-50 dark:bg-primary-900/10 rounded-3xl border border-primary-100 dark:border-primary-900/30 space-y-4 animate-fade-in">
                            <h4 className="font-bold text-primary-700 dark:text-primary-400 flex items-center gap-2">
                                <Icons.users className="w-5 h-5" />
                                Create New Principal Account
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                                    <input 
                                        required
                                        type="text" 
                                        value={newPrincipalData.name}
                                        onChange={(e) => setNewPrincipalData({ ...newPrincipalData, name: e.target.value })}
                                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Principal Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Login PIN</label>
                                    <input 
                                        required
                                        type="text" 
                                        value={newPrincipalData.pin}
                                        onChange={(e) => setNewPrincipalData({ ...newPrincipalData, pin: e.target.value })}
                                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="e.g., PRI-210"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                                    <input 
                                        required
                                        type="password" 
                                        value={newPrincipalData.password}
                                        onChange={(e) => setNewPrincipalData({ ...newPrincipalData, password: e.target.value })}
                                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Login Password"
                                    />
                                </div>
                            </div>
                            <button 
                                type="submit"
                                className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20"
                            >
                                Create & Assign Principal
                            </button>
                        </form>
                    ) : (
                        <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                            {allUsers.filter(u => u.pin !== 'bhanu99517').map(user => {
                                const isThisCollegePrincipal = user.role === Role.PRINCIPAL && user.collegeId === selectedCollegeForPrincipals?.id;
                                const isOtherCollegePrincipal = user.role === Role.PRINCIPAL && user.collegeId !== selectedCollegeForPrincipals?.id;
                                
                                return (
                                    <div key={user.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <img src={user.imageUrl || null} className="w-10 h-10 rounded-full object-cover" alt="" />
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{user.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-500 font-mono">{user.pin}</span>
                                                    <RolePill role={user.role} />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <button
                                            disabled={isOtherCollegePrincipal}
                                            onClick={() => handleTogglePrincipal(user, selectedCollegeForPrincipals!.id)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                                isThisCollegePrincipal 
                                                    ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                                                    : isOtherCollegePrincipal
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                                            }`}
                                        >
                                            {isThisCollegePrincipal ? 'Remove Principal' : isOtherCollegePrincipal ? 'Principal Elsewhere' : 'Make Principal'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Modal>

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={editingCollege ? 'Edit College' : 'Add New College'}
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">College Name</label>
                            <input 
                                required
                                type="text" 
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Government Polytechnic Sangareddy"
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">College Code</label>
                                <input 
                                    required
                                    type="text" 
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    placeholder="e.g., 210"
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Location</label>
                                <input 
                                    type="text" 
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="e.g., Sangareddy"
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Latitude</label>
                                <input 
                                    type="number" 
                                    step="any"
                                    value={formData.latitude}
                                    onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                    placeholder="e.g., 18.4550"
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Longitude</label>
                                <input 
                                    type="number" 
                                    step="any"
                                    value={formData.longitude}
                                    onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                                    placeholder="e.g., 79.5217"
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Radius (meters)</label>
                                <input 
                                    type="number" 
                                    value={formData.radius}
                                    onChange={(e) => setFormData({ ...formData, radius: parseInt(e.target.value) })}
                                    placeholder="e.g., 500"
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button 
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 shadow-lg shadow-primary-500/20 transition-all active:scale-95"
                        >
                            {editingCollege ? 'Update College' : 'Create College'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ManageCollegesPage;
