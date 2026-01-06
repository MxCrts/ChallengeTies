// helpers/reviewsHelpers.ts
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/constants/firebase-config";

export interface Review {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  daysSelected: number;
  text: string;
  createdAt: Timestamp;
  rating: number; // ⭐️ NEW
}

export const getReviews = async (challengeId: string): Promise<Review[]> => {
  const reviewsRef = collection(db, "challenges", challengeId, "reviews");
  const q = query(reviewsRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      userId: data.userId,
      username: data.username,
      avatar: data.avatar,
      daysSelected: data.daysSelected ?? 0,
      text: data.text ?? "",
      createdAt: data.createdAt as Timestamp,
      rating: Math.max(1, Math.min(5, Number(data.rating ?? 0) || 0)), // safe default
    } as Review;
  });
};

export const hasReviewed = async (
  challengeId: string,
  userId: string
): Promise<boolean> => {
  if (!userId) return false;
  const reviewDocRef = doc(db, "challenges", challengeId, "reviews", userId);
  const snapshot = await getDoc(reviewDocRef);
  return snapshot.exists();
};

export const submitReview = async (
  challengeId: string,
  review: Omit<Review, "id">
): Promise<void> => {
  const reviewRef = doc(db, "challenges", challengeId, "reviews", review.userId);
  await setDoc(reviewRef, review);
};

export const deleteReview = async (
  challengeId: string,
  reviewId: string
): Promise<void> => {
  const reviewRef = doc(db, "challenges", challengeId, "reviews", reviewId);
  await deleteDoc(reviewRef);
};
