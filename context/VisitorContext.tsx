import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { auth } from '@/constants/firebase-config';

type Ctx = {
  isGuest: boolean;                 // l’utilisateur a choisi "visiteur"
  setGuest: (v: boolean) => void;
  isAuthenticated: boolean;         // connecté Firebase
  isLoggedInOrGuest: boolean;       // utile si besoin
  // Ouvre le modal d’auth, retourne true si modal ouvert (donc navigation bloquée)
  askToSignIn: (redirectTo?: string, reason?: string) => boolean;
};

const VisitorContext = createContext<Ctx | null>(null);
export const useVisitor = () => useContext(VisitorContext)!;

// --- UI du modal ---
function AuthGateModal({
  visible, onClose, onContinue, reason,
}: { visible: boolean; onClose: ()=>void; onContinue: ()=>void; reason?: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.6)', alignItems:'center', justifyContent:'center', padding:24}}>
        <View style={{backgroundColor:'#fff', borderRadius:16, padding:20, width:'100%', maxWidth:420}}>
          <Text style={{fontSize:18, fontWeight:'700', marginBottom:8}}>Crée un compte pour continuer</Text>
          <Text style={{opacity:0.8, lineHeight:20, marginBottom:16}}>
            {reason || "Inscris-toi pour sauvegarder ta progression, débloquer le duo et accéder au classement."}
          </Text>
          <View style={{flexDirection:'row', justifyContent:'flex-end', gap:12}}>
            <TouchableOpacity onPress={onClose} style={{paddingVertical:10, paddingHorizontal:14}}>
              <Text>Plus tard</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onContinue}
              style={{paddingVertical:10, paddingHorizontal:14, backgroundColor:'#ff7a00', borderRadius:10}}>
              <Text style={{color:'#fff', fontWeight:'700'}}>Se connecter / S’inscrire</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function VisitorProvider({children}: {children: React.ReactNode}) {
  const router = useRouter();
  const [isGuest, setIsGuest] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | undefined>(undefined);
  const [modalReason, setModalReason] = useState<string | undefined>(undefined);

  // Persistance simple
  useEffect(() => {
    AsyncStorage.getItem('@ct.isGuest').then(v => setIsGuest(v === '1'));
  }, []);
  const setGuest = (v: boolean) => {
    setIsGuest(v);
    AsyncStorage.setItem('@ct.isGuest', v ? '1' : '0').catch(()=>{});
  };

  // Si l’utilisateur se connecte, on sort du mode invité automatiquement
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!auth.currentUser?.uid);
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      setIsAuthenticated(!!u?.uid);
      if (u?.uid) setGuest(false);
    });
    return unsub;
  }, []);

  const askToSignIn = (redirectTo?: string, reason?: string) => {
    if (isAuthenticated) return false; // rien à bloquer
    setPendingRedirect(redirectTo);
    setModalReason(reason);
    setModalVisible(true);
    return true;
  };

  const onContinue = () => {
    const to = pendingRedirect ?? '/';
    setModalVisible(false);
    // on envoie vers login avec redirect
    const q = encodeURIComponent(to);
    router.push(`/login?redirect=${q}`);
  };

  const value = useMemo<Ctx>(() => ({
    isGuest, setGuest,
    isAuthenticated,
    isLoggedInOrGuest: isAuthenticated || isGuest,
    askToSignIn,
  }), [isGuest, isAuthenticated]);

  return (
    <VisitorContext.Provider value={value}>
      {children}
      <AuthGateModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onContinue={onContinue}
        reason={modalReason}
      />
    </VisitorContext.Provider>
  );
}
