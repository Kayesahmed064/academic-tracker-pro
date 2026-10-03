import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Edit3,
  Save,
  X,
  Target,
  Mail,
  Phone,
  MapPin,
  Camera,
  LogOut,
  LogIn,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export const Profile = () => {
  const {
    data,
    updateProfile,
    currentUser,
    logout,
    profileSyncing,
    authError,
    clearAuthError,
    setHasSkippedAuth,
  } = useApp();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(data.profile);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditForm(data.profile);
    }
  }, [data.profile, isEditing]);

  const handleSave = () => {
    updateProfile(editForm);
    setIsEditing(false);
  };

  const handleEditClick = () => {
    setEditForm(data.profile);
    setIsEditing(true);
  };

  const handleImageClick = () => {
    setImageError(null);
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 350 * 1024) {
        setImageError('Image size should be less than 350KB.');
        return;
      }

      setImageError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        updateProfile({
          ...data.profile,
          profilePic: base64String
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageChange}
        accept="image/*"
        className="hidden"
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Student Profile</h1>
          {profileSyncing && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-xl">
              <Loader2 size={14} className="animate-spin" />
              Syncing...
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleEditClick}
            className="flex items-center gap-2 bg-primary/10 text-primary px-6 py-3 rounded-2xl font-bold hover:bg-primary hover:text-white transition-all cursor-pointer"
          >
            <Edit3 size={20} />
            Edit Profile
          </button>
          {currentUser ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-500/10 text-red-500 px-5 py-3 rounded-2xl font-bold hover:bg-red-500 hover:text-white transition-all cursor-pointer"
            >
              <LogOut size={18} />
              Logout
            </button>
          ) : (
            <button
              onClick={() => {
                setHasSkippedAuth(false);
                navigate('/login');
              }}
              className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-bold hover:shadow-lg transition-all cursor-pointer"
            >
              <LogIn size={18} />
              Sign In
            </button>
          )}
        </div>
      </div>

      {(imageError || authError) && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-between gap-3 text-sm font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{imageError || authError}</span>
          </div>
          <button
            onClick={() => {
              setImageError(null);
              clearAuthError();
            }}
            className="p-1 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="m3-card text-center p-8">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="w-full h-full rounded-3xl bg-primary/10 flex items-center justify-center text-4xl font-black text-primary overflow-hidden">
                {data.profile.profilePic ? (
                  <img src={data.profile.profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (data.profile.name?.[0] || 'S')
                )}
              </div>
              <button 
                onClick={handleImageClick}
                className="absolute -bottom-2 -right-2 p-2 bg-primary text-white rounded-xl shadow-lg hover:scale-110 transition-transform"
              >
                <Camera size={16} />
              </button>
            </div>
            <h2 className="text-2xl font-bold">{data.profile.name}</h2>
            <p className="text-muted-foreground font-medium">{data.profile.greeting}</p>
          </div>

          <div className="m3-card space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quick Stats</h3>
            <div className="flex items-center justify-between p-3 bg-muted rounded-2xl">
              <div className="flex items-center gap-3">
                <Target size={18} className="text-primary" />
                <span className="text-sm font-bold">Target GPA</span>
              </div>
              <span className="font-black text-primary">{data.profile.targetGPA.toFixed(2)}</span>
            </div>
            {currentUser && (
              <div className="p-3 bg-muted rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-primary">
                  <ShieldCheck size={16} />
                  <span className="text-xs font-bold uppercase">Firebase Authenticated</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono truncate" title={currentUser.uid}>
                  UID: {currentUser.uid}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono truncate">
                  Path: users/{currentUser.uid}/profile
                </p>
              </div>
            )}
          </div>
        </div>


        {/* Details Section */}
        <div className="md:col-span-2 space-y-6">
          <div className="m3-card space-y-6">
            <h3 className="text-xl font-bold border-b border-border pb-4">Academic Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase">Student ID</p>
                <p className="font-bold">{data.profile.studentId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase">Department</p>
                <p className="font-bold">{data.profile.department}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase">Semester</p>
                <p className="font-bold">{data.profile.semester}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase">Batch</p>
                <p className="font-bold">{data.profile.batch}</p>
              </div>
            </div>
          </div>

          <div className="m3-card space-y-6">
            <h3 className="text-xl font-bold border-b border-border pb-4">Contact Details</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Email Address</p>
                  <p className="font-bold">{data.profile.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Phone Number</p>
                  <p className="font-bold">{data.profile.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Address</p>
                  <p className="font-bold">{data.profile.address}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start justify-center p-6 overflow-y-auto pt-[calc(env(safe-area-inset-top,0px)+4rem)] pb-[calc(env(safe-area-inset-bottom,0px)+4rem)]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-2xl rounded-3xl p-10 shadow-2xl border border-border mb-12"
            >
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl font-bold">Edit Profile</h2>
                <button onClick={() => setIsEditing(false)} className="p-3 hover:bg-muted rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6">Basic Info</h3>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold mb-4 uppercase text-muted-foreground">Display Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold mb-4 uppercase text-muted-foreground">Welcome Greeting</label>
                    <input
                      type="text"
                      value={editForm.greeting}
                      onChange={e => setEditForm({ ...editForm, greeting: e.target.value })}
                      className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold mb-4 uppercase text-muted-foreground">Target GPA (0.00 - 4.00)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="4"
                      value={editForm.targetGPA}
                      onChange={e => setEditForm({ ...editForm, targetGPA: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-8">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6">Academic Info</h3>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold mb-4 uppercase text-muted-foreground">Student ID</label>
                    <input
                      type="text"
                      value={editForm.studentId}
                      onChange={e => setEditForm({ ...editForm, studentId: e.target.value })}
                      className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold mb-4 uppercase text-muted-foreground">Semester</label>
                    <select
                      value={editForm.semester}
                      onChange={e => setEditForm({ ...editForm, semester: e.target.value })}
                      className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold appearance-none"
                    >
                      {Array.from({ length: 8 }, (_, i) => {
                        const s = `${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'} Semester`;
                        return <option key={s} value={s}>{s}</option>;
                      })}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold mb-4 uppercase text-muted-foreground">Batch</label>
                    <input
                      type="text"
                      value={editForm.batch}
                      onChange={e => setEditForm({ ...editForm, batch: e.target.value })}
                      className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 space-y-8">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6">Contact Info</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="block text-xs font-bold mb-4 uppercase text-muted-foreground">Email Address</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="block text-xs font-bold mb-4 uppercase text-muted-foreground">Phone Number</label>
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold mb-4 uppercase text-muted-foreground">Address</label>
                    <textarea
                      value={editForm.address}
                      onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                      className="w-full bg-muted border-none rounded-2xl p-4 focus:ring-2 focus:ring-primary outline-none font-bold min-h-[120px] resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-8">
                <button 
                  onClick={() => setIsEditing(false)} 
                  className="flex-1 py-4 rounded-2xl font-bold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave} 
                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
