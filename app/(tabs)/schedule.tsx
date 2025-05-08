import AddScheduleModal from '@/components/AddScheduleModal';
import React, { useState } from 'react'; // Import useState
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

const { width: screenWidth } = Dimensions.get('window');
const HOUR_SLOT_WIDTH = 80; 

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

    const [schedules, setSchedules] = useState<ScheduleItem[]>([
         { id: 1, startTime: new Date(0,0,0, 7, 0), endTime: new Date(0,0,0, 8, 0), lightType: 'warm', brightness: 80, deviceId: '192.168.101.101' }, // Warm light 7:00 - 8:00
         { id: 2, startTime: new Date(0,0,0, 18, 30), endTime: new Date(0,0,0, 20, 0), lightType: 'natural', brightness: 50, deviceId: '192.168.101.101' }, // Natural light 18:30 - 20:00
         { id: 3, startTime: new Date(0,0,0, 22, 0), endTime: new Date(0,0,0, 22, 30), lightType: 'both', brightness: 100, deviceId: '192.168.101.101' }, // Both lights 22:00 - 22:30
          { id: 4, startTime: new Date(0,0,0, 23, 30), endTime: new Date(0,0,0, 0, 30), lightType: 'warm', brightness: 60, deviceId: '192.168.101.101' }, // Warm light 23:30 - 00:30 (Spans midnight)
    ]);

    const availableDevices = [
        '192.168.101.101',
    ];
    const defaultSelectedDeviceId = availableDevices.length > 0 ? availableDevices[0] : 'YOUR_ESP32_IP_ADDRESS';

    // Array representing 24 hours (0 to 23)
    const hours = Array.from({ length: 24 }, (_, i) => i);


     // Helper to format Date object to HH:MM string (Needed for display in list/modal)
     const formatTime = (date: Date) => {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
     };

     // Function to calculate the style and details for a schedule block segment within a given hour (Horizontal)
      const getSegmentDetails = (schedule: ScheduleItem, currentHour: number) => {
         // Calculate schedule start/end times in minutes since midnight (0-1440 scale for one day)
         const scheduleStartMins = schedule.startTime.getHours() * 60 + schedule.startTime.getMinutes();
         const scheduleEndMins = schedule.endTime.getHours() * 60 + schedule.endTime.getMinutes();

         // Handle schedules that span across midnight by potentially creating two logical time ranges
         const scheduleRanges = [];
         if (scheduleEndMins < scheduleStartMins) {
             // Spans midnight: segment from start to 24:00, and segment from 00:00 to end
             scheduleRanges.push([scheduleStartMins, 1440]); // Range up to midnight (exclusive end for overlap check)
             scheduleRanges.push([0, scheduleEndMins]);     // Range from midnight
         } else {
             // Does not span midnight
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
                  // Found the overlapping segment within this hour
                  overlappingSegment = {
                      schedule, // Reference to the original schedule
                      overlapStartMins, // Start of the *actual* overlap within the current hour slot
                      overlapEndMins,   // End of the *actual* overlap within the current hour slot
                  };
                  break; // Found the segment for this hour
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
         const left = (segmentMinutesIntoHour / 60) * 100; // Position from the left as a percentage of slot width
         const width = (segmentDurationMinutes / 60) * 100; // Width as a percentage of slot width

         let bgColorClass = 'bg-blue-500'; // Default or Both
         if (schedule.lightType === 'warm') bgColorClass = 'bg-orange-500';
         if (schedule.lightType === 'natural') bgColorClass = 'bg-gray-400'; // Using a darker gray for natural


          return {
              schedule, // Original schedule item
              style: {
                  position: 'absolute', // Position absolutely within the hour slot
                  left: `${left}%`,       // Position from the left as a percentage
                  width: `${width}%`,     // Width as a percentage of the hour slot
                  height: '80%',        // Fixed height for the schedule block
                  top: '10%',           // Center vertically within the slot
                  borderRadius: 4,      // Rounded corners
              },
              className: `${bgColorClass}`, // Background color class
              segmentDurationMinutes, // Return duration for conditional text rendering
          };
      };


    // Handler for the "Add Config" button
    const handleAddConfig = () => {
        console.log("Add Config button pressed");
        setIsModalVisible(true); // Show the modal
    };

     // Handler for when the modal's "Add" button is pressed
    const handleAddSchedule = (newSchedule: Omit<ScheduleItem, 'id'>) => {
        console.log("Received schedule from modal:", newSchedule);
        // Add a unique ID to the new schedule
        const scheduleWithId = { ...newSchedule, id: Date.now() + Math.random() }; // Simple unique ID, add random for extra safety

        setSchedules(prevSchedules => [...prevSchedules, scheduleWithId]);
    };

     // Handler to delete a schedule (Optional: can be triggered from block tap/long press or a list item)
    const handleDeleteSchedule = (id: number) => {
         Alert.alert(
             "Delete Schedule",
             "Are you sure you want to delete this schedule?",
             [
                 { text: "Cancel", style: "cancel" },
                 { text: "Delete", style: "destructive", onPress: () => {
                     setSchedules(prevSchedules => prevSchedules.filter(sched => sched.id !== id));
                     console.log(`Deleted schedule with ID: ${id}`);
                 }}
             ]
         );
     };

     // Handler for editing a schedule (Placeholder: can be triggered from block tap/long press or a list item)
     const handleEditSchedule = (schedule: ScheduleItem) => {
          console.log("Edit schedule pressed:", schedule);
          // TODO: Implement Edit Modal/Form: Open the modal, pre-fill with schedule data, and change "Add" to "Save"
     };


    return (
        <View className="flex-1 bg-primary" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
             {/* Title */}
            <Text className="mt-8 mb-4 font-bold text-white text-3xl text-center">
                Scheduler
            </Text>

            {/* 24-Hour Calendar Scroll View (Horizontal) */}
            <View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.calendarContentContainer}
                    className="border-gray-700 border-b" 
                >
                    {hours.map(hour => (
                        <View
                            key={hour}
                            style={[
                                styles.hourSlot, // Apply base styles
                                { width: HOUR_SLOT_WIDTH }, // Set fixed width for each hour slot
                                hour === 0 ? styles.firstHourSlot : null // Add left border to the very first slot
                            ]}
                        >
                            {/* Hour Label */}
                            {/* Placed inside the hour slot, centered */}
                             <Text className="mb-1 text-gray-400 text-xs text-center">
                                {hour.toString().padStart(2, '0')}:00
                             </Text>

                             {/* Schedule Blocks Area (within the hour slot, using absolute positioning relative to hourSlot) */}
                                {/* Visual representation of schedule blocks within this hour */}
                                {/* Map over the 'schedules' state to find and render blocks */}
                                {schedules.map(schedule => {
                                    // Get segment details for this schedule within the current hour
                                     // The getSegmentDetails function handles midnight spanning and calculates horizontal position/width
                                    const segmentDetails = getSegmentDetails(schedule, hour); // Pass the current hour to the helper

                                    // If the helper found an overlapping segment for this hour, render the block
                                    if (segmentDetails) {
                                         const { schedule: originalSchedule, style, className, segmentDurationMinutes } = segmentDetails;

                                        return (
                                             // Schedule block TouchableOpacity (make it tappable for interaction)
                                            <TouchableOpacity
                                                 // Unique key for each rendered block segment
                                                 // Combine schedule ID and the hour it appears in
                                                 key={`${originalSchedule.id}-${hour}`}
                                                 style={style} 
                                                className={`absolute rounded-sm ${className} items-center 
                                                justify-center p-0.5 z-10`}
                                                
                                                 onPress={() => { handleEditSchedule(originalSchedule); }} // Example: Edit on tap
                                                 onLongPress={() => { handleDeleteSchedule(originalSchedule.id); }} // Example: Delete on long press
                                            >
                                                {/* Display Info Inside the Block */}
                                                 {/* Adjust text size and layout based on block width (segmentDurationMinutes affects width) */}
                                                  {/* Showing type and brightness for segments >= 30 mins */}
                                                  {segmentDurationMinutes >= 30 && (
                                                      <>
                                                          <Text className="font-bold text-white text-xs text-center leading-none">
                                                               {"Mode: " + originalSchedule.lightType}
                                                          </Text>
                                                           <Text className="mt-2 text-white text-xs text-center leading-none">
                                                               {"Brightness: " + originalSchedule.brightness}%
                                                           </Text>
                                                      </>
                                                  )}
                                                  {/* For shorter segments (15-29 mins), maybe just show type */}
                                                   {segmentDurationMinutes >= 15 && segmentDurationMinutes < 30 && (
                                                       <Text className="font-bold text-white text-xs leading-none">
                                                            {originalSchedule.lightType.charAt(0).toUpperCase()}
                                                       </Text>
                                                   )}
                                                    {/* For very short segments (< 15 mins), maybe show nothing or a tiny marker */}
                                                     {/* Currently shows nothing */}
                                            </TouchableOpacity>
                                        );
                                    }
                                    return null; 
                                })}

                                <View className="absolute bg-gray-600 w-px" style={{ left: '50%', top: 0, bottom: 0 }} /> {/* Half-hour line */}

                        </View> 
                    ))}

                </ScrollView>
            </View>


            {/* "Add Config" Button */}
            <TouchableOpacity
                className="items-center bg-green-500 mx-5 my-4 p-4 rounded-lg" // Added my-4 for margin
                onPress={handleAddConfig} // This handler will show the modal
            >
                <Text className="font-semibold text-white text-lg">Add New Schedule</Text>
            </TouchableOpacity>

            <ScrollView className="flex-1 mt-4 px-5">
                 <Text className="mb-2 font-bold text-white text-xl">Existing Schedules:</Text>
                  {schedules.length === 0 ? (
                      <Text className="text-gray-400">No schedules added yet.</Text>
                  ) : (
                       schedules.map(schedule => (
                           <View key={schedule.id} className="flex-row justify-between items-center bg-gray-700 mb-2 p-3 rounded-md">
                               <View>
                                   <Text className="font-semibold text-white text-base capitalize">{schedule.lightType}</Text>
                                   <Text className="text-gray-300 text-sm">{formatTime(schedule.startTime)} - {formatTime(schedule.endTime)} ({schedule.brightness}%)</Text>
                                    <Text className="text-gray-400 text-xs">Device: {schedule.deviceId}</Text>
                               </View>
                                {/* Delete Button */}
                                <TouchableOpacity onPress={() => handleDeleteSchedule(schedule.id)} className="bg-red-500 p-2 rounded-md">
                                     <Text className="text-white text-xs">Delete</Text>
                                </TouchableOpacity>
                           </View>
                       ))
                  )}
              </ScrollView>

            <AddScheduleModal
                isVisible={isModalVisible} // Control modal visibility using state
                onClose={() => setIsModalVisible(false)} // Close modal handler
                onAddSchedule={handleAddSchedule} // Handler when modal's Add button is pressed
                availableDevices={availableDevices} // Pass the list of devices to the modal's picker
                selectedDeviceId={defaultSelectedDeviceId} // Pass the default selected device
            />

        </View>
    );
};

const styles = StyleSheet.create({
    calendarContentContainer: {
        flexDirection: 'row', // Arrange hour slots horizontally
        alignItems: 'stretch', // Make hour slots fill the height of the ScrollView
        paddingVertical: 10, // Padding above and below the hour slots
        paddingHorizontal: 10, // Padding at the very left and right ends of the scrollable area
    },
    hourSlot: {
        height: 200, // Fixed height for each hour slot
        borderWidth: 1, // Add borders to create the grid cells
        borderColor: '#374151', // Use a dark gray color
        borderLeftWidth: 0, // Remove the left border to create continuous vertical lines
        justifyContent: 'flex-start', // Align hour label to the top
        alignItems: 'center', // Center hour label horizontally
        paddingTop: 4, // Padding at the top inside the slot for the label
        position: 'relative', // Important: This makes the hour slot the positioning context for absolute children (schedule blocks)
        overflow: 'hidden', 
    },
     firstHourSlot: {
         borderLeftWidth: 1,
     },
});


export default Schedule;