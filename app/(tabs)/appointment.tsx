import { authService } from '@/services/authServices.service'
import { userService } from '@/services/user.service'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Calendar } from 'react-native-calendars'

interface Appointment {
  _id: string;
  userId: string;
  doctorId: {
    _id: string;
    email: string;
    fullName: string;
    photoUrl: string;
  };
  startTime: string;
  endTime: string;
  appointmentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export default function AppointmentScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  useEffect(() => {
    loadUserAppointments()
  }, [])

  const loadUserAppointments = async () => {
    try {
      setLoading(true)
      const userData = await authService.getUserData()
      
      if (!userData?.id) {
        Alert.alert('Lỗi', 'Vui lòng đăng nhập để xem lịch hẹn')
        return
      }

      const response = await userService.getUserAppointments(userData.id)
      
      if (response.success) {
        setAppointments(response.data)
      } else {
        Alert.alert('Lỗi', response.message || 'Không thể tải danh sách lịch hẹn')
      }
    } catch (error) {
      console.error('Error loading appointments:', error)
      Alert.alert('Lỗi', 'Không thể kết nối đến máy chủ')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    loadUserAppointments()
  }

  const getAppointmentsForDate = (date: string) => {
    return appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.startTime).toISOString().split('T')[0]
      return appointmentDate === date
    })
  }

  const getMarkedDates = () => {
    const marked: any = {}
    
    // Mark selected date
    marked[selectedDate] = {
      selected: true,
      selectedColor: '#00A86B',
      selectedTextColor: 'white'
    }
    
    // Mark dates with appointments
    appointments.forEach(appointment => {
      const date = new Date(appointment.startTime).toISOString().split('T')[0]
      if (date !== selectedDate) {
        marked[date] = {
          marked: true,
          dotColor: '#00A86B'
        }
      } else {
        marked[date] = {
          ...marked[date],
          marked: true,
          dotColor: 'white'
        }
      }
    })
    
    return marked
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
    return `${duration} phút`
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return '#00A86B'
      case 'pending':
        return '#FFA500'
      case 'cancelled':
        return '#F44336'
      case 'completed':
        return '#4CAF50'
      default:
        return '#666'
    }
  }

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'Đã xác nhận'
      case 'pending':
        return 'Chờ xác nhận'
      case 'cancelled':
        return 'Đã hủy'
      case 'completed':
        return 'Hoàn thành'
      default:
        return status
    }
  }

  const renderAppointment = ({ item }: { item: Appointment }) => (
    <TouchableOpacity style={styles.appointmentCard}>
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{formatTime(item.startTime)}</Text>
        <Text style={styles.durationText}>{formatDuration(item.startTime, item.endTime)}</Text>
      </View>
      <View style={styles.appointmentInfo}>
        <Text style={styles.doctorText}>Bác sĩ {item.doctorId.fullName}</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.appointmentStatus) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.appointmentStatus) }]}>
              {getStatusText(item.appointmentStatus)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )

  const selectedDateAppointments = getAppointmentsForDate(selectedDate)

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Lịch hẹn</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00A86B" />
          <Text style={styles.loadingText}>Đang tải lịch hẹn...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Lịch hẹn</Text>
      
      <Calendar
        current={selectedDate}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={getMarkedDates()}
        theme={{
          backgroundColor: '#ffffff',
          calendarBackground: '#ffffff',
          textSectionTitleColor: '#b6c1cd',
          selectedDayBackgroundColor: '#00A86B',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#00A86B',
          dayTextColor: '#2d4150',
          textDisabledColor: '#d9e1e8',
          dotColor: '#00A86B',
          selectedDotColor: '#ffffff',
          arrowColor: '#00A86B',
          monthTextColor: '#00A86B',
          indicatorColor: '#00A86B',
        }}
        style={styles.calendar}
      />

      <View style={styles.appointmentsSection}>
        <Text style={styles.sectionTitle}>
          Lịch hẹn ngày {new Date(selectedDate).toLocaleDateString('vi-VN', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Text>
        
        {selectedDateAppointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Không có lịch hẹn nào trong ngày này</Text>
          </View>
        ) : (
          <FlatList
            data={selectedDateAppointments}
            renderItem={renderAppointment}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.appointmentsList}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 20,
    backgroundColor: 'white',
    color: '#00A86B',
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
    color: '#00A86B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
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
    color: '#00A86B',
  },
  durationText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  appointmentInfo: {
    flex: 1,
  },
  doctorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
})