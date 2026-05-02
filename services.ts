/**
 * services.ts — Supabase Backend
 *
 * All mock data and MockStorage have been replaced with real Supabase queries.
 * Face recognition now uses face-api.js (local models) instead of Gemini AI.
 */

import {
  User, Role, Branch, AttendanceRecord, Application, PPTContent,
  QuizContent, LessonPlanContent, ApplicationStatus, ApplicationType,
  SBTETResult, SyllabusCoverage, Timetable, Feedback, AppSettings, College,
} from './types';
import { aiClientState } from './geminiClient';
import { Type } from '@google/genai';
import { supabase, uploadFile, deleteFile, STORAGE_BUCKETS } from './supabaseClient';
import {
  loadFaceModels,
  verifyFaceAgainstDescriptor,
  verifyFaceAgainstUrl,
  computeDescriptorFromBlob,
  computeFaceDescriptor,
  descriptorToArray,
  arrayToDescriptor,
  FaceVerificationResult,
} from './faceRecognition';

// Preload face models in the background on app start
loadFaceModels().catch(err => console.warn('[FaceRecognition] Background preload failed:', err));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createAvatar = (seed: string) =>
  `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(seed)}`;

const mapDbUser = (row: any): User => ({
  id: row.id,
  pin: row.pin,
  name: row.name,
  role: row.role as Role,
  branch: row.branch,
  year: row.year,
  college_code: row.college_code,
  collegeId: row.college_id,
  email: row.email,
  email_verified: row.email_verified,
  parent_email: row.parent_email,
  parent_email_verified: row.parent_email_verified,
  phoneNumber: row.phone_number,
  imageUrl: row.image_url,
  referenceImageUrl: row.reference_image_url,
  password: row.password,
  fatherName: row.father_name,
  aadharNumber: row.aadhar_number,
  parentPhoneNumber: row.parent_phone_number,
  tenthMarks: row.tenth_marks,
  documents: row.documents || [],
});

const mapDbAttendance = (row: any): AttendanceRecord => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  userPin: row.user_pin,
  userAvatar: row.user_avatar || createAvatar(row.user_name),
  date: row.date,
  status: row.status as 'Present' | 'Absent',
  timestamp: row.timestamp,
  location: row.location_status
    ? {
        status: row.location_status as 'On-Campus' | 'Off-Campus',
        coordinates: row.location_coordinates,
        distance_km: row.distance_km,
      }
    : undefined,
});

const mapDbCollege = (row: any): College => ({
  id: row.id,
  name: row.name,
  code: row.code,
  location: row.location,
  latitude: row.latitude,
  longitude: row.longitude,
  radius: row.radius,
});

// ─── Geo Helpers ──────────────────────────────────────────────────────────────

export const CAMPUS_LAT = 18.4550;
export const CAMPUS_LON = 79.5217;
export const CAMPUS_RADIUS_KM = 0.5;

export const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export const login = async (
  pin: string,
  pass: string
): Promise<User | { otpRequired: true; user: User } | null> => {
  const allowedRoles: Role[] = [Role.SUPER_ADMIN, Role.PRINCIPAL, Role.FACULTY, Role.HOD, Role.STAFF];

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('pin', pin)
    .eq('password', pass)
    .single();

  if (error || !data) return null;
  const user = mapDbUser(data);
  if (!allowedRoles.includes(user.role)) return null;

  if (user.role === Role.SUPER_ADMIN && user.pin === 'bhanu99517') {
    return { otpRequired: true, user };
  }
  return user;
};

export const sendLoginOtp = async (user: User): Promise<{ success: boolean }> => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await supabase.from('otp_store').upsert({ user_id: user.id, otp, expires_at: expiresAt });

  const subject = 'Your Mira Attendance Login OTP';
  const body = `Hello ${user.name},\n\nYour OTP is: ${otp}\n\nValid for 5 minutes.\n\nMira Attendance`;
  await sendEmail(user.email || 'bhanu99517@gmail.com', subject, body);
  return { success: true };
};

