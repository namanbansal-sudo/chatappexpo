// This splash screen route is no longer needed.
// The splash screen is now handled in the main app/index.tsx file.
// This file can be deleted.

import React from 'react';
import { Redirect } from 'expo-router';

export default function SplashRoute() {
  // Redirect to main app flow
  return <Redirect href="/" />;
}
