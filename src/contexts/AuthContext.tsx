import {createContext,useContext,useEffect,useMemo,useState,ReactNode} from 'react';
import type {Session} from '@supabase/supabase-js';import {supabase} from '../lib/supabase';import type {Profile} from '../types/domain';
type Ctx={session:Session|null;profile:Profile|null;loading:boolean;refreshProfile:()=>Promise<void>;signOut:()=>Promise<void>};
const AuthContext=createContext<Ctx|null>(null);
export function AuthProvider({children}:{children:ReactNode}){const[session,setSession]=useState<Session|null>(null);const[profile,setProfile]=useState<Profile|null>(null);const[loading,setLoading]=useState(true);
 const refreshProfile=async()=>{const s=(await supabase.auth.getSession()).data.session;if(!s){setProfile(null);return}const{data}=await supabase.from('profiles').select('*').eq('id',s.user.id).single();setProfile((data||null) as Profile|null)};
 useEffect(()=>{supabase.auth.getSession().then(async({data})=>{setSession(data.session);if(data.session)await refreshProfile();setLoading(false)});const{subscriber}=(()=>{const {data}=supabase.auth.onAuthStateChange(async(_e,s)=>{setSession(s);if(s)await refreshProfile();else setProfile(null);setLoading(false)});return{subscriber:data.subscription}})();return()=>subscriber.unsubscribe()},[]);
 const value=useMemo(()=>({session,profile,loading,refreshProfile,signOut:async()=>{await supabase.auth.signOut()}}),[session,profile,loading]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>}
export const useAuth=()=>{const c=useContext(AuthContext);if(!c)throw new Error('AuthProvider missing');return c};