export const verifyLoginOtp = async (userId: string, otp: string): Promise<User | null> => {
  const { data } = await supabase.from('otp_store').select('*').eq('user_id', userId).single();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date() || data.otp !== otp) return null;

  await supabase.from('otp_store').delete().eq('user_id', userId);
  const { data: userData } = await supabase.from('users').select('*').eq('id', userId).single();
  return userData ? mapDbUser(userData) : null;
};

export const sendEmail = async (to: string, subject: string, body: string): Promise<{ success: boolean }> => {
  // Integrate with Supabase Edge Function + Resend/SendGrid for production
  console.log('[Email]', { to, subject, body });
  return { success: true };
};

// ─── USERS ────────────────────────────────────────────────────────────────────

export const getStudentByPin = async (pin: string): Promise<User | null> => {
  const { data } = await supabase.from('users').select('*').ilike('pin', pin).eq('role', 'STUDENT').single();
  return data ? mapDbUser(data) : null;
};

export const getUserByPin = async (pin: string): Promise<User | null> => {
  const { data } = await supabase.from('users').select('*').ilike('pin', pin).single();
  return data ? mapDbUser(data) : null;
};

export const getUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users').select('*').neq('pin', 'bhanu99517').order('name');
  if (error) throw new Error(error.message);
  return (data || []).map(mapDbUser);
};

export const getFaculty = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users').select('*').in('role', ['FACULTY', 'PRINCIPAL', 'HOD']).neq('pin', 'bhanu99517').order('name');
  if (error) throw new Error(error.message);
  return (data || []).map(mapDbUser);
};

export const addUser = async (user: User): Promise<User> => {
  const { data, error } = await supabase.from('users').insert({
    pin: user.pin,
    name: user.name,
    role: user.role,
    branch: user.branch,
    year: user.year || null,
    college_id: user.collegeId || null,
    college_code: user.college_code || null,
    email: user.email || null,
    email_verified: user.email_verified || false,
    parent_email: user.parent_email || null,
    parent_email_verified: user.parent_email_verified || false,
    phone_number: user.phoneNumber || null,
    image_url: user.imageUrl || createAvatar(user.name),
    reference_image_url: user.referenceImageUrl || null,
    password: user.password || 'mira@1234',
    father_name: user.fatherName || null,
    aadhar_number: user.aadharNumber || null,
    parent_phone_number: user.parentPhoneNumber || null,
    tenth_marks: user.tenthMarks || null,
    documents: user.documents || [],
  }).select().single();

  if (error) throw new Error(error.message);
  return mapDbUser(data);
};

export const updateUser = async (id: string, userData: User): Promise<User> => {
  const { data, error } = await supabase.from('users').update({
    pin: userData.pin,
    name: userData.name,
    role: userData.role,
    branch: userData.branch,
    year: userData.year || null,
    college_id: userData.collegeId || null,
    college_code: userData.college_code || null,
    email: userData.email || null,
    email_verified: userData.email_verified,
    parent_email: userData.parent_email || null,
    parent_email_verified: userData.parent_email_verified,
    phone_number: userData.phoneNumber || null,
    image_url: userData.imageUrl || null,
    reference_image_url: userData.referenceImageUrl || null,
    password: userData.password,
    father_name: userData.fatherName || null,
    aadhar_number: userData.aadharNumber || null,
    parent_phone_number: userData.parentPhoneNumber || null,
    tenth_marks: userData.tenthMarks || null,
    documents: userData.documents || [],
  }).eq('id', id).select().single();

  if (error) throw new Error(error.message);
  return mapDbUser(data);
};

export const deleteUser = async (id: string): Promise<{ success: boolean }> => {
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
};

export const changePassword = async (
  userId: string, oldPass: string, newPass: string
): Promise<{ success: boolean; message: string }> => {
  const { data } = await supabase.from('users').select('password').eq('id', userId).single();
  if (!data) return { success: false, message: 'User not found' };
  if (data.password !== oldPass) return { success: false, message: 'Incorrect old password' };

  const { error } = await supabase.from('users').update({ password: newPass }).eq('id', userId);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Password changed successfully' };
};

// ─── FACE RECOGNITION ────────────────────────────────────────────────────────

