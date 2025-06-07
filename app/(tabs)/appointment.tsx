import React, { useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Calendar } from 'react-native-calendars'

interface Appointment {
  id: string
  time: string
  service: string
  client: string
  duration: string
}

export default function AppointmentScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  // Sample appointments data
  const [appointments] = useState<Appointment[]>([
    { id: '1', time: '09:00 AM', service: 'Facial Treatment', client: 'Sarah Johnson', duration: '60 min' },
    { id: '2', time: '11:00 AM', service: 'Skin Consultation', client: 'Mike Davis', duration: '30 min' },
    { id: '3', time: '02:00 PM', service: 'Acne Treatment', client: 'Emma Wilson', duration: '45 min' },
    { id: '4', time: '04:00 PM', service: 'Anti-aging Treatment', client: 'John Smith', duration: '90 min' },
  ])

  const renderAppointment = ({ item }: { item: Appointment }) => (
    <TouchableOpacity style={styles.appointmentCard}>
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{item.time}</Text>
        <Text style={styles.durationText}>{item.duration}</Text>
      </View>
      <View style={styles.appointmentInfo}>
        <Text style={styles.serviceText}>{item.service}</Text>
        <Text style={styles.clientText}>{item.client}</Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Appointments</Text>
      
      <Calendar
        current={selectedDate}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={{
          [selectedDate]: {
            selected: true,
            disableTouchEvent: true,
            selectedColor: '#007AFF',
            selectedTextColor: 'white'
          }
        }}
        theme={{
          backgroundColor: '#ffffff',
          calendarBackground: '#ffffff',
          textSectionTitleColor: '#b6c1cd',
          selectedDayBackgroundColor: '#007AFF',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#007AFF',
          dayTextColor: '#2d4150',
          textDisabledColor: '#d9e1e8'
        }}
        style={styles.calendar}
      />

      <View style={styles.appointmentsSection}>
        <Text style={styles.sectionTitle}>
          Appointments for {new Date(selectedDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Text>
        
        <FlatList
          data={appointments}
          renderItem={renderAppointment}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.appointmentsList}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 20,
    backgroundColor: 'white',
    color: '#333',
  },
  calendar: {
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  appointmentsSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  appointmentsList: {
    paddingBottom: 20,
  },
  appointmentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  timeContainer: {
    marginRight: 16,
    alignItems: 'center',
    minWidth: 80,
  },
  timeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  durationText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  appointmentInfo: {
    flex: 1,
  },
  serviceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  clientText: {
    fontSize: 14,
    color: '#666',
  },
})