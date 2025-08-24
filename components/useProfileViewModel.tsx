// viewmodels/useProfileViewModel.ts
import { useState } from 'react';

interface Profile {
  id: string;
  name: string;
  designation: string;
  avatar: string;
}

export const useProfileViewModel = () => {
  const [profile, setProfile] = useState<Profile>({
    id: '1',
    name: 'John Doe',
    designation: 'Software Developer',
    avatar: 'https://example.com/user1.jpg',
  });
  const [isEditVisible, setIsEditVisible] = useState(false);

  const updateProfile = (updatedProfile: Partial<Profile>) => {
    setProfile((prev) => ({ ...prev, ...updatedProfile }));
    setIsEditVisible(false);
  };

  return {
    profile,
    isEditVisible,
    setIsEditVisible,
    updateProfile,
  };
};