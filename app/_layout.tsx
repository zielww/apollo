// _layout.tsx
import * as eva from '@eva-design/eva';
import { ApplicationProvider } from '@ui-kitten/components';
import { Stack } from "expo-router";
import React from 'react';
import { StatusBar } from 'react-native';
import "./globals.css";

export default function RootLayout() {
  return (
  
    <ApplicationProvider {...eva} theme={eva.light}>
      <StatusBar barStyle="dark-content" />
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
      </Stack>
    </ApplicationProvider>
  );
}