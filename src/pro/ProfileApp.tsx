import { useState } from 'react';
import ProApp from './SimpleApp';
import type { Profile } from './progression';

const ACTIVE_PROFILE = 'diamond-nine-active-profile';
export default function ProfileApp() {
  const [profile, setProfile] = useState<Profile>(() => {
    try { return localStorage.getItem(ACTIVE_PROFILE) === 'free' ? 'free' : 'career'; }
    catch { return 'career'; }
  });
  const switchProfile = (next: Profile) => {
    try { localStorage.setItem(ACTIVE_PROFILE, next); } catch { /* The game reports save failures. */ }
    setProfile(next);
  };
  return <ProApp key={profile} profile={profile} onProfileChange={switchProfile} />;
}
