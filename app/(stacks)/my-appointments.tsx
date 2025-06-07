import { useNotifications } from "@/hooks/useNotifications";
import { authService } from "@/services/authServices.service";
import { userService } from "@/services/user.service";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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

export default function MyAppointmentsScreen() {
  const router = useRouter();
  const { startCall } = useNotifications();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const userData = await authService.getUserData();

      if (!userData?.id) {
        Alert.alert("Lỗi", "Vui lòng đăng nhập lại");
        return;
      }

      const response = await userService.getUserAppointments(userData.id);

      if (response.success) {
        // Sort appointments by start time (newest first)
        const sortedAppointments = response.data.sort(
          (a, b) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
        setAppointments(sortedAppointments);
      } else {
        Alert.alert("Lỗi", "Không thể tải lịch hẹn");
      }
    } catch (error) {
      console.error("Error fetching appointments:", error);
      Alert.alert("Lỗi", "Không thể kết nối đến máy chủ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAppointments();
  };

  const formatAppointmentTime = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);

    const date = start.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeStart = start.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const timeEnd = end.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return { date, time: `${timeStart} - ${timeEnd}`, startDate: start };
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled":
        return "#4285F4";
      case "completed":
        return "#00A86B";
      case "cancelled":
        return "#dc3545";
      case "in-progress":
        return "#FF9800";
      default:
        return "#666666";
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled":
        return "Đã đặt lịch";
      case "completed":
        return "Hoàn thành";
      case "cancelled":
        return "Đã hủy";
      case "in-progress":
        return "Đang diễn ra";
      default:
        return status;
    }
  };

  const isAppointmentActive = (startTime: string, endTime: string) => {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);
    return now >= start && now <= end;
  };

  const isAppointmentUpcoming = (startTime: string) => {
    const now = new Date();
    const start = new Date(startTime);
    const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 24; // Within next 24 hours
  };

  const handleChatWithDoctor = (appointment: Appointment) => {
    // Navigate to chat screen with doctor
    router.push({
      pathname: "/(stacks)/doctor-chat",
      params: {
        doctorId: appointment.doctorId._id,
        doctorName: appointment.doctorId.fullName,
        appointmentId: appointment._id,
      },
    });
  };

  const handleVideoCall = async (appointment: Appointment) => {
    const { startDate } = formatAppointmentTime(
      appointment.startTime,
      appointment.endTime
    );
    const now = new Date();
    const diffMinutes = (startDate.getTime() - now.getTime()) / (1000 * 60);

    // Only allow video call 15 minutes before to 30 minutes after appointment
    if (diffMinutes > 15) {
      Alert.alert(
        "Chưa đến giờ hẹn",
        `Cuộc gọi video sẽ khả dụng 15 phút trước giờ hẹn (${startDate.toLocaleTimeString(
          "vi-VN",
          { hour: "2-digit", minute: "2-digit" }
        )})`
      );
      return;
    }

    if (diffMinutes < -30) {
      Alert.alert("Hết giờ", "Cuộc hẹn đã kết thúc");
      return;
    }

    try {
      // Check if call is already active, if so join, otherwise start
      const isCallActive = diffMinutes <= 0 && diffMinutes >= -30; // Call might be active

      const response = isCallActive
        ? await userService.joinCall(appointment._id)
        : await userService.startCall(appointment._id, { callType: "video" });

      if (response.success) {
        router.push({
          pathname: "/(stacks)/video-call",
          params: {
            appointmentId: appointment._id,
            doctorId: appointment.doctorId._id,
            doctorName: appointment.doctorId.fullName,
            token: response.data.patientToken,
            channelName: response.data.channelName,
            uid: response.data.patientUid.toString(),
            appId: response.data.agoraAppId,
          },
        });
      } else {
        Alert.alert("Lỗi", response.message || "Không thể bắt đầu cuộc gọi");
      }
    } catch (error) {
      console.error("Error with video call:", error);
      Alert.alert("Lỗi", "Không thể kết nối cuộc gọi video");
    }
  };

  const renderAppointment = ({ item }: { item: Appointment }) => {
    const { date, time, startDate } = formatAppointmentTime(
      item.startTime,
      item.endTime
    );
    const isActive = isAppointmentActive(item.startTime, item.endTime);
    const isUpcoming = isAppointmentUpcoming(item.startTime);

    return (
      <View
        style={[
          styles.appointmentCard,
          isActive && styles.activeAppointmentCard,
          isUpcoming && styles.upcomingAppointmentCard,
        ]}
      >
        {isActive && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>ĐANG DIỄN RA</Text>
          </View>
        )}

        <View style={styles.appointmentHeader}>
          <View style={styles.doctorSection}>
            <Image
              source={{
                uri: item.doctorId.photoUrl || "https://via.placeholder.com/60",
              }}
              style={styles.doctorAvatar}
            />
            <View style={styles.doctorInfo}>
              <Text style={styles.doctorName}>{item.doctorId.fullName}</Text>
              <Text style={styles.appointmentDate}>{date}</Text>
              <Text style={styles.appointmentTime}>{time}</Text>
            </View>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: getStatusColor(item.appointmentStatus) + "20",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.appointmentStatus) },
              ]}
            >
              {getStatusText(item.appointmentStatus)}
            </Text>
          </View>
        </View>

        {item.appointmentStatus === "scheduled" && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => handleChatWithDoctor(item)}
            >
              <Ionicons name="chatbubble" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Nhắn tin</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.videoButton,
                !isActive && !isUpcoming && styles.disabledButton,
              ]}
              onPress={() => handleVideoCall(item)}
              disabled={!isActive && !isUpcoming}
            >
              <Ionicons name="videocam" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>
                {isActive ? "Tham gia ngay" : "Gọi video"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {item.appointmentStatus === "completed" && (
          <View style={styles.completedActions}>
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={() => {
                // Navigate to review screen
                Alert.alert(
                  "Đánh giá",
                  "Tính năng đánh giá sẽ được phát triển"
                );
              }}
            >
              <Ionicons name="star-outline" size={16} color="#00A86B" />
              <Text style={styles.reviewText}>Đánh giá bác sĩ</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#00A86B" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Lịch hẹn của tôi</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00A86B" />
            <Text style={styles.loadingText}>Đang tải lịch hẹn...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#00A86B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lịch hẹn của tôi</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
          >
            <Ionicons name="refresh" size={24} color="#00A86B" />
          </TouchableOpacity>
        </View>

        {appointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>Chưa có lịch hẹn</Text>
            <Text style={styles.emptySubtitle}>
              Đặt lịch hẹn với bác sĩ để bắt đầu chăm sóc sức khỏe
            </Text>
            <TouchableOpacity
              style={styles.bookNowButton}
              onPress={() => router.push("/(stacks)/doctors-list")}
            >
              <Text style={styles.bookNowText}>Đặt lịch ngay</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={appointments}
            renderItem={renderAppointment}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContainer}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 30,
  },
  bookNowButton: {
    backgroundColor: "#00A86B",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  bookNowText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  listContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  appointmentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeAppointmentCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#00A86B",
    backgroundColor: "#F0FFF4",
  },
  upcomingAppointmentCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#4285F4",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00A86B",
    marginRight: 8,
    shadowColor: "#00A86B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  liveText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#00A86B",
  },
  appointmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  doctorSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  doctorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    backgroundColor: "#E0E0E0",
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  appointmentDate: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  appointmentTime: {
    fontSize: 16,
    color: "#00A86B",
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  chatButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00A86B",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  videoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4285F4",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  disabledButton: {
    backgroundColor: "#CCCCCC",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  completedActions: {
    alignItems: "center",
  },
  reviewButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#E8F5E8",
    borderRadius: 8,
    gap: 6,
  },
  reviewText: {
    color: "#00A86B",
    fontSize: 14,
    fontWeight: "500",
  },
});