export const storeFaceDescriptor = async (userId: string, referenceImageUrl: string): Promise<boolean> => {
  try {
    await loadFaceModels();
    const descriptor = await computeFaceDescriptor(referenceImageUrl);
    if (!descriptor) return false;

    const { error } = await supabase
      .from('users').update({ face_descriptor: descriptorToArray(descriptor) }).eq('id', userId);
    return !error;
  } catch {
    return false;
  }
};

export const uploadReferenceImage = async (
  userId: string, imageBlob: Blob
): Promise<{ imageUrl: string; descriptorStored: boolean }> => {
  const fileName = `${userId}-${Date.now()}.jpg`;
  const imageUrl = await uploadFile(STORAGE_BUCKETS.REFERENCES, fileName, imageBlob, 'image/jpeg');
  await supabase.from('users').update({ reference_image_url: imageUrl }).eq('id', userId);
  const descriptorStored = await storeFaceDescriptor(userId, imageUrl);
  return { imageUrl, descriptorStored };
};

export const verifyStudentFace = async (
  student: User, livePhotoBlob: Blob
): Promise<FaceVerificationResult> => {
  await loadFaceModels();

  const { data } = await supabase
    .from('users').select('face_descriptor').eq('id', student.id).single();

  if (data?.face_descriptor?.length === 128) {
    return verifyFaceAgainstDescriptor(data.face_descriptor, livePhotoBlob);
  }

  if (student.referenceImageUrl) {
    const result = await verifyFaceAgainstUrl(student.referenceImageUrl, livePhotoBlob);
    // Opportunistically store for next time
    storeFaceDescriptor(student.id, student.referenceImageUrl).catch(() => {});
    return result;
  }

  return {
    isMatch: false, distance: 1, confidence: 0, quality: 'POOR',
    reason: 'No reference image or face descriptor found. Please register a reference photo.',
  };
};

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────

export const getDashboardStats = async () => {
  const today = new Date().toISOString().split('T')[0];
  const activeBatches = ['23', '24', '25'];

  const { count: totalCount } = await supabase
    .from('users').select('id', { count: 'exact', head: true })
    .eq('role', 'STUDENT')
    .or(activeBatches.map(b => `pin.ilike.${b}%`).join(','));

  const { data: todayRecords } = await supabase
    .from('attendance_records')
    .select('user_id, status, users!inner(pin)')
    .eq('date', today).eq('status', 'Present');

  const presentCount = (todayRecords || []).filter(r =>
    activeBatches.some(b => ((r as any).users?.pin || '').startsWith(b))
  ).length;

  const total = totalCount || 0;
  return {
    presentToday: presentCount,
    absentToday: total - presentCount,
    attendancePercentage: total > 0 ? Math.round((presentCount / total) * 100) : 0,
  };
};

export const getAttendanceForDate = async (date: string): Promise<AttendanceRecord[]> => {
  const { data, error } = await supabase
    .from('attendance_records').select('*').eq('date', date).order('timestamp', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapDbAttendance);
};

export const getAttendanceForDateRange = async (startDate: string, endDate: string): Promise<AttendanceRecord[]> => {
  const { data, error } = await supabase
    .from('attendance_records').select('*')
    .gte('date', startDate).lte('date', endDate)
    .order('date', { ascending: false }).order('timestamp', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapDbAttendance);
};

export const getTodaysAttendanceForUser = async (userId: string): Promise<AttendanceRecord | null> => {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('attendance_records').select('*').eq('user_id', userId).eq('date', today).single();
  return data ? mapDbAttendance(data) : null;
};

export const getAttendanceForUser = async (userId: string): Promise<AttendanceRecord[]> => {
  const { data, error } = await supabase
    .from('attendance_records').select('*').eq('user_id', userId).order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapDbAttendance);
};

