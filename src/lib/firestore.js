import {
    collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, limit, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'

// ─── Interview CRUD ─────────────────────────────────────────────────────────

/**
 * Save a new interview record to Firestore.
 * @returns {string} The new document ID
 */
export async function saveInterview(uid, data) {
    const colRef = collection(db, 'users', uid, 'interviews')
    const docRef = await addDoc(colRef, {
        ...data,
        createdAt: serverTimestamp(),
    })
    return docRef.id
}

/**
 * Save full interview detail (questions, answers, evaluations, conversation, report).
 */
export async function saveInterviewDetail(uid, interviewId, detail) {
    const docRef = doc(db, 'users', uid, 'interviews', interviewId)
    await updateDoc(docRef, {
        detail,
        updatedAt: serverTimestamp(),
    })
}

/**
 * Get all interviews for a user, ordered by date descending.
 */
export async function getInterviews(uid, maxCount = 50) {
    const colRef = collection(db, 'users', uid, 'interviews')
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(maxCount))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Get a single interview by ID.
 */
export async function getInterview(uid, interviewId) {
    const docRef = doc(db, 'users', uid, 'interviews', interviewId)
    const snapshot = await getDoc(docRef)
    if (!snapshot.exists()) return null
    return { id: snapshot.id, ...snapshot.data() }
}

/**
 * Delete a single interview.
 */
export async function deleteInterview(uid, interviewId) {
    const docRef = doc(db, 'users', uid, 'interviews', interviewId)
    await deleteDoc(docRef)
}

/**
 * Clear all interviews for a user (batch delete).
 */
export async function clearInterviews(uid) {
    const colRef = collection(db, 'users', uid, 'interviews')
    const snapshot = await getDocs(colRef)
    const batch = writeBatch(db)
    snapshot.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
}

/**
 * Save the generated report to an existing interview document.
 */
export async function saveReport(uid, interviewId, report) {
    const docRef = doc(db, 'users', uid, 'interviews', interviewId)
    await updateDoc(docRef, {
        report,
        updatedAt: serverTimestamp(),
    })
}

// ─── User Profile ───────────────────────────────────────────────────────────

/**
 * Create or update user profile document.
 */
export async function saveUserProfile(uid, data) {
    const docRef = doc(db, 'users', uid)
    const snapshot = await getDoc(docRef)
    if (snapshot.exists()) {
        await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() })
    } else {
        const { setDoc } = await import('firebase/firestore')
        await setDoc(docRef, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    }
}

/**
 * Get user profile.
 */
export async function getUserProfile(uid) {
    const docRef = doc(db, 'users', uid)
    const snapshot = await getDoc(docRef)
    if (!snapshot.exists()) return null
    return { id: snapshot.id, ...snapshot.data() }
}

// ─── PDF Storage ────────────────────────────────────────────────────────────

/**
 * Upload a PDF file to Firebase Storage.
 * @returns {string} The download URL
 */
export async function uploadPDF(uid, file) {
    const storageRef = ref(storage, `users/${uid}/pdfs/${Date.now()}_${file.name}`)
    const snapshot = await uploadBytes(storageRef, file)
    return getDownloadURL(snapshot.ref)
}
