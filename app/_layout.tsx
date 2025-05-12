// _layout.tsx
import * as eva from '@eva-design/eva';
import { ApplicationProvider } from '@ui-kitten/components';
import { Stack } from "expo-router";
import React from 'react';
import "./globals.css";

export default function RootLayout() {
  return (
    <ApplicationProvider {...eva} theme={eva.light}>
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
      </Stack>
    </ApplicationProvider>
  );
}