export const markAttendance = async (
  userId: string,
  coordinates: { latitude: number; longitude: number } | null
): Promise<AttendanceRecord> => {
  const today = new Date();
  const dateString = today.toISOString().split('T')[0];
  const timeString = today.toTimeString().split(' ')[0];

  // Check duplicate
  const { data: existing } = await supabase
    .from('attendance_records').select('*').eq('user_id', userId).eq('date', dateString).single();
  if (existing) return mapDbAttendance(existing);

  const { data: userRow } = await supabase
    .from('users').select('*, colleges(*)').eq('id', userId).single();
  if (!userRow) throw new Error('User not found');

  let locationStatus: 'On-Campus' | 'Off-Campus' = 'Off-Campus';
  let locationCoordinates: string | undefined;
  let distanceKm: number | undefined;

  if (coordinates) {
    const college = (userRow as any).colleges;
    const campusLat = college?.latitude ?? CAMPUS_LAT;
    const campusLon = college?.longitude ?? CAMPUS_LON;
    const radiusKm = (college?.radius ?? 500) / 1000;
    distanceKm = getDistanceInKm(coordinates.latitude, coordinates.longitude, campusLat, campusLon);
    locationStatus = distanceKm <= radiusKm ? 'On-Campus' : 'Off-Campus';
    locationCoordinates = `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`;
  }

  const { data: newRecord, error } = await supabase.from('attendance_records').insert({
    user_id: userId,
    user_name: userRow.name,
    user_pin: userRow.pin,
    user_avatar: userRow.image_url || createAvatar(userRow.name),
    date: dateString,
    status: 'Present',
    timestamp: timeString,
    location_status: coordinates ? locationStatus : null,
    location_coordinates: locationCoordinates ?? null,
    distance_km: distanceKm ?? null,
  }).select().single();

  if (error) throw new Error(error.message);
  return mapDbAttendance(newRecord);
};

// ─── COLLEGES ─────────────────────────────────────────────────────────────────

export const getColleges = async (): Promise<College[]> => {
  const { data, error } = await supabase.from('colleges').select('*').order('name');
  if (error) throw new Error(error.message);
  return (data || []).map(mapDbCollege);
};

export const addCollege = async (college: Omit<College, 'id'>): Promise<College> => {
  const { data, error } = await supabase.from('colleges').insert({
    name: college.name, code: college.code, location: college.location,
    latitude: college.latitude, longitude: college.longitude, radius: college.radius ?? 500,
  }).select().single();
  if (error) throw new Error(error.message);
  return mapDbCollege(data);
};

export const updateCollege = async (id: string, collegeData: Partial<College>): Promise<College> => {
  const { data, error } = await supabase.from('colleges').update({
    name: collegeData.name, code: collegeData.code, location: collegeData.location,
    latitude: collegeData.latitude, longitude: collegeData.longitude, radius: collegeData.radius,
  }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return mapDbCollege(data);
};

export const deleteCollege = async (id: string): Promise<{ success: boolean }> => {
  const { error } = await supabase.from('colleges').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
};

// ─── APPLICATIONS ─────────────────────────────────────────────────────────────

const mapDbApplication = (row: any): Application => ({
  id: row.id, pin: row.pin, userId: row.user_id,
  type: row.type as ApplicationType, status: row.status as ApplicationStatus,
  payload: row.payload, created_at: row.created_at,
});

export const getApplications = async (status?: ApplicationStatus): Promise<Application[]> => {
  let q = supabase.from('applications').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapDbApplication);
};

export const getApplicationsByPin = async (pin: string): Promise<Application[]> => {
  const { data, error } = await supabase.from('applications').select('*').eq('pin', pin)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapDbApplication);
};

export const getApplicationsByUserId = async (userId: string): Promise<Application[]> => {
  const { data, error } = await supabase.from('applications').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapDbApplication);
};

export const submitApplication = async (appData: { pin: string; type: ApplicationType; payload: any }): Promise<Application> => {
  const user = await getUserByPin(appData.pin);
  if (!user) throw new Error('User with given PIN not found.');
  const { data, error } = await supabase.from('applications').insert({
    pin: appData.pin, user_id: user.id, type: appData.type,
    payload: appData.payload, status: ApplicationStatus.PENDING,
  }).select().single();
  if (error) throw new Error(error.message);
  return mapDbApplication(data);
};

export const updateApplicationStatus = async (appId: string, status: ApplicationStatus): Promise<Application> => {
  const { data, error } = await supabase.from('applications').update({ status })
    .eq('id', appId).select().single();
  if (error) throw new Error(error.message);
  return mapDbApplication(data);
};

