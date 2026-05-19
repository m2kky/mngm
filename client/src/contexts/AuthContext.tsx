import { createContext, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "@/lib/firebase";
import { User } from "@shared/schema";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  firebaseReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  setUserProfile: (profile: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase is not configured.");
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    if (!auth) throw new Error("Firebase is not configured.");
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    if (!auth) throw new Error("Firebase is not configured.");
    await signOut(auth);
    setUserProfile(null);
  };

  const refreshUserProfile = async () => {
    if (!currentUser || !db) return;
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserProfile({
          id: currentUser.uid,
          name: data.name ?? null,
          email: currentUser.email ?? data.email ?? "",
          emailVerified: currentUser.emailVerified,
          image: data.image ?? data.profilePicture ?? null,
          status: data.status ?? "ACTIVE",
          language: data.language ?? "en",
          theme: data.theme ?? "system",
          lastLoginAt: data.lastLoginAt?.toDate() ?? null,
          role: data.role ?? "TEAM_MEMBER",
          agencyId: data.agencyId ?? data.workspaceId ?? null,
          createdAt: data.createdAt?.toDate() ?? new Date(),
          updatedAt: data.updatedAt?.toDate() ?? new Date(),
        } as User);
      }
    } catch (error) {
      console.error("Error refreshing user profile:", error);
    }
  };

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setCurrentUser(firebaseUser);

      if (firebaseUser && db) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserProfile({
              id: firebaseUser.uid,
              name: data.name ?? null,
              email: firebaseUser.email ?? data.email ?? "",
              emailVerified: firebaseUser.emailVerified,
              image: data.image ?? data.profilePicture ?? null,
              status: data.status ?? "ACTIVE",
              language: data.language ?? "en",
              theme: data.theme ?? "system",
              lastLoginAt: data.lastLoginAt?.toDate() ?? null,
              role: data.role ?? "TEAM_MEMBER",
              agencyId: data.agencyId ?? data.workspaceId ?? null,
              createdAt: data.createdAt?.toDate() ?? new Date(),
              updatedAt: data.updatedAt?.toDate() ?? new Date(),
            } as User);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
    firebaseReady: firebaseConfigured,
    signIn,
    signInWithGoogle,
    logout,
    refreshUserProfile,
    setUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
