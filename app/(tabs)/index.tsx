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
  // List of potential ESP32 IP addresses - Add your devices here!
  const availableDevices = [
      '192.168.101.101', 
      '192.168.101.102', 
      '192.168.101.103', 
      '192.168.101.104', 
      '192.168.101.105', 
      '192.168.101.106', 
      '192.168.101.107', 
      '192.168.101.108', 
  ];

  // State for the currently selected ESP32 IP Address
  // Initialize with the first device in the list, or a default/saved value
  const [esp32IpAddress, setEsp32IpAddress] = useState(availableDevices.length > 0 ? availableDevices[0] : 'YOUR_ESP32_IP_ADDRESS');

2
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


  // --- API Call Function ---

  const sendApiCommand = async (endpoint: string): Promise<boolean> => { // Added return type boolean
    if (!esp32IpAddress || esp32IpAddress === 'YOUR_ESP32_IP_ADDRESS') {
        Alert.alert("Configuration Error", "Please select an ESP32 device or set the IP address list.");
        return false; // Indicate failure
    }
    setLoading(true);
    const url = `http://${esp32IpAddress}${endpoint}`;
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
      Alert.alert("Network Error", `Could not connect to ESP32 at ${esp32IpAddress}. Is it on the same network?`);
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
            <Text className="mb-8 font-bold text-white text-3xl text-center">
                Smart Lighting Control
            </Text>

             {/* Loading Indicator */}
            {loading ? (
                <View className="z-10 absolute inset-0 justify-center items-center bg-black bg-opacity-50">
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text className="mt-2 text-white">Sending Command...</Text>
                </View>
            ): null}

             {/* Device Selection Picker */}
             <View className="mb-8">
                <Text className="mb-2 font-semibold text-white text-lg">Select Device:</Text>
                <View style={styles.pickerContainer}> {/* Wrapper for styling */}
                    <Picker
                        selectedValue={esp32IpAddress}
                        onValueChange={(itemValue, itemIndex) =>
                            setEsp32IpAddress(itemValue)
                        }
                         // Style the picker text color (Android and iOS different props)
                        style={styles.picker}
                        itemStyle={styles.pickerItem} // iOS only
                    >
                        {availableDevices.map(deviceIp => (
                            <Picker.Item key={deviceIp} label={deviceIp} value={deviceIp} />
                        ))}
                         {/* Add an option if no devices are listed initially */}
                         {availableDevices.length === 0 ? (
                             <Picker.Item label="No devices found" value="YOUR_ESP32_IP_ADDRESS" />
                         ): null}
                    </Picker>
                </View>
                <Text className="mt-2 text-white text-sm text-center">
                     Controlling: {esp32IpAddress}
                </Text>
             </View>


            {/* Current Mode Display (Optional but helpful) */}
             <Text className="mb-4 text-white text-lg text-center">
                Current Mode: <Text className="font-bold capitalize">{lightMode}</Text>
            </Text>

            {/* ON Buttons Container - Your original buttons */}
             <View className="flex-row justify-around mb-4">
               <TouchableOpacity
                    className="flex-1 items-center bg-orange-500 mx-1 p-4 rounded-lg"
                    onPress={warmBrightness > 0 ? sendWarmOff : sendWarmOn}> 
                    <Text className="font-semibold text-white text-lg">{warmBrightness > 0 ? 'Warm Off' : 'Warm On'}</Text>
                </TouchableOpacity>

                 <TouchableOpacity
                    className="flex-1 items-center bg-neutral-500 mx-1 p-4 rounded-lg"
                    onPress={naturalBrightness > 0 ? sendNaturalOff : sendNaturalOn}> 
                    <Text className="font-semibold text-white text-lg">{naturalBrightness > 0 ? 'Natural Off' : 'Natural On'}</Text>
                </TouchableOpacity>
             </View>

              <View className="flex-row justify-around mb-8">
                {/* Dedicated ALL OFF button - Your original button */}
                 <TouchableOpacity
                    className="flex-1 items-center bg-red-500 mx-1 p-3 rounded-lg"
                    onPress={handleAllOff}>
                    <Text className="font-semibold text-white text-base">TURN OFF</Text>
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
                    minimumTrackTintColor="#FFA500" // Orange (Reverted from AB8BFF to keep your original colors)
                    maximumTrackTintColor="#FFFFFF"
                    thumbTintColor="#FFA500" // Orange (Reverted)
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