// ─── SBTET ────────────────────────────────────────────────────────────────────

const mapDbSbtet = (row: any): SBTETResult => ({
  id: row.id, pin: row.pin, semester: row.semester, subjects: row.subjects,
  totalMarks: row.total_marks, creditsEarned: row.credits_earned, sgpa: row.sgpa, status: row.status,
});

export const getSbtetResult = async (pin: string, semester: number): Promise<SBTETResult | null> => {
  const { data } = await supabase.from('sbtet_results').select('*').eq('pin', pin).eq('semester', semester).single();
  return data ? mapDbSbtet(data) : null;
};

export const getAllSbtetResultsForPin = async (pin: string): Promise<SBTETResult[]> => {
  const { data, error } = await supabase.from('sbtet_results').select('*').eq('pin', pin)
    .order('semester');
  if (error) throw new Error(error.message);
  return (data || []).map(mapDbSbtet);
};

export const saveSbtetResult = async (result: SBTETResult): Promise<SBTETResult> => {
  const { data, error } = await supabase.from('sbtet_results').upsert({
    pin: result.pin, semester: result.semester, subjects: result.subjects,
    total_marks: result.totalMarks, credits_earned: result.creditsEarned,
    sgpa: result.sgpa, status: result.status,
  }, { onConflict: 'pin,semester' }).select().single();
  if (error) throw new Error(error.message);
  return mapDbSbtet(data);
};

// ─── SYLLABUS ─────────────────────────────────────────────────────────────────

const mapDbSyllabus = (row: any): SyllabusCoverage => ({
  id: row.id, branch: row.branch as Branch, year: row.year, semester: row.semester,
  subjectCode: row.subject_code, subjectName: row.subject_name,
  facultyId: row.faculty_id, facultyName: row.faculty_name,
  totalTopics: row.total_topics, topicsCompleted: row.topics_completed, lastUpdated: row.last_updated,
});

export const getAllSyllabusCoverage = async (): Promise<SyllabusCoverage[]> => {
  const { data, error } = await supabase.from('syllabus_coverage').select('*').order('branch').order('year');
  if (error) throw new Error(error.message);
  return (data || []).map(mapDbSyllabus);
};

export const getSyllabusCoverage = async (branch: Branch, year: number, semester: number): Promise<SyllabusCoverage[]> => {
  const { data, error } = await supabase.from('syllabus_coverage').select('*')
    .eq('branch', branch).eq('year', year).eq('semester', semester);
  if (error) throw new Error(error.message);
  return (data || []).map(mapDbSyllabus);
};

