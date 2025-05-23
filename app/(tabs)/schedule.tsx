import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddScheduleModal from '@/components/AddScheduleModal';

const { width: screenWidth } = Dimensions.get('window');
const HOUR_SLOT_WIDTH = 80;
const ASYNC_STORAGE_KEY = '@smart_lighting_schedules'; 


interface ScheduleItem {
    id: number;
    lightType: 'warm' | 'natural' | 'both';
    brightness: number;
    startTime: Date; 
    endTime: Date; 
    deviceId: string;
}


const Schedule = () => {
    const insets = useSafeAreaInsets();

    const [isModalVisible, setIsModalVisible] = useState(false);

    // Initialize schedules state as empty; data will be loaded from AsyncStorage
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);

    const [esp32Address, setESP32Address] = useState<string | null>(null);
    
    // Add state for current time
    const [currentTime, setCurrentTime] = useState(new Date());
    const [calendarScrollViewRef, setCalendarScrollViewRef] = useState<ScrollView | null>(null);

    // --- Device List ---
    const availableDevices = esp32Address ? [esp32Address] : [];
    const defaultSelectedDeviceId = esp32Address || '';

    const hours = Array.from({ length: 24 }, (_, i) => i);

    const handleDeviceFound = (address: string) => {
        setESP32Address(address);
        console.log("Found ESP32 at", address);
    };

    // --- AsyncStorage Functions ---

    // Function to save schedules to AsyncStorage
    const saveSchedules = async (schedulesToSave: ScheduleItem[]) => {
        try {
            const jsonValue = JSON.stringify(schedulesToSave);
            await AsyncStorage.setItem(ASYNC_STORAGE_KEY, jsonValue);
            console.log('Schedules successfully saved to AsyncStorage.');
        } catch (e) {
            console.error('Failed to save schedules to AsyncStorage:', e);
            Alert.alert('Error', 'Failed to save schedules.');
        }
    };

    // Function to load schedules from AsyncStorage
    const loadSchedules = async () => {
        try {
            const jsonValue = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
            if (jsonValue !== null) {
                const loadedSchedules: ScheduleItem[] = JSON.parse(jsonValue);

                 const schedulesWithDates = loadedSchedules.map(schedule => ({
                     ...schedule,
                     startTime: new Date(schedule.startTime), 
                     endTime: new Date(schedule.endTime),     
                 }));

                setSchedules(schedulesWithDates);
                console.log('Schedules successfully loaded from AsyncStorage.');
            } else {
                 console.log('No schedules found in AsyncStorage.');
            }
        } catch (e) {
            console.error('Failed to load schedules from AsyncStorage:', e);
            Alert.alert('Error', 'Failed to load schedules.');
        }
    };

    // --- ESP32 Sync Functions ---
    
    // Function to send schedules to the ESP32
    const syncSchedulesToESP32 = async (schedulesToSync: ScheduleItem[]) => {
        if (!esp32Address) {
            Alert.alert('Connection Error', 'ESP32 address not available. Please discover your device first.');
            return false;
        }
        
        try {
            // Convert Date objects to strings for serialization
            const serializedSchedules = schedulesToSync.map(schedule => ({
                ...schedule,
                startTime: schedule.startTime.toISOString(),
                endTime: schedule.endTime.toISOString()
            }));

            console.log('Syncing schedules to ESP32:', serializedSchedules);

            const response = await fetch(`${esp32Address}/set_schedule`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(serializedSchedules),
            });

            if (response.ok) {
                console.log('Schedules successfully synced to ESP32');
                return true;
            } else {
                const errorText = await response.text();
                console.error('Failed to sync schedules to ESP32:', errorText);
                return false;
            }
        } catch (error) {
            console.error('Error syncing schedules to ESP32:', error);
            Alert.alert(
                'Sync Error',
                'Failed to sync schedules to the ESP32. Check your connection and try again.',
                [{ text: 'OK' }]
            );
            return false;
        }
    };

    // --- useEffect to Load Schedules on Component Mount ---
    useEffect(() => {
        loadSchedules();
        
        // Load saved ESP32 address
        const loadSavedESP32Address = async () => {
            try {
                const savedAddress = await AsyncStorage.getItem('@esp32_address');
                if (savedAddress) {
                    setESP32Address(savedAddress);
                    console.log('Loaded saved ESP32 address:', savedAddress);
                } else {
                    console.log('No saved ESP32 address found');
                }
            } catch (e) {
                console.error('Failed to load ESP32 address from AsyncStorage:', e);
            }
        };
        
        loadSavedESP32Address();

        // Set up a timer to update current time every minute
        const timeInterval = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);
            
            // Scroll to current time if scroll view is available
            if (calendarScrollViewRef) {
                const currentHour = now.getHours();
                const scrollToHour = Math.max(0, currentHour - 2);
                calendarScrollViewRef.scrollTo({ x: scrollToHour * HOUR_SLOT_WIDTH, animated: true });
            }
        }, 60000); 
        
        // Initial time set and scroll
        const now = new Date();
        setCurrentTime(now);
        
        // Clean up timer on unmount
        return () => clearInterval(timeInterval);
    }, [calendarScrollViewRef]); 


    // --- Helper functions ---

     // Date formatter HH:mm
     const formatTime = (date: Date) => {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
     };

     // Function to calculate the style and details for a schedule block segment within a given hour 
      const getSegmentDetails = (schedule: ScheduleItem, currentHour: number) => {
         // Calculate schedule start/end times in minutes since midnight (0-1440 scale for one day)
         const scheduleStartMins = schedule.startTime.getHours() * 60 + schedule.startTime.getMinutes();
         const scheduleEndMins = schedule.endTime.getHours() * 60 + schedule.endTime.getMinutes();

         // Handle schedules that span across midnight by potentially creating two logical time ranges
         const scheduleRanges = [];
         if (scheduleEndMins < scheduleStartMins) {
             scheduleRanges.push([scheduleStartMins, 1440]);
             scheduleRanges.push([0, scheduleEndMins]);     
         } else {
             scheduleRanges.push([scheduleStartMins, scheduleEndMins]);
         }

         // The current hour slot in minutes since midnight
         const currentHourSlotMins = [currentHour * 60, (currentHour + 1) * 60];

         // Find the segment of the schedule that overlaps with the current hour slot
         let overlappingSegment = null;

         for (const range of scheduleRanges) {
              const segmentStartMins = range[0];
              const segmentEndMins = range[1];

              // Calculate overlap with current hour slot
              const overlapStartMins = Math.max(segmentStartMins, currentHourSlotMins[0]);
              const overlapEndMins = Math.min(segmentEndMins, currentHourSlotMins[1]);

              // Check if overlap exists (start must be strictly less than end)
              if (overlapStartMins < overlapEndMins) {
                  overlappingSegment = {
                      schedule, 
                      overlapStartMins, 
                      overlapEndMins,   
                  };
                  break; 
              }
         }

         // If no overlap for this hour, return null
         if (!overlappingSegment) {
             return null;
         }

         // Calculate segment details relative to the *current hour slot* for horizontal positioning
         const segmentMinutesIntoHour = overlappingSegment.overlapStartMins - currentHourSlotMins[0];
         const segmentDurationMinutes = overlappingSegment.overlapEndMins - overlappingSegment.overlapStartMins;

         // Calculate style for this segment
         const left = (segmentMinutesIntoHour / 60) * 100; 
         const width = (segmentDurationMinutes / 60) * 100; 

         let bgColorClass = 'bg-blue-500'; 
         if (schedule.lightType === 'warm') bgColorClass = 'bg-orange-500';
         if (schedule.lightType === 'natural') bgColorClass = 'bg-gray-400'; 


          return {
              schedule, // Original schedule item
              style: {
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${width}%`,
                  top: '10%',
                  height: '80%',
                  borderRadius: 4,
              },
              className: `${bgColorClass}`, 
              segmentDurationMinutes, 
          };
      };


    // --- Event Handlers ---

    const handleAddConfig = () => {
        console.log("Add Config button pressed");
        setIsModalVisible(true); // Show the modal
    };

     // Handler for when the modal's "Add" button is pressed
    const handleAddSchedule = (newSchedule: Omit<ScheduleItem, 'id'>) => {
        console.log("Received schedule from modal:", newSchedule);
        const scheduleWithId = { ...newSchedule, id: Date.now() + Math.random() };

        // Add the new schedule to the state
        setSchedules(prevSchedules => {
            const updatedSchedules = [...prevSchedules, scheduleWithId];
            saveSchedules(updatedSchedules); 
            syncSchedulesToESP32(updatedSchedules).catch(err => 
                console.error('Error during ESP32 sync after add:', err)
            );
            return updatedSchedules;
        });
    };

     // Handler to delete a schedule
    const handleDeleteSchedule = (id: number) => {
         Alert.alert(
             "Delete Schedule",
             "Are you sure you want to delete this schedule?",
             [
                 { text: "Cancel", style: "cancel" },
                 { text: "Delete", style: "destructive", onPress: () => {
                     setSchedules(prevSchedules => {
                        const updatedSchedules = prevSchedules.filter(sched => sched.id !== id);
                        saveSchedules(updatedSchedules);
                        syncSchedulesToESP32(updatedSchedules).catch(err => 
                            console.error('Error during ESP32 sync after delete:', err)
                        );
                        return updatedSchedules;
                     });
                     console.log(`Deleted schedule with ID: ${id}`);
                 }}
             ]
         );
     };

     // Handler for editing a schedule (Placeholder)
     const handleEditSchedule = (schedule: ScheduleItem) => {
          console.log("Edit schedule pressed:", schedule);
     };

    // Helper function to get current time position for time indicator
    const getCurrentTimePosition = () => {
        const hours = currentTime.getHours();
        const minutes = currentTime.getMinutes();
        const minutesSinceMidnight = hours * 60 + minutes;
        const hourWidth = HOUR_SLOT_WIDTH;
        
        // Calculate position as percentage through the day
        const hourPosition = hours + (minutes / 60);
        const position = hourPosition * hourWidth;
        
        return position + 48;
    };

    return (
        <View className="flex-1 bg-primary" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
            
            {/* Title */}
            <Text className="mt-8 mb-4 font-bold text-white text-3xl text-center">
                Schedule
            </Text>

            {/* Current Time Display */}
            <Text className="mb-2 font-semibold text-white text-lg text-center">
                Current Time: {formatTime(currentTime)}
            </Text>

            {/* 24-Hour Calendar Scroll View (Horizontal) */}
            <View className="relative"> 
                <ScrollView
                    ref={(ref) => setCalendarScrollViewRef(ref)}
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.calendarContentContainer} 
                    className="border-gray-700 border-b" 
                >
                    {hours.map(hour => (
                        <View
                            key={hour}
                            style={[
                                styles.hourSlot, 
                                { width: HOUR_SLOT_WIDTH }, 
                                hour === 0 ? styles.firstHourSlot : null 
                            ]}
                        >
                            {/* Hour Label */}
                             <Text className="mb-1 text-gray-400 text-xs text-center">
                                {hour.toString().padStart(2, '0')}:00
                             </Text>

                             {/* Schedule Blocks Area (within the hour slot) */}
                                {schedules.map(schedule => {
                                    const segmentDetails = getSegmentDetails(schedule, hour);

                                    if (segmentDetails) {
                                         const { schedule: originalSchedule, style, className, segmentDurationMinutes } = segmentDetails;

                                        return (
                                            <TouchableOpacity
                                                 key={`${originalSchedule.id}-${hour}`}
                                                className={`absolute rounded-sm ${className} items-center justify-center p-0.5 z-10`}
                                                style={{
                                                    position: 'absolute',
                                                    left: `${(segmentDetails.style.left).replace('%', '')}%`, 
                                                    width: `${(segmentDetails.style.width).replace('%', '')}%`,
                                                    height: '90%',
                                                    top: '10%',
                                                    borderRadius: 4
                                                }}
                                                 onPress={() => { handleEditSchedule(originalSchedule); }}
                                                 onLongPress={() => { handleDeleteSchedule(originalSchedule.id); }}
                                            >
                                                  {segmentDurationMinutes >= 30 ? (
                                                      <>
                                                          <Text className="font-bold text-white text-xs text-center leading-none">
                                                               {"Mode: " + originalSchedule.lightType}
                                                          </Text>
                                                           <Text className="mt-2 text-white text-xs text-center leading-none">
                                                               {"Brightness: " + originalSchedule.brightness}%
                                                           </Text>
                                                      </>
                                                  ) : null }
                                                   {segmentDurationMinutes >= 15 && segmentDurationMinutes < 30 ? (
                                                       <Text className="font-bold text-white text-xs leading-none">
                                                            {originalSchedule.lightType.charAt(0).toUpperCase()}
                                                       </Text>
                                                   ) : null}
                                            </TouchableOpacity>
                                        );
                                    }
                                    return null;
                                })}

                                 {/* Half-hour marker */}
                                  <View className="absolute bg-gray-600 w-px" style={{ left: '50%', top: 0, bottom: 0 }} />

                        </View>
                    ))}

                    {/* Current Time Indicator*/}
                    <View 
                        style={{ 
                            position: 'absolute',
                            left: getCurrentTimePosition(),
                            top: 0,
                            bottom: 0,
                            width: 2,
                            backgroundColor: '#FF2D55',
                            zIndex: 100
                        }}
                    >
                        {/* Time indicator circle at top */}
                        <View style={{
                            position: 'absolute',
                            top: 0,
                            left: -4,
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: '#FF2D55',
                        }} />
                    </View>
                </ScrollView>
            </View> 


            {/* "Add Config" Button */}
            <TouchableOpacity
                className="items-center bg-accent mx-5 my-4 p-4 rounded-lg"
                onPress={handleAddConfig} 
            >
                <Text className="font-semibold text-white text-lg">Add New Schedule</Text>
            </TouchableOpacity>
        
            {/* Add ESPDiscovery component
            <View className="mx-5 mb-2">
                <ESPDiscovery onDeviceFound={handleDeviceFound} />
            </View> */}

             {/* Display List of Schedules with proper scrolling */}
             <View className="flex-1 mt-2 px-5">
                <Text className="mb-2 font-bold text-white text-xl">Existing Schedules:</Text>
                {schedules.length === 0 ? (
                    <Text className="text-gray-400">No schedules added yet.</Text>
                ) : (
                    <ScrollView className="flex-1 overflow-auto">
                        {schedules.map(schedule => (
                            <View key={schedule.id} className="flex-row justify-between items-center bg-gray-700 mb-2 p-3 rounded-md">
                                <View>
                                    <Text className="font-semibold text-white text-base capitalize">{schedule.lightType}</Text>
                                    <Text className="text-gray-300 text-sm">{formatTime(schedule.startTime)} - {formatTime(schedule.endTime)} ({schedule.brightness}%)</Text>
                                </View>
                                 <TouchableOpacity onPress={() => handleDeleteSchedule(schedule.id)} className="bg-red-500 p-2 rounded-md">
                                      <Text className="text-white text-xs">X</Text>
                                 </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                )}
             </View>


            {/* The Add Schedule Modal */}
            <AddScheduleModal
                isVisible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                onAddSchedule={handleAddSchedule}
                availableDevices={availableDevices}
                selectedDeviceId={defaultSelectedDeviceId}
                existingSchedules={schedules}
            />

        </View>
    );
};

const styles = StyleSheet.create({
    calendarContentContainer: {
        flexDirection: 'row',
        alignItems: 'stretch',
        paddingVertical: 10,
         paddingHorizontal: 10,
    },
    hourSlot: {
        height: 200, 
        borderWidth: 1,
        borderColor: '#374151',
        borderLeftWidth: 0,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 4,
        position: 'relative',
        overflow: 'hidden',
    },
     firstHourSlot: {
         borderLeftWidth: 1,
     },
});


export default Schedule;