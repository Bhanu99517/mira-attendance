
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUsers, addUser, updateUser, deleteUser, getAllSbtetResultsForPin, saveSbtetResult, getColleges } from '../services';
import type { User, SBTETResult, College } from '../types';
import { Role } from '../types';
import { PlusIcon, EditIcon, DeleteIcon, IdCardIcon } from './Icons';
import { RolePill, Modal } from '../components';
import { Icons } from '../constants';

const createAvatar = (seed: string) => `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(seed)}`;

const generateIdCard = async (user: User) => {
    const canvas = document.createElement('canvas');
    const width = 540;
    const height = 856;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        alert("Failed to create ID card. Canvas context is not supported.");
        return;
    }

    const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => {
             console.error(`Failed to load image: ${src}`, err);
             const fallback = new Image();
             fallback.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
             resolve(fallback);
        };
        img.src = src;
    });

    const logoUrl = 'https://gptc-sangareddy.ac.in/images/logo.png';
    const signatureUrl = 'https://i.imgur.com/gza12Hk.png';

    try {
        const [studentImage, logoImage, signatureImage] = await Promise.all([
            loadImage(user.imageUrl!),
            loadImage(logoUrl),
            loadImage(signatureUrl)
        ]);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#F8E8EE';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(width, 0); ctx.lineTo(width, height); ctx.lineTo(0, height);
        ctx.bezierCurveTo(180, 650, 180, 250, 150, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#D50000';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, height);
        ctx.bezierCurveTo(140, 650, 140, 250, 110, 0);
        ctx.closePath();
        ctx.fill();
        
        const logoW = 90;
        const logoH = 90;
        ctx.drawImage(logoImage, (width - logoW) / 2, 20, logoW, logoH);
        
        ctx.fillStyle = '#000033';
        ctx.textAlign = 'center';

        ctx.font = 'bold 26px "Inter", sans-serif';
        ctx.fillText('GOVERNMENT POLYTECHNIC', width / 2, 130);
        
        ctx.font = 'bold 30px "Inter", sans-serif';
        ctx.fillText('SANGAREDDY', width / 2, 160);
        
        const photoW = 180;
        const photoH = 225;
        const photoX = (width - photoW) / 2;
        const photoY = 180;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#A0AEC0';
        ctx.lineWidth = 1;
        ctx.strokeRect(photoX - 1, photoY - 1, photoW + 2, photoH + 2);
        ctx.drawImage(studentImage, photoX, photoY, photoW, photoH);

        ctx.fillStyle = '#000033';
        ctx.font = 'bold 32px "Inter", sans-serif';
        ctx.fillText(user.name.toUpperCase(), width / 2, photoY + photoH + 35);

        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.drawImage(logoImage, (width - 200) / 2, 500, 200, 200);
        ctx.restore();

        ctx.textAlign = 'left';
        let currentY = photoY + photoH + 80;

        const drawDetail = (label: string, value: string, y: number) => {
            const labelX = 40;
            const colonX = 190;
            const valueX = 210;
            
            ctx.font = 'bold 20px "Inter", sans-serif';
            ctx.fillStyle = '#333333';
            ctx.fillText(label, labelX, y);
            ctx.fillText(':', colonX, y);

            ctx.font = '20px "Inter", sans-serif';
            ctx.fillStyle = '#1A202C';
            ctx.fillText(value, valueX, y);
        };
        
        drawDetail("Branch", user.branch, currentY); currentY += 45;
        drawDetail("Pin No", user.pin, currentY); currentY += 45;
        drawDetail("Mobile No", user.phoneNumber?.slice(-10) || 'N/A', currentY); currentY += 50;

        ctx.font = 'bold 20px "Inter", sans-serif';
        ctx.fillStyle = '#333333';
        const addressLabel = "Address";
        const addressLabelWidth = ctx.measureText(addressLabel).width;
        ctx.fillText(addressLabel, 40, currentY);
        ctx.beginPath();
        ctx.moveTo(40, currentY + 4);
        ctx.lineTo(40 + addressLabelWidth, currentY + 4);
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        currentY += 30;
        
        ctx.font = '20px "Inter", sans-serif';
        ctx.fillStyle = '#1A202C';
        ctx.fillText("Jawharnagar Colony,", 40, currentY);

        const signatureY = height - 160;
        ctx.drawImage(signatureImage, 350, signatureY, 150, 60);
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px "Inter"';
        ctx.fillStyle = '#1A202C';
        ctx.fillText('Principal', 425, signatureY + 90);
        ctx.font = '14px "Inter"';
        ctx.fillText('Govt. Polytechnic, Sangareddy', 425, signatureY + 110);

    } catch (e) {
        console.error("Could not generate ID card due to an error:", e);
        alert("Failed to generate ID card. One or more required images could not be loaded. Please check the console for details.");
        return;
    }

    const link = document.createElement('a');
    link.download = `ID_Card_${user.pin}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


const UserFormModal: React.FC<{
    user?: User | null;
    currentUser: User | null;
    colleges: College[];
    onClose: () => void;
    onSave: (user: User) => void;
}> = ({ user, currentUser, colleges, onClose, onSave }) => {
    const isEditMode = !!user;
    const isPrincipal = currentUser?.role === Role.PRINCIPAL;
    
    const [formData, setFormData] = useState<Partial<User>>({
        name: user?.name || '',
        pin: user?.pin || '',
        branch: user?.branch || 'EC',
        role: user?.role || Role.STUDENT,
        email: user?.email || '',
        parent_email: user?.parent_email || '',
        imageUrl: user?.imageUrl || '',
        referenceImageUrl: user?.referenceImageUrl || '',
        fatherName: user?.fatherName || '',
        aadharNumber: user?.aadharNumber || '',
        phoneNumber: user?.phoneNumber || '',
        parentPhoneNumber: user?.parentPhoneNumber || '',
        tenthMarks: user?.tenthMarks || '',
        documents: user?.documents || [],
        collegeId: user?.collegeId || (isPrincipal ? currentUser?.collegeId : (colleges.length > 0 ? colleges[0].id : '')),
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setFormData(prev => ({ ...prev, imageUrl: event.target?.result as string }));
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };
    
    const handleReferenceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setFormData(prev => ({ ...prev, referenceImageUrl: event.target?.result as string }));
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            filesArray.forEach((file: File) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const newDoc = {
                        name: file.name,
                        type: file.type,
                        url: event.target?.result as string
                    };
                    setFormData(prev => ({
                        ...prev,
                        documents: [...(prev.documents || []), newDoc]
                    }));
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removeDocument = (index: number) => {
        setFormData(prev => ({
            ...prev,
            documents: (prev.documents || []).filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const userToSave: User = {
            id: user?.id || `new_${Date.now()}`,
            year: parseInt(formData.pin?.split('-')[0] || '0'),
            college_code: formData.pin?.split('-')[1] || '',
            email_verified: user?.email_verified || false,
            parent_email_verified: user?.parent_email_verified || false,
            ...formData,
        } as User;
        onSave(userToSave);
    };

    const inputClasses = "mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500";
    const sectionLabel = "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-6 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1 flex items-center gap-2";
    const previewSrc = formData.imageUrl || (formData.name ? createAvatar(formData.name) : null);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-40 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-4 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-down" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">{isEditMode ? 'Edit User' : 'Register New User'}</h2>
                <p className="text-xs sm:text-sm text-slate-500 mb-6">Complete all sections to ensure accurate system records.</p>
                
                <form onSubmit={handleSubmit}>
                    {/* General Role Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium">System Role</label>
                            <select name="role" value={formData.role} onChange={handleInputChange} className={inputClasses}>
                                {Object.values(Role)
                                    .filter(role => {
                                        if (isPrincipal) {
                                            return role !== Role.SUPER_ADMIN && role !== Role.PRINCIPAL;
                                        }
                                        return true;
                                    })
                                    .map(role => <option key={role} value={role}>{role}</option>)
                                }
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">College</label>
                            <select 
                                name="collegeId" 
                                value={formData.collegeId} 
                                onChange={handleInputChange} 
                                disabled={isPrincipal}
                                className={`${inputClasses} ${isPrincipal ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                            >
                                {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">PIN / Employee ID</label>
                            <input type="text" name="pin" required value={formData.pin} onChange={handleInputChange} placeholder="e.g., 23210-EC-001" className={inputClasses} />
                        </div>
                    </div>

                    <div className={sectionLabel}><Icons.users className="w-4 h-4"/> Personal Details</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Full Name</label>
                            <input type="text" name="name" required value={formData.name} onChange={handleInputChange} className={inputClasses} />
                        </div>
                        {formData.role === Role.STUDENT && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium">Father's Name</label>
                                    <input type="text" name="fatherName" required value={formData.fatherName} onChange={handleInputChange} className={inputClasses} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Aadhar Number</label>
                                    <input type="text" name="aadharNumber" required maxLength={12} value={formData.aadharNumber} onChange={handleInputChange} placeholder="12-digit number" className={inputClasses} />
                                </div>
                            </>
                        )}
                        <div>
                            <label className="block text-sm font-medium">Branch/Department</label>
                            <select name="branch" value={formData.branch} onChange={handleInputChange} className={inputClasses}>
                                <option>CS</option><option>EC</option><option>EEE</option><option>Office</option><option>Library</option><option>ADMIN</option>
                            </select>
                        </div>
                    </div>

                    <div className={sectionLabel}><Icons.whatsapp className="w-4 h-4"/> Contact Information</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Student/Staff Phone Number</label>
                            <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Email Address</label>
                            <input type="email" name="email" value={formData.email} onChange={handleInputChange} className={inputClasses} />
                        </div>
                        {formData.role === Role.STUDENT && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium">Parent Phone Number</label>
                                    <input type="text" name="parentPhoneNumber" value={formData.parentPhoneNumber} onChange={handleInputChange} className={inputClasses} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Parent Email</label>
                                    <input type="email" name="parent_email" value={formData.parent_email} onChange={handleInputChange} className={inputClasses} />
                                </div>
                            </>
                        )}
                    </div>

                    {formData.role === Role.STUDENT && (
                        <>
                            <div className={sectionLabel}><Icons.syllabus className="w-4 h-4"/> Academic History</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">10th Marks / CGPA</label>
                                    <input type="text" name="tenthMarks" value={formData.tenthMarks} onChange={handleInputChange} placeholder="e.g., 9.8 or 550/600" className={inputClasses} />
                                </div>
                            </div>
                        </>
                    )}

                    <div className={sectionLabel}><Icons.camera className="w-4 h-4"/> Media & Documents</div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Profile Image</label>
                                <div className="mt-1 flex items-center gap-4">
                                    <img src={previewSrc || null} alt="Avatar" className="w-12 h-12 rounded-full object-cover bg-slate-100" />
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="text-[10px] sm:text-xs file:mr-2 sm:file:mr-4 file:py-1 file:px-2 sm:file:px-3 file:rounded-full file:border-0 file:bg-primary-50 file:text-primary-700" />
                                </div>
                            </div>
                            {formData.role === Role.STUDENT && (
                                <div>
                                    <label className="block text-sm font-medium">AI Reference Photo</label>
                                    <div className="mt-1 flex items-center gap-4">
                                        {formData.referenceImageUrl && <img src={formData.referenceImageUrl || null} alt="Ref" className="w-12 h-12 rounded-full object-cover bg-slate-100" />}
                                        <input type="file" accept="image/*" onChange={handleReferenceImageChange} className="text-[10px] sm:text-xs file:mr-2 sm:file:mr-4 file:py-1 file:px-2 sm:file:px-3 file:rounded-full file:border-0 file:bg-accent-50 file:text-accent-700" />
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium">Supporting Documents (PDF, Doc, Images)</label>
                            <div className="mt-1">
                                <div className="flex items-center justify-center w-full">
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800/50 hover:bg-slate-100 dark:border-slate-600 dark:hover:border-slate-500">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <Icons.upload className="w-8 h-8 mb-4 text-slate-500" />
                                            <p className="mb-2 text-sm text-slate-500 dark:text-slate-400 font-semibold">Click to upload documents</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">PDF, JPG, PNG or DOCX</p>
                                        </div>
                                        <input type="file" className="hidden" multiple onChange={handleDocumentUpload} />
                                    </label>
                                </div>
                            </div>
                            
                            {formData.documents && formData.documents.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {formData.documents.map((doc, idx) => (
                                        <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-xs">
                                            <span className="truncate max-w-[150px]" title={doc.name}>{doc.name}</span>
                                            <button type="button" onClick={() => removeDocument(idx)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row justify-end gap-3">
                        <button type="button" onClick={onClose} className="w-full sm:w-auto font-semibold py-2 px-6 rounded-lg transition-colors bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 order-2 sm:order-1">Cancel</button>
                        <button type="submit" className="w-full sm:w-auto font-semibold py-2 px-6 rounded-lg transition-colors bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-primary-600/50 order-1 sm:order-2">Save Student Records</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ResultsEditorModal: React.FC<{
    student: User;
    onClose: () => void;
}> = ({ student, onClose }) => {
    const [semester, setSemester] = useState(1);
    const [result, setResult] = useState<SBTETResult | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchResult = async () => {
        setLoading(true);
        const allResults = await getAllSbtetResultsForPin(student.pin);
        const existingResult = allResults.find(r => r.semester === semester);
        if (existingResult) {
            setResult(existingResult);
        } else {
            // Create default skeleton
            setResult({
                id: `res-${student.pin}-${semester}`,
                pin: student.pin,
                semester,
                subjects: [
                    { code: 'SUB-01', name: '', mid1: 0, mid2: 0, internal: 0, external: 0, total: 0, credits: 0 }
                ],
                totalMarks: 0,
                creditsEarned: 0,
                sgpa: 0,
                status: 'Fail'
            });
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchResult();
    }, [semester, student.pin]);

    const handleSubjectChange = (index: number, field: string, value: any) => {
        if (!result) return;
        const newSubjects = [...result.subjects];
        
        // Ensure values don't exceed max marks
        let sanitizedValue = Number(value);
        if (field === 'mid1' || field === 'mid2' || field === 'internal') {
            if (sanitizedValue > 20) sanitizedValue = 20;
        } else if (field === 'external') {
            if (sanitizedValue > 40) sanitizedValue = 40;
        }

        newSubjects[index] = { ...newSubjects[index], [field]: field === 'name' ? value : sanitizedValue };
        
        // Updated calculation: total = mid1 + mid2 + internal + external (Semester end)
        if (['mid1', 'mid2', 'internal', 'external'].includes(field)) {
            newSubjects[index].total = Number(newSubjects[index].mid1) + 
                                       Number(newSubjects[index].mid2) + 
                                       Number(newSubjects[index].internal) + 
                                       Number(newSubjects[index].external);
        }

        setResult({ ...result, subjects: newSubjects });
    };

    const addSubject = () => {
        if (!result) return;
        setResult({
            ...result,
            subjects: [...result.subjects, { code: `SUB-0${result.subjects.length+1}`, name: '', mid1: 0, mid2: 0, internal: 0, external: 0, total: 0, credits: 0 }]
        });
    };

    const removeSubject = (index: number) => {
        if (!result) return;
        setResult({
            ...result,
            subjects: result.subjects.filter((_, i) => i !== index)
        });
    };

    const handleSave = async () => {
        if (!result) return;
        setIsSaving(true);
        
        // Final calculations before saving
        const totalMarks = result.subjects.reduce((sum, s) => sum + s.total, 0);
        const creditsEarned = result.subjects.reduce((sum, s) => sum + (s.total >= 35 ? 4 : 0), 0);
        const isPass = result.subjects.every(s => s.total >= 35);

        const finalResult: SBTETResult = {
            ...result,
            totalMarks,
            creditsEarned,
            status: isPass ? 'Pass' : 'Fail'
        };

        await saveSbtetResult(finalResult);
        setIsSaving(false);
        alert(`SBTET results for Semester ${semester} saved successfully!`);
    };

    const inputClasses = "w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all";

    return (
        <Modal isOpen={true} onClose={onClose} title={`Edit SBTET Results: ${student.name}`} maxWidthClass="max-w-4xl">
            <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-4 scrollbar-thin">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b dark:border-slate-800 pb-6 gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Target Semester:</label>
                        <select 
                            value={semester} 
                            onChange={(e) => setSemester(Number(e.target.value))}
                            className="w-full sm:w-auto p-2.5 px-4 bg-slate-100 dark:bg-slate-800 border-none rounded-xl font-semibold focus:ring-2 focus:ring-primary-500 transition-shadow"
                        >
                            {[1, 2, 3, 4, 5, 6].map(s => <option key={s} value={s}>Semester {s}</option>)}
                        </select>
                    </div>
                    <div className="text-left sm:text-right w-full sm:w-auto">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">Total Subjects</p>
                        <p className="text-2xl font-black text-primary-500">{result?.subjects.length || 0}</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-semibold text-slate-500 animate-pulse">Synchronizing academic data...</p>
                    </div>
                ) : result && (
                    <div className="space-y-4">
                        <div className="hidden sm:grid grid-cols-12 gap-4 text-[11px] font-black text-slate-400 uppercase px-4 text-center">
                            <div className="col-span-4 text-left">Academic Subject</div>
                            <div className="col-span-1.5">Mid 1 (20)</div>
                            <div className="col-span-1.5">Mid 2 (20)</div>
                            <div className="col-span-1.5">Internal (20)</div>
                            <div className="col-span-1.5">Semester (40)</div>
                            <div className="col-span-2">Total Score</div>
                        </div>

                        <div className="space-y-3">
                            {result.subjects.map((sub, idx) => (
                                <div key={idx} className="flex flex-col sm:grid sm:grid-cols-12 gap-4 items-start sm:items-center bg-slate-100/50 dark:bg-slate-800/30 p-4 rounded-2xl relative group border border-transparent hover:border-primary-500/30 transition-all duration-300">
                                    <div className="w-full sm:col-span-4">
                                        <label className="block sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-1">Subject Name</label>
                                        <input 
                                            placeholder="Enter subject name..." 
                                            value={sub.name} 
                                            onChange={e => handleSubjectChange(idx, 'name', e.target.value)}
                                            className={inputClasses} 
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 sm:contents gap-4 w-full">
                                        <div className="sm:col-span-1.5">
                                            <label className="block sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-1">Mid 1</label>
                                            <input 
                                                type="number" 
                                                max={20}
                                                value={sub.mid1} 
                                                onChange={e => handleSubjectChange(idx, 'mid1', e.target.value)}
                                                className={`${inputClasses} text-center`} 
                                            />
                                        </div>
                                        <div className="sm:col-span-1.5">
                                            <label className="block sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-1">Mid 2</label>
                                            <input 
                                                type="number" 
                                                max={20}
                                                value={sub.mid2} 
                                                onChange={e => handleSubjectChange(idx, 'mid2', e.target.value)}
                                                className={`${inputClasses} text-center`} 
                                            />
                                        </div>
                                        <div className="sm:col-span-1.5">
                                            <label className="block sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-1">Internal</label>
                                            <input 
                                                type="number" 
                                                max={20}
                                                value={sub.internal} 
                                                onChange={e => handleSubjectChange(idx, 'internal', e.target.value)}
                                                className={`${inputClasses} text-center`} 
                                            />
                                        </div>
                                        <div className="sm:col-span-1.5">
                                            <label className="block sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-1">Semester</label>
                                            <input 
                                                type="number" 
                                                max={40}
                                                value={sub.external} 
                                                onChange={e => handleSubjectChange(idx, 'external', e.target.value)}
                                                className={`${inputClasses} text-center`} 
                                            />
                                        </div>
                                    </div>
                                    <div className="w-full sm:col-span-2 flex sm:flex-col items-center justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                                        <span className="sm:hidden text-xs font-bold text-slate-400 uppercase">Total Score</span>
                                        <div className="flex flex-col items-center">
                                            <span className="text-xl sm:text-2xl font-black text-primary-600 dark:text-primary-400">
                                                {sub.total}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sub.total >= 35 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                {sub.total >= 35 ? 'PASS' : 'FAIL'}
                                            </span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => removeSubject(idx)} 
                                        className="absolute -right-2 -top-2 bg-red-500 text-white rounded-full w-6 h-6 text-sm opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all transform scale-110 sm:scale-100 group-hover:scale-110 shadow-lg flex items-center justify-center font-bold z-10"
                                    >
                                        <Icons.close className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={addSubject}
                            className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-500 hover:text-primary-500 hover:border-primary-500 transition-all hover:bg-primary-500/5 flex items-center justify-center gap-2"
                        >
                            <PlusIcon className="w-5 h-5" /> Add Additional Subject
                        </button>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 sticky bottom-0 bg-white dark:bg-slate-900 pb-2 border-t dark:border-slate-800">
                    <button onClick={onClose} className="w-full sm:w-auto px-6 py-3 text-sm font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors order-2 sm:order-1">Discard Changes</button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving || loading}
                        className="w-full sm:w-auto px-10 py-3 text-sm font-bold rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 shadow-xl shadow-primary-600/20 active:scale-95 transition-all order-1 sm:order-2"
                    >
                        {isSaving ? 'Finalizing...' : 'Commit Results to Database'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const AuthModal: React.FC<{
    action: string;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ action, onClose, onSuccess }) => (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={onClose}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 w-full max-sm text-center animate-fade-in-down" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-2">Principal Authentication</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">Please verify your identity to {action}.</p>
            <div className="p-4 border-2 border-dashed rounded-lg border-slate-300 dark:border-slate-600">
                 <p className="font-semibold text-primary-500">Biometric / OTP</p>
                 <p className="text-xs text-slate-500">This is a simulated authentication step.</p>
            </div>
            <div className="mt-6 flex justify-center gap-4">
                <button type="button" onClick={onClose} className="font-semibold py-2 px-4 rounded-lg transition-colors bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">Cancel</button>
                <button type="button" onClick={onSuccess} className="font-semibold py-2 px-4 rounded-lg transition-colors bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-primary-500/50">Authenticate</button>
            </div>
        </div>
    </div>
);


const UserDetailModal: React.FC<{
    user: User;
    currentUser: User | null;
    colleges: College[];
    onClose: () => void;
    onEdit: (user: User) => void;
    onDelete: (user: User) => void;
    onGenerateId: () => void;
    onResults: () => void;
}> = ({ user, currentUser, colleges, onClose, onEdit, onDelete, onGenerateId, onResults }) => {
    const isBhanuAdmin = currentUser?.pin === 'bhanu99517';
    const canManage = (currentUser?.role === Role.SUPER_ADMIN || currentUser?.role === Role.PRINCIPAL || currentUser?.role === Role.HOD || currentUser?.role === Role.FACULTY) && !isBhanuAdmin;
    const collegeName = colleges.find(c => c.id === user.collegeId)?.name || 'N/A';

    const DetailItem = ({ label, value, icon: Icon }: { label: string, value: string | number | undefined, icon?: any }) => (
        <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
            {Icon && <Icon className="w-5 h-5 text-primary-500 mt-0.5 shrink-0" />}
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">{value || 'Not Provided'}</p>
            </div>
        </div>
    );

    return (
        <Modal isOpen={true} onClose={onClose} title="User Profile Details" maxWidthClass="max-w-2xl">
            <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
                {/* Header Profile Section */}
                <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-gradient-to-br from-primary-500/10 to-indigo-500/10 rounded-3xl border border-primary-500/20">
                    <img src={user.imageUrl || createAvatar(user.name) || null} alt={user.name} className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl object-cover ring-4 ring-white dark:ring-slate-800 shadow-2xl" />
                    <div className="text-center sm:text-left flex-1 min-w-0">
                        <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate">{user.name}</h3>
                        <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
                            <RolePill role={user.role} />
                            <span className="px-3 py-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-full text-xs font-bold text-primary-600 border border-primary-500/20">
                                {user.branch} Department
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 font-mono font-bold">{user.pin}</p>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailItem label="College" value={collegeName} icon={Icons.college} />
                    <DetailItem label="Email" value={user.email} icon={Icons.email} />
                    <DetailItem label="Phone Number" value={user.phoneNumber} icon={Icons.whatsapp} />
                    {user.role === Role.STUDENT && (
                        <>
                            <DetailItem label="Father's Name" value={user.fatherName} icon={Icons.users} />
                            <DetailItem label="Parent Phone" value={user.parentPhoneNumber} icon={Icons.whatsapp} />
                            <DetailItem label="Parent Email" value={user.parent_email} icon={Icons.email} />
                            <DetailItem label="Aadhar Number" value={user.aadharNumber} icon={Icons.idCard} />
                            <DetailItem label="10th Marks" value={user.tenthMarks} icon={Icons.syllabus} />
                        </>
                    )}
                </div>

                {/* Documents Section */}
                {user.documents && user.documents.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Uploaded Documents</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {user.documents.map((doc, idx) => (
                                <a 
                                    key={idx} 
                                    href={doc.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors group"
                                >
                                    <Icons.document className="w-5 h-5 text-slate-400 group-hover:text-primary-500" />
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{doc.name}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-6 border-t dark:border-slate-800">
                    {isBhanuAdmin && (
                        <button 
                            onClick={() => { onClose(); onResults(); }}
                            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20"
                        >
                            <Icons.results className="w-5 h-5" /> SBTET Results
                        </button>
                    )}
                    {!isBhanuAdmin && canManage && (
                        <>
                            <button 
                                onClick={() => { onClose(); onEdit(user); }}
                                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                <EditIcon className="w-5 h-5" /> Edit Profile
                            </button>
                            {user.role === Role.STUDENT && (
                                <button 
                                    onClick={() => { onClose(); onGenerateId(); }}
                                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                                >
                                    <IdCardIcon className="w-5 h-5" /> ID Card
                                </button>
                            )}
                            <button 
                                onClick={() => { onClose(); onDelete(user); }}
                                className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
                            >
                                <DeleteIcon className="w-5 h-5" /> Delete
                            </button>
                        </>
                    )}
                    <button 
                        onClick={onClose}
                        className="w-full py-3 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all mt-2"
                    >
                        Close Profile
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const ManageUsersPage: React.FC<{ user: User | null }> = ({ user: authenticatedUser }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [colleges, setColleges] = useState<College[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<string>('23'); // Default to current 23 batch
    const [selectedCollegeId, setSelectedCollegeId] = useState<string>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [modalState, setModalState] = useState<{ type: 'form' | 'auth' | 'results' | 'detail' | null, user?: User | null, action?: string, isDelete?: boolean }>({ type: null });
    
    const fetchUsers = () => getUsers().then(setAllUsers);
    const fetchColleges = () => getColleges().then(setColleges);

    useEffect(() => {
        fetchUsers();
        fetchColleges();
        
        const params = new URLSearchParams(location.search);
        const collegeIdFromUrl = params.get('collegeId');

        if (authenticatedUser?.role === Role.PRINCIPAL && authenticatedUser.collegeId) {
            setSelectedCollegeId(authenticatedUser.collegeId);
        } else if (collegeIdFromUrl) {
            setSelectedCollegeId(collegeIdFromUrl);
        }
    }, [authenticatedUser, location.search]);

    const isBhanuAdmin = authenticatedUser?.pin === 'bhanu99517';
    const isPrincipal = authenticatedUser?.role === Role.PRINCIPAL;

    const { faculty, staff, students } = useMemo(() => {
        // Requirements: Exclude bhanu99517 from display
        let displayableUsers = allUsers.filter(u => u.pin !== 'bhanu99517');
        
        // If principal, strictly filter by their college
        if (isPrincipal && authenticatedUser?.collegeId) {
            displayableUsers = displayableUsers.filter(u => u.collegeId === authenticatedUser.collegeId);
        } else if (selectedCollegeId !== 'All') {
            displayableUsers = displayableUsers.filter(u => u.collegeId === selectedCollegeId);
        }

        // Enhanced Search: Filter by name, pin, email, and phone number
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            displayableUsers = displayableUsers.filter(u => 
                u.name.toLowerCase().includes(lowSearch) ||
                u.pin.toLowerCase().includes(lowSearch) ||
                (u.email && u.email.toLowerCase().includes(lowSearch)) ||
                (u.phoneNumber && u.phoneNumber.includes(lowSearch))
            );
        }

        const principal = displayableUsers.find(u => u.role === Role.PRINCIPAL);
        
        const rawStudents = displayableUsers.filter(u => u.role === Role.STUDENT);
        const filteredStudents = selectedBatch === 'All' 
            ? rawStudents 
            : rawStudents.filter(s => s.pin.startsWith(selectedBatch));

        return {
            faculty: [principal, ...displayableUsers.filter(u => u.role === Role.HOD || u.role === Role.FACULTY)].filter(Boolean) as User[],
            staff: displayableUsers.filter(u => u.role === Role.STAFF),
            students: filteredStudents
        };
    }, [allUsers, selectedBatch, selectedCollegeId, isPrincipal, authenticatedUser?.collegeId, searchTerm]);

    const canManageFacultyOrStaff = (authenticatedUser?.role === Role.PRINCIPAL || authenticatedUser?.role === Role.SUPER_ADMIN) && !isBhanuAdmin;
    const canManageStudents = authenticatedUser?.role === Role.PRINCIPAL || authenticatedUser?.role === Role.FACULTY || authenticatedUser?.role === Role.HOD || authenticatedUser?.role === Role.SUPER_ADMIN;

    const handleAction = (action: 'add' | 'edit' | 'delete' | 'results', userToManage: User | null, requiresAuth: boolean) => {
        if (action === 'results' && userToManage) {
            setModalState({ type: 'results', user: userToManage });
            return;
        }

        if (requiresAuth && authenticatedUser?.role !== Role.SUPER_ADMIN) {
            const actionText = action === 'add' ? 'add a new user' : `${action} ${userToManage?.name}`;
            setModalState({ type: 'auth', user: userToManage, action: actionText, isDelete: action === 'delete' });
        } else {
             if (action === 'delete' && userToManage) {
                 if(window.confirm(`Are you sure you want to delete ${userToManage.name}? This action cannot be undone.`)) {
                    deleteUser(userToManage.id).then(fetchUsers);
                 }
             } else {
                setModalState({ type: 'form', user: userToManage });
             }
        }
    };

    const handleGenerateIdCard = async (userToGenerate: User) => {
        try {
            await generateIdCard(userToGenerate);
        } catch (error) {
            console.error("Failed to generate ID card:", error);
            alert(`Could not generate ID card. See console for details.`);
        }
    };
    
    const handleAuthSuccess = () => {
        if (modalState.isDelete && modalState.user) {
            deleteUser(modalState.user.id).then(() => {
                setModalState({ type: null });
                fetchUsers();
            });
        } else {
             setModalState(prev => ({ ...prev, type: 'form' }));
        }
    };

    const handleSaveUser = async (userToSave: User) => {
        if (userToSave.id.startsWith('new_')) {
            await addUser(userToSave);
        } else {
            await updateUser(userToSave.id, userToSave);
        }
        setModalState({ type: null });
        fetchUsers();
    };

    const handleExportStudents = () => {
        const activeBatches = ['23', '24', '25'];
        const exportData = students.filter(s => activeBatches.some(b => s.pin.startsWith(b)));
        
        if (exportData.length === 0) {
            alert("No active students found to export.");
            return;
        }

        const headers = ["Name", "PIN", "Branch", "Email", "Phone", "Father Name", "Aadhar"];
        const rows = exportData.map(s => [
            s.name,
            s.pin,
            s.branch,
            s.email || '',
            s.phoneNumber || '',
            s.fatherName || '',
            s.aadharNumber || ''
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.map(cell => `"${cell}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Students_Export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalPages = Math.ceil(students.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedStudents = students.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedBatch, selectedCollegeId]);


    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {/* System Admin Header with College Filter */}
            {isBhanuAdmin && (
                <div className="mb-8 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-primary-500/20">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/manage-colleges')}
                            className="p-3 bg-slate-100 dark:bg-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 transition-all shrink-0"
                            title="Back to Colleges"
                        >
                            <Icons.logout className="w-6 h-6 rotate-180" />
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">System Administration</h2>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">Filter and manage users across all registered colleges.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 shrink-0">College Filter:</label>
                        <select 
                            value={selectedCollegeId} 
                            onChange={(e) => setSelectedCollegeId(e.target.value)}
                            className="flex-1 sm:flex-none p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-primary-600 focus:ring-2 focus:ring-primary-500 outline-none transition-all sm:min-w-[200px]"
                        >
                            <option value="All">All Colleges</option>
                            {colleges.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                            ))}
                        </select>
                    </div>
                </div>
                </div>
            )}

            {/* Principal Header */}
            {isPrincipal && (
                <div className="mb-8 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-indigo-500/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl text-indigo-600">
                            <Icons.college className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">College Administration</h2>
                            <p className="text-slate-500 dark:text-slate-400">
                                Principal of: <span className="font-bold text-indigo-600">{colleges.find(c => c.id === authenticatedUser?.collegeId)?.name}</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Bar */}
            <div className="mb-8 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="relative flex-grow">
                    <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search by Name, PIN, Email, or Phone Number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    />
                </div>
                {searchTerm && (
                    <button 
                        onClick={() => setSearchTerm('')}
                        className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-primary-600 transition-colors"
                    >
                        Clear
                    </button>
                )}
            </div>

            <div className="space-y-8">
                {/* Specific restriction for bhanu99517 admin: hide faculty and staff management */}
                {!isBhanuAdmin && (
                    <>
                        <UserTable 
                            title="Faculty & Leadership" 
                            users={faculty} 
                            colleges={colleges}
                            canManage={canManageFacultyOrStaff}
                            onAdd={() => handleAction('add', null, true)}
                            onDetail={(user) => setModalState({ type: 'detail', user })}
                        />
                        
                        <UserTable 
                            title="Administrative Staff" 
                            users={staff} 
                            colleges={colleges}
                            canManage={canManageFacultyOrStaff}
                            onAdd={() => handleAction('add', null, true)}
                            onDetail={(user) => setModalState({ type: 'detail', user })}
                        />
                    </>
                )}

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl text-primary-600">
                                <Icons.users className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Student Directory</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Batch:</label>
                                    <select 
                                        value={selectedBatch} 
                                        onChange={(e) => setSelectedBatch(e.target.value)}
                                        className="bg-transparent border-none p-0 text-xs font-bold text-primary-600 focus:ring-0 cursor-pointer"
                                    >
                                        <optgroup label="Active Batches">
                                            <option value="25">25 Batch</option>
                                            <option value="24">24 Batch</option>
                                            <option value="23">23 Batch</option>
                                        </optgroup>
                                        <optgroup label="Completed Batches (Alumni)">
                                            <option value="22">22 Batch</option>
                                            <option value="21">21 Batch</option>
                                            <option value="20">20 Batch</option>
                                        </optgroup>
                                        <option value="All">All Students</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button 
                                onClick={handleExportStudents}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition-all text-sm border border-emerald-500/20"
                                title="Export Active Students to CSV"
                            >
                                <Icons.download className="w-4 h-4" /> Export CSV
                            </button>
                            {canManageStudents && !isBhanuAdmin && (
                                <button 
                                    onClick={() => handleAction('add', null, false)} 
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 text-sm"
                                >
                                    <PlusIcon className="w-5 h-5" /> Add New
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        {paginatedStudents.map(user => (
                            <div 
                                key={user.id} 
                                onClick={() => setModalState({ type: 'detail', user })}
                                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-primary-500/50 hover:shadow-md transition-all cursor-pointer group min-w-0"
                            >
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <img className="h-12 w-12 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-700 group-hover:ring-primary-500/30 transition-all shrink-0" src={user.imageUrl || createAvatar(user.name) || null} alt={user.name} />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{user.name}</div>
                                        <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 truncate">{user.pin}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <RolePill role={user.role}/>
                                    <Icons.chevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary-500 transition-colors" />
                                </div>
                            </div>
                        ))}
                        {students.length === 0 && <p className="text-center py-10 text-slate-500">No students found for {selectedBatch} Batch.</p>}
                    </div>

                    {totalPages > 1 && (
                        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-50 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <Icons.chevronLeft className="w-5 h-5" />
                                </button>
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400">
                                    <div className="flex items-center gap-1">
                                        <span className="mx-[5px]">Page</span>
                                        <input 
                                            type="number" 
                                            value={currentPage} 
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                if (val > 0 && val <= totalPages) setCurrentPage(val);
                                            }}
                                            className="w-[49px] p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-center outline-none focus:ring-1 focus:ring-primary-500"
                                        />
                                        <span className="mx-[5px]">of {totalPages}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-50 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <Icons.chevronRight className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, students.length)} of {students.length} Students
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {modalState.type === 'detail' && modalState.user && (
                <UserDetailModal
                    user={modalState.user}
                    currentUser={authenticatedUser}
                    colleges={colleges}
                    onClose={() => setModalState({ type: null })}
                    onEdit={(u) => handleAction('edit', u, false)}
                    onDelete={(u) => handleAction('delete', u, false)}
                    onGenerateId={() => handleGenerateIdCard(modalState.user!)}
                    onResults={() => handleAction('results', modalState.user!, false)}
                />
            )}

            {modalState.type === 'auth' && (
                <AuthModal
                    action={modalState.action!}
                    onClose={() => setModalState({ type: null })}
                    onSuccess={handleAuthSuccess}
                />
            )}
            
            {modalState.type === 'form' && (
                <UserFormModal
                    user={modalState.user}
                    currentUser={authenticatedUser}
                    colleges={colleges}
                    onClose={() => setModalState({ type: null })}
                    onSave={handleSaveUser}
                />
            )}

            {modalState.type === 'results' && modalState.user && (
                <ResultsEditorModal 
                    student={modalState.user} 
                    onClose={() => setModalState({ type: null })} 
                />
            )}
        </div>
    );
};

const UserTable: React.FC<{
    title: string;
    users: User[];
    colleges: College[];
    canManage: boolean;
    onAdd: () => void;
    onDetail: (user: User) => void;
}> = ({ title, users, colleges, canManage, onAdd, onDetail }) => (
     <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h3>
            {canManage && (
                <button onClick={onAdd} className="font-semibold py-2 px-4 rounded-lg transition-colors bg-primary-600 text-white hover:bg-primary-700 shadow-lg flex items-center gap-2">
                    <PlusIcon className="w-5 h-5" /> Add New
                </button>
            )}
        </div>
        <div className="space-y-2">
            {users.map(user => (
                <div 
                    key={user.id} 
                    onClick={() => onDetail(user)}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-primary-500/50 hover:shadow-md transition-all cursor-pointer group min-w-0"
                >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <img className="h-12 w-12 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 group-hover:ring-primary-500/30 transition-all shrink-0" src={user.imageUrl || createAvatar(user.name) || null} alt={user.name} />
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{user.name}</div>
                            <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 truncate">{user.pin}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <RolePill role={user.role}/>
                        <Icons.chevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary-500 transition-colors" />
                    </div>
                </div>
            ))}
            {users.length === 0 && <p className="text-center py-6 text-slate-500 text-sm">No records found in this category.</p>}
        </div>
    </div>
);

export default ManageUsersPage;