export const updateSyllabusCoverage = async (
  id: string, updates: { topicsCompleted?: number; totalTopics?: number }
): Promise<SyllabusCoverage> => {
  const { data: current } = await supabase.from('syllabus_coverage').select('*').eq('id', id).single();
  if (!current) throw new Error('Record not found');

  const totalTopics = updates.totalTopics ?? current.total_topics;
  let topicsCompleted = updates.topicsCompleted ?? current.topics_completed;
  if (topicsCompleted > totalTopics) topicsCompleted = totalTopics;

  const { data, error } = await supabase.from('syllabus_coverage').update({
    total_topics: totalTopics, topics_completed: topicsCompleted, last_updated: new Date().toISOString(),
  }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return mapDbSyllabus(data);
};

// ─── TIMETABLES ───────────────────────────────────────────────────────────────

const mapDbTimetable = (row: any): Timetable => ({
  id: row.id, branch: row.branch as Branch, year: row.year,
  url: row.url, updated_at: row.updated_at, updated_by: row.updated_by,
});

export const getTimetable = async (branch: Branch, year: number): Promise<Timetable | null> => {
  const { data } = await supabase.from('timetables').select('*').eq('branch', branch).eq('year', year).single();
  return data ? mapDbTimetable(data) : null;
};

export const setTimetable = async (branch: Branch, year: number, url: string, updatedBy: string): Promise<Timetable> => {
  const { data, error } = await supabase.from('timetables').upsert(
    { branch, year, url, updated_by: updatedBy, updated_at: new Date().toISOString() },
    { onConflict: 'branch,year' }
  ).select().single();
  if (error) throw new Error(error.message);
  return mapDbTimetable(data);
};

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────

const mapDbFeedback = (row: any): Feedback => ({
  id: row.id, userId: row.user_id, userName: row.user_name,
  userRole: row.user_role as Role, type: row.type as Feedback['type'],
  message: row.message, status: row.status as Feedback['status'],
  submitted_at: row.submitted_at, is_anonymous: row.is_anonymous,
});

export const getFeedback = async (): Promise<Feedback[]> => {
  const { data, error } = await supabase.from('feedback').select('*').order('submitted_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapDbFeedback);
};

export const submitFeedback = async (feedbackData: Omit<Feedback, 'id' | 'submitted_at' | 'status'>): Promise<Feedback> => {
  const { data, error } = await supabase.from('feedback').insert({
    user_id: feedbackData.userId || null, user_name: feedbackData.userName,
    user_role: feedbackData.userRole, type: feedbackData.type,
    message: feedbackData.message, is_anonymous: feedbackData.is_anonymous, status: 'New',
  }).select().single();
  if (error) throw new Error(error.message);
  return mapDbFeedback(data);
};

export const updateFeedbackStatus = async (id: string, status: Feedback['status']): Promise<Feedback> => {
  const { data, error } = await supabase.from('feedback').update({ status }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return mapDbFeedback(data);
};

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

export const getSettings = async (userId: string): Promise<AppSettings | null> => {
  const { data } = await supabase.from('app_settings').select('*').eq('user_id', userId).single();
  if (!data) return null;
  return { userId: data.user_id, notifications: data.notifications, profile_private: data.profile_private };
};

export const updateSettings = async (userId: string, settings: AppSettings): Promise<AppSettings> => {
  const { error } = await supabase.from('app_settings').upsert({
    user_id: userId, notifications: settings.notifications,
    profile_private: settings.profile_private, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  return settings;
};

// ─── FILE UPLOADS ─────────────────────────────────────────────────────────────

export const uploadUserAvatar = async (userId: string, imageBlob: Blob): Promise<string> => {
  const fileName = `${userId}-${Date.now()}.jpg`;
  const publicUrl = await uploadFile(STORAGE_BUCKETS.AVATARS, fileName, imageBlob, 'image/jpeg');
  await supabase.from('users').update({ image_url: publicUrl }).eq('id', userId);
  return publicUrl;
};

export const uploadTimetableImage = async (branch: string, year: number, imageBlob: Blob): Promise<string> => {
  const fileName = `${branch}-${year}-${Date.now()}.jpg`;
  return uploadFile(STORAGE_BUCKETS.TIMETABLES, fileName, imageBlob, 'image/jpeg');
};

export const uploadStudentDocument = async (userId: string, file: File): Promise<{ url: string; name: string; type: string }> => {
  const fileName = `${userId}/${Date.now()}-${file.name}`;
  const url = await uploadFile(STORAGE_BUCKETS.DOCUMENTS, fileName, file, file.type);
  return { url, name: file.name, type: file.type };
};

// ─── COGNICRAFT AI (Gemini) ───────────────────────────────────────────────────

export const cogniCraftService = {
  getClientStatus: () => ({
    isInitialized: aiClientState.isInitialized,
    error: aiClientState.initializationError,
  }),

  _generateContent: async (contents: any, config?: any): Promise<any> => {
    if (!aiClientState.isInitialized || !aiClientState.client) {
      throw new Error(aiClientState.initializationError || 'CogniCraft AI client is not initialized.');
    }
    try {
      return await (aiClientState.client as any).models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17',
        contents,
        config,
      });
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  },

  /**
   * Face verification — now delegated to local face-api.js models.
   * Kept for backward compatibility with MarkAttendance component.
   */
  verifyFace: async (
    referenceImageUrl: string,
    liveImageDataUrl: string
  ): Promise<{ isMatch: boolean; quality: 'GOOD' | 'POOR'; reason: string }> => {
    const response = await fetch(liveImageDataUrl);
    const blob = await response.blob();
    const result = await verifyFaceAgainstUrl(referenceImageUrl, blob);
    return { isMatch: result.isMatch, quality: result.quality, reason: result.reason };
  },
};
