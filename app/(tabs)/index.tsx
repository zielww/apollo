import ESPDiscovery from "@/components/ESPDiscovery";
import { images } from "@/constants/images";
import Slider from "@react-native-community/slider";
import { Picker } from '@react-native-picker/picker'; // Import Picker
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react"; // Import useEffect
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"; // Import Platform

export default function Index() {
  const router = useRouter();

  // --- Device Management ---
  // State for the currently selected ESP32 IP Address
  const [esp32IpAddress, setEsp32IpAddress] = useState<string | null>(null);
  
  // State for available devices (will be populated from Firebase)
  const [availableDevices, setAvailableDevices] = useState<string[]>([]);

  // State to manage the currently selected light mode (optional, but helpful for UI)
  const [lightMode, setLightMode] = useState<'off' | 'warm' | 'natural' | 'both'>('off'); // Updated type to include 'both' for clarity

  // State to hold brightness values (0-100)
  const [warmBrightness, setWarmBrightness] = useState(100);
  const [naturalBrightness, setNaturalBrightness] = useState(100);

  // State to indicate if an API call is in progress (optional feedback)
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (warmBrightness >= 1 && naturalBrightness >= 1) {
      setLightMode('both');
    } else if (warmBrightness >= 1) {
      setLightMode('warm');
    } else if (naturalBrightness >= 1) {
      setLightMode('natural');
    } else {
      setLightMode('off')
    }
  }, [warmBrightness, naturalBrightness])

  // Handler for when an ESP32 device is found
  const handleDeviceFound = (address: string) => {
    setEsp32IpAddress(address);
    
    // Update available devices list
    if (!availableDevices.includes(address)) {
      setAvailableDevices([address, ...availableDevices]);
    }
  };

  // --- API Call Function ---

  const sendApiCommand = async (endpoint: string): Promise<boolean> => { // Added return type boolean
    if (!esp32IpAddress) {
        Alert.alert("Connection Error", "No ESP32 device connected. Please discover your device first.");
        return false; // Indicate failure
    }
    setLoading(true);
    const url = `${esp32IpAddress}${endpoint}`;
    console.log("Sending command to:", url);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status} for ${url}`);
        Alert.alert("API Error", `Failed to reach ESP32 (${response.status}). Check connection or IP.`);
        return false; // Indicate failure
      } else {
        const text = await response.text();
        console.log("API Response:", text);
        return true; // Indicate success
      }
    } catch (error) {
      console.error(`Error sending command to ${url}:`, error);
      Alert.alert("Network Error", `Could not connect to ESP32. Is it on the same network?`);
      return false; // Indicate failure
    } finally {
      setLoading(false);
    }
  };

  // --- Button Handlers (Using your original separate ON/OFF/ALL OFF structure) ---

  const sendWarmOn = () => {
    sendApiCommand('/warm/on');
    setWarmBrightness(100);
  };

  const sendWarmOff = () => {
    setWarmBrightness(0); // Update slider position immediately
    sendApiCommand('/warm/brightness?level=0'); // Use brightness=0 for OFF
  };

   const sendNaturalOn = () => {
    sendApiCommand('/natural/on');
    setNaturalBrightness(100);
  };

  const sendNaturalOff = () => {
    setNaturalBrightness(0); // Update slider position immediately
    sendApiCommand('/natural/brightness?level=0');
  };

  const handleAllOff = () => {
      setLightMode('off');
      setWarmBrightness(0); // Update sliders immediately
      setNaturalBrightness(0);
      // Send both off commands
      sendApiCommand('/warm/brightness?level=0');
      sendApiCommand('/natural/brightness?level=0');
  };


  // Sliders update state immediately for smooth UI, API call on release
  const handleWarmBrightnessChange = (value: number) => {
    setWarmBrightness(Math.round(value));
  };

   const handleNaturalBrightnessChange = (value: number) => {
    setNaturalBrightness(Math.round(value));
  };

  // Send API command ONLY when the user finishes sliding
  const handleWarmSlidingComplete = (value: number) => {
     const roundedValue = Math.round(value);
     console.log("Warm slider released, sending command:", roundedValue);
     sendApiCommand(`/warm/brightness?level=${roundedValue}`);
      // Keep mode in sync if sliding affects it
      if (roundedValue > 0) setLightMode('warm'); // If warm slider > 0, mode is at least warm
      else if (naturalBrightness === 0) setLightMode('off'); // If warm is 0 and natural is 0, mode is off
      else setLightMode('natural'); // If warm is 0 and natural > 0, mode is natural (assuming only warm/natural exist)
  };

   const handleNaturalSlidingComplete = (value: number) => {
     const roundedValue = Math.round(value);
     console.log("Natural slider released, sending command:", roundedValue);
     sendApiCommand(`/natural/brightness?level=${roundedValue}`);
      // Keep mode in sync if sliding affects it
      if (roundedValue > 0) setLightMode('natural'); // If natural slider > 0, mode is at least natural
      else if (warmBrightness === 0) setLightMode('off'); // If natural is 0 and warm is 0, mode is off
      else setLightMode('warm'); // If natural is 0 and warm > 0, mode is warm (assuming only warm/natural exist)
  };


  return (
    <View className="flex-1 bg-primary">
        {/* Background Image */}
        <Image
            source={images.bg}
            className="top-0 left-0 z-0 absolute w-full h-full"
            contentFit="cover"
        />

        <ScrollView
            className="flex-1 px-5 py-8"
            showsVerticalScrollIndicator={false}
        >
            {/* Title */}
            <Text className="mb-4 font-bold text-white text-3xl text-center">
                Home
            </Text>
            
            

             {/* Loading Indicator */}
            {loading ? (
                <View className="z-10 absolute inset-0 justify-center items-center bg-black bg-opacity-50">
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text className="mt-2 text-white">Sending Command...</Text>
                </View>
            ): null}

             {/* Device Selection Picker */}
             {availableDevices.length > 0 && (
               <View className="mb-3">
                  <Text className="mb-2 font-semibold text-white text-lg">Select Device:</Text>
                  <View style={styles.pickerContainer}> {/* Wrapper for styling */}
                      <Picker
                          selectedValue={esp32IpAddress || ''}
                          onValueChange={(itemValue) =>
                              setEsp32IpAddress(itemValue)
                          }
                           // Style the picker text color (Android and iOS different props)
                          style={styles.picker}
                          itemStyle={styles.pickerItem} // iOS only
                      >
                          {availableDevices.map(deviceIp => (
                              <Picker.Item key={deviceIp} label={deviceIp} value={deviceIp} />
                          ))}
                      </Picker>
                  </View>
               </View>
             )}
             

             {/* Add ESPDiscovery component */}
            <ESPDiscovery onDeviceFound={handleDeviceFound} />
             
            <View className="my-6 bg-neutral-800 w-full h-1"></View>

            {/* Current Mode Display (Optional but helpful) */}
             <Text className="mb-4 text-white text-lg text-center">
                Current Mode: <Text className="font-bold capitalize">{lightMode}</Text>
            </Text>

            {/* ON Buttons Container - Your original buttons */}
             <View className="flex-row justify-around mb-4">
                <TouchableOpacity className={`${warmBrightness > 0 ? `opacity-50` : ``} flex-1 items-center bg-accent  mx-1 p-4 rounded-lg`}
                  onPress={warmBrightness > 0 ? sendWarmOff : sendWarmOn}>
                      <Text className="font-semibold text-white text-lg">Warm</Text>
                      <Text className="font-semibold text-white text-lg">{warmBrightness > 0 ? 'Off' : 'On'}</Text> 
                </TouchableOpacity>

                <TouchableOpacity className={`${naturalBrightness > 0 ? `opacity-50` : ``} flex-1 items-center bg-white mx-1 p-4 rounded-lg`} 
                  onPress={naturalBrightness > 0 ? sendNaturalOff : sendNaturalOn}>
                  <Text className="font-semibold text-neutral-700 text-lg">Natural</Text>
                  <Text className="font-semibold text-neutral-700 text-lg">{naturalBrightness > 0 ? 'Off' : 'On'}</Text>
                </TouchableOpacity>
             </View>

             


            {/* Brightness Sliders Area - Remains the same */}
            <View className="mb-8">
                {/* Warm Brightness Slider */}
                <Text className="mb-2 font-semibold text-white text-lg">Warm Brightness ({Math.round(warmBrightness)}%)</Text>
                <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={100}
                    value={warmBrightness}
                    onValueChange={handleWarmBrightnessChange}
                    onSlidingComplete={handleWarmSlidingComplete}
                    minimumTrackTintColor="#AB8BFF" // Orange (Reverted from AB8BFF to keep your original colors)
                    maximumTrackTintColor="#FFFFFF"
                    thumbTintColor="#AB8BFF" // Orange (Reverted)
                />

                {/* Natural Brightness Slider */}
                <Text className="mt-4 mb-2 font-semibold text-white text-lg">Natural Brightness ({Math.round(naturalBrightness)}%)</Text>
                 <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={100}
                    value={naturalBrightness}
                    onValueChange={handleNaturalBrightnessChange}
                    onSlidingComplete={handleNaturalSlidingComplete}
                    minimumTrackTintColor="#CCCCCC" // Light Gray (Reverted from AB8BFF)
                    maximumTrackTintColor="#FFFFFF"
                    thumbTintColor="#CCCCCC" // Light Gray (Reverted)
                />
            </View>

        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
    slider: {
        width: '100%',
        height: 40,
    },
    pickerContainer: {
         backgroundColor: 'white', 
         borderRadius: 8,
         overflow: 'hidden', 
    },
     picker: {
        width: '100%',
        color: '#000', 
     },
     pickerItem: { 
         color: '#000',
         fontSize: 16,
     }